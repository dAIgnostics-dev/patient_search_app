import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Handler,
} from 'aws-lambda';

const RESOURCE_TYPES = [
  'Patient',
  'Encounter',
  'Condition',
  'Practitioner',
  'Organization',
  'MedicationRequest',
  'AllergyIntolerance',
  'Procedure',
  'DocumentReference',
  'ServiceRequest',
] as const;

type ResourceType = (typeof RESOURCE_TYPES)[number];

const httpHandler = new NodeHttpHandler();

function getEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function operationOutcome(
  code: 'not-found' | 'invalid' | 'not-supported',
  diagnostics: string,
) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity: 'error', code, diagnostics }],
  };
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/fhir+json; charset=utf-8',
    },
    body: JSON.stringify(body),
  };
}

function normalizeRequestPath(rawPath: string | undefined): string {
  const collapsed = (rawPath ?? '/').replace(/\/+/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed || '/';
}

function parsePath(rawPath: string): { resourceType: ResourceType; id?: string } | null {
  const path = normalizeRequestPath(rawPath);
  const byId = path.match(/^\/(Patient|Encounter|Condition|Practitioner|Organization)\/([^/]+)$/);
  if (byId) {
    return { resourceType: byId[1] as ResourceType, id: decodeURIComponent(byId[2]) };
  }
  const search = path.match(/^\/(Patient|Encounter|Condition|Practitioner|Organization)$/);
  if (search) {
    return { resourceType: search[1] as ResourceType };
  }
  return null;
}

/**
 * Decode query for SigV4: use API Gateway's parsed params (not rawQueryString in the path).
 * Embedding ?subject=Patient%2F1442 in HttpRequest.path breaks HealthLake signature validation.
 */
function parseQueryFromEvent(event: APIGatewayProxyEventV2): Record<string, string> | undefined {
  const fromApi = event.queryStringParameters;
  if (fromApi && Object.keys(fromApi).length > 0) {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(fromApi)) {
      if (value != null) query[key] = value;
    }
    return query;
  }

  const raw = event.rawQueryString?.trim();
  if (!raw) return undefined;

  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(raw)) {
    query[key] = value;
  }
  return Object.keys(query).length > 0 ? query : undefined;
}

function buildHealthLakeRequest(
  region: string,
  datastoreId: string,
  resourceType: ResourceType,
  resourceId: string | undefined,
  query: Record<string, string> | undefined,
): HttpRequest {
  const hostname = `healthlake.${region}.amazonaws.com`;
  const resourceSegment = resourceId
    ? `/${resourceType}/${encodeURIComponent(resourceId)}`
    : `/${resourceType}`;

  return new HttpRequest({
    method: 'GET',
    protocol: 'https:',
    hostname,
    path: `/datastore/${datastoreId}/r4${resourceSegment}`,
    query,
    headers: {
      host: hostname,
      accept: 'application/fhir+json',
    },
  });
}

function getHealthLakeRegion(): string {
  return getEnv('HEALTHLAKE_REGION');
}

async function readResponseBody(body: unknown): Promise<string> {
  if (!body) return '';
  const withTransform = body as { transformToString?: () => Promise<string> };
  if (typeof withTransform.transformToString === 'function') {
    return withTransform.transformToString();
  }
  const readable = body as NodeJS.ReadableStream;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    readable.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    readable.on('error', reject);
  });
}

/** SigV4 via HttpRequest.query + NodeHttpHandler (required for search query params). */
async function signedHealthLakeGet(request: HttpRequest): Promise<{
  statusCode: number;
  body: string;
  contentType?: string;
}> {
  const region = getHealthLakeRegion();
  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: 'healthlake',
    sha256: Sha256,
  });

  const signed = await signer.sign(request);
  const { response } = await httpHandler.handle(HttpRequest.clone(signed));
  const text = await readResponseBody(response.body);

  return {
    statusCode: response.statusCode ?? 500,
    body: text,
    contentType: response.headers?.['content-type'] as string | undefined,
  };
}

async function forwardToHealthLake(
  resourceType: ResourceType,
  resourceId: string | undefined,
  query: Record<string, string> | undefined,
): Promise<APIGatewayProxyResultV2> {
  const region = getHealthLakeRegion();
  const datastoreId = getEnv('HEALTHLAKE_DATASTORE_ID');

  if (datastoreId === 'REPLACE_WITH_YOUR_DATASTORE_ID') {
    return jsonResponse(
      500,
      operationOutcome('invalid', 'Set HEALTHLAKE_DATASTORE_ID on the healthlake-proxy function'),
    );
  }

  const request = buildHealthLakeRequest(region, datastoreId, resourceType, resourceId, query);
  const response = await signedHealthLakeGet(request);
  const text = response.body;

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = operationOutcome('invalid', text || `HealthLake returned status ${response.statusCode}`);
  }

  if (response.statusCode === 403) {
    const outcome = body as { issue?: Array<{ diagnostics?: string }> };
    const diagnostics =
      outcome.issue?.[0]?.diagnostics ||
      (typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : undefined) ||
      text.slice(0, 300) ||
      'Access denied';
    body = operationOutcome('invalid', `HealthLake 403: ${diagnostics}`);
  }

  return {
    statusCode: response.statusCode,
    headers: {
      'Content-Type': response.contentType ?? 'application/fhir+json',
    },
    body: JSON.stringify(body),
  };
}

export const handler: Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (event) => {
  const method = event.requestContext.http.method;

  if (method === 'OPTIONS') {
    return { statusCode: 204 };
  }

  if (method !== 'GET') {
    return jsonResponse(405, operationOutcome('not-supported', 'Only GET is supported'));
  }

  const requestPath =
    event.rawPath ||
    event.requestContext.http.path ||
    '/';
  const parsed = parsePath(requestPath);
  if (!parsed) {
    return jsonResponse(
      404,
      operationOutcome(
        'not-supported',
        `Unsupported endpoint: ${normalizeRequestPath(requestPath)} (expected /Patient, /Encounter, …)`,
      ),
    );
  }

  if (!RESOURCE_TYPES.includes(parsed.resourceType)) {
    return jsonResponse(404, operationOutcome('not-supported', 'Unsupported resource type'));
  }

  return forwardToHealthLake(parsed.resourceType, parsed.id, parseQueryFromEvent(event));
};
