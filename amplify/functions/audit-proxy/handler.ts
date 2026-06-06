import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Handler } from 'aws-lambda';

const VALID_ACTIONS = new Set([
  'auth.login',
  'auth.login.failed',
  'auth.logout',
  'mbo.lookup',
  'patient.list.select',
  'patient.karton.open',
  'patient.resource.view',
]);

const VALID_SOURCES = new Set(['mbo', 'my-patients', 'recent']);
const VALID_OUTCOMES = new Set(['success', 'not_found', 'error']);
const VALID_RESOURCE_TYPES = new Set([
  'encounter',
  'condition',
  'practitioner',
  'organization',
  'medication',
  'allergy',
  'procedure',
  'document',
  'referral',
]);

const AUDIT_OBJECT_KEY = 'access.jsonl';
const s3 = new S3Client({});

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function normalizePath(rawPath: string): string {
  const collapsed = rawPath.replace(/\/+/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed || '/';
}

function isAccessPath(path: string): boolean {
  return path === '/access' || path === '/api/audit/access';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw);
}

function validateActor(actor: unknown, requirePractitioner: boolean): string | null {
  if (!isRecord(actor)) return 'Missing actor.';
  if (!actor.username || typeof actor.username !== 'string') {
    return 'Missing actor.username.';
  }
  if (requirePractitioner) {
    if (!actor.practitionerId || typeof actor.practitionerId !== 'string') {
      return 'Missing actor.practitionerId.';
    }
    if (!actor.hzjzId || typeof actor.hzjzId !== 'string') {
      return 'Missing actor.hzjzId.';
    }
  }
  return null;
}

function validatePatient(patient: unknown, required: boolean): string | null {
  if (patient == null) {
    return required ? 'Missing patient.' : null;
  }
  if (!isRecord(patient)) return 'Invalid patient.';
  if (!patient.id || typeof patient.id !== 'string') {
    return 'Missing patient.id.';
  }
  return null;
}

function validateBase(body: Record<string, unknown>): string | null {
  if (!body.eventId || typeof body.eventId !== 'string') {
    return 'Missing eventId.';
  }
  if (!body.action || typeof body.action !== 'string' || !VALID_ACTIONS.has(body.action)) {
    return 'Invalid or missing action.';
  }
  if (!body.occurredAt || typeof body.occurredAt !== 'string') {
    return 'Missing occurredAt.';
  }
  if (!body.outcome || typeof body.outcome !== 'string' || !VALID_OUTCOMES.has(body.outcome)) {
    return 'Invalid or missing outcome.';
  }

  const action = body.action as string;

  if (action === 'auth.login.failed') {
    if (body.sessionId != null) return 'auth.login.failed must not include sessionId.';
    return validateActor(body.actor, false);
  }

  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return 'Missing sessionId.';
  }

  const actorError = validateActor(body.actor, true);
  if (actorError) return actorError;

  if (body.context != null) {
    if (!isRecord(body.context)) return 'Invalid context.';
    const source = body.context.source;
    if (source != null && (typeof source !== 'string' || !VALID_SOURCES.has(source))) {
      return 'Invalid context.source.';
    }
  }

  return null;
}

function validateEvent(body: Record<string, unknown>): string | null {
  const baseError = validateBase(body);
  if (baseError) return baseError;

  const action = body.action as string;

  if (action === 'mbo.lookup') {
    if (!isRecord(body.lookup) || typeof body.lookup.mbo !== 'string') {
      return 'Missing lookup.mbo.';
    }
    const patientError = validatePatient(body.patient, false);
    if (patientError) return patientError;
  }

  if (action === 'patient.list.select' || action === 'patient.karton.open') {
    const patientError = validatePatient(body.patient, true);
    if (patientError) return patientError;
    if (!isRecord(body.context) || typeof body.context.source !== 'string') {
      return 'Missing context.source.';
    }
    if (!VALID_SOURCES.has(body.context.source)) {
      return 'Invalid context.source.';
    }
  }

  if (action === 'patient.resource.view') {
    const patientError = validatePatient(body.patient, true);
    if (patientError) return patientError;
    if (!isRecord(body.resource)) {
      return 'Missing resource.';
    }
    if (
      typeof body.resource.type !== 'string' ||
      !VALID_RESOURCE_TYPES.has(body.resource.type)
    ) {
      return 'Invalid resource.type.';
    }
    if (typeof body.resource.id !== 'string') {
      return 'Missing resource.id.';
    }
  }

  return null;
}

function getBucketName(): string {
  const bucket = process.env.AUDIT_BUCKET_NAME?.trim();
  if (!bucket) {
    throw new Error('Missing required environment variable: AUDIT_BUCKET_NAME');
  }
  return bucket;
}

async function readExistingAuditLog(bucket: string): Promise<string> {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: AUDIT_OBJECT_KEY,
      }),
    );
    return (await response.Body?.transformToString()) ?? '';
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return '';
    }
    throw error;
  }
}

async function appendAuditLine(line: string): Promise<void> {
  const bucket = getBucketName();
  const existing = await readExistingAuditLog(bucket);
  const body = existing ? `${existing}${existing.endsWith('\n') ? '' : '\n'}${line}\n` : `${line}\n`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: AUDIT_OBJECT_KEY,
      Body: body,
      ContentType: 'application/x-ndjson',
    }),
  );
}

export const handler: Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (event) => {
  const method = event.requestContext.http.method;
  const path = normalizePath(event.rawPath || event.requestContext.http.path || '/');

  if (method === 'OPTIONS') {
    return { statusCode: 204 };
  }

  if (method !== 'POST' || !isAccessPath(path)) {
    return jsonResponse(404, { error: 'Not found.' });
  }

  try {
    const body = parseBody(event) as Record<string, unknown>;
    const validationError = validateEvent(body);
    if (validationError) {
      return jsonResponse(400, { error: validationError });
    }

    const line = JSON.stringify({ ...body, recordedAt: new Date().toISOString() });
    await appendAuditLine(line);

    return { statusCode: 204 };
  } catch {
    return jsonResponse(400, { error: 'Invalid request body.' });
  }
};
