/**
 * SigV4 GET to HealthLake FHIR (same signing path as healthlake-proxy Lambda).
 * Usage:
 *   HEALTHLAKE_DATASTORE_ID=... HEALTHLAKE_REGION=us-east-1 npx tsx scripts/verify-healthlake-fhir.ts Patient
 *   HEALTHLAKE_DATASTORE_ID=... npx tsx scripts/verify-healthlake-fhir.ts Encounter 'subject=Patient/1442'
 */
import { Sha256 } from '@aws-crypto/sha256-js';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { NodeHttpHandler } from '@smithy/node-http-handler';

const region = process.env.HEALTHLAKE_REGION?.trim() || 'us-east-1';
const datastoreId = process.env.HEALTHLAKE_DATASTORE_ID?.trim();

if (!datastoreId) {
  console.error('Set HEALTHLAKE_DATASTORE_ID');
  process.exit(1);
}

const resourceType = process.argv[2]?.trim() || 'Patient';
const queryArg = process.argv[3]?.trim();

function parseQueryArg(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(raw)) {
    query[key] = value;
  }
  return Object.keys(query).length > 0 ? query : undefined;
}

const hostname = `healthlake.${region}.amazonaws.com`;
const path = `/datastore/${datastoreId}/r4/${resourceType}`;
const query = parseQueryArg(queryArg);

const request = new HttpRequest({
  method: 'GET',
  protocol: 'https:',
  hostname,
  path,
  query,
  headers: {
    host: hostname,
    accept: 'application/fhir+json',
  },
});

const signer = new SignatureV4({
  credentials: defaultProvider(),
  region,
  service: 'healthlake',
  sha256: Sha256,
});

const signed = await signer.sign(request);
const { response } = await new NodeHttpHandler().handle(HttpRequest.clone(signed));
const text =
  typeof (response.body as { transformToString?: () => Promise<string> })?.transformToString ===
  'function'
    ? await (response.body as { transformToString: () => Promise<string> }).transformToString()
    : '';

console.log(`GET ${path}${queryArg ? ` ?${queryArg}` : ''}`);
console.log(`HTTP ${response.statusCode}`);

if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
  try {
    const json = JSON.parse(text) as { resourceType?: string; total?: number };
    if (json.resourceType === 'Bundle') {
      console.log(`OK: Bundle total=${json.total ?? '?'}`);
    } else {
      console.log(`OK: ${json.resourceType ?? 'response'} (${text.length} bytes)`);
    }
  } catch {
    console.log(`OK: ${text.length} bytes`);
  }
  process.exit(0);
}

console.log('FAIL: body (first 800 chars):');
console.log(text.slice(0, 800));
process.exit(1);
