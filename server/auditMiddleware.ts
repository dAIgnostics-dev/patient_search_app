import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';

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

function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function validateActor(
  actor: unknown,
  requirePractitioner: boolean,
): string | null {
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

export function createAuditMiddleware(auditDir: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? '';

    if (url !== '/api/audit/access' || req.method !== 'POST') {
      next();
      return;
    }

    try {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const baseError = validateBase(body);
      if (baseError) {
        sendJson(res, 400, { error: baseError });
        return;
      }

      const action = body.action as string;

      if (action === 'mbo.lookup') {
        if (!isRecord(body.lookup) || typeof body.lookup.mbo !== 'string') {
          sendJson(res, 400, { error: 'Missing lookup.mbo.' });
          return;
        }
        const patientError = validatePatient(body.patient, false);
        if (patientError) {
          sendJson(res, 400, { error: patientError });
          return;
        }
      }

      if (action === 'patient.list.select' || action === 'patient.karton.open') {
        const patientError = validatePatient(body.patient, true);
        if (patientError) {
          sendJson(res, 400, { error: patientError });
          return;
        }
        if (!isRecord(body.context) || typeof body.context.source !== 'string') {
          sendJson(res, 400, { error: 'Missing context.source.' });
          return;
        }
        if (!VALID_SOURCES.has(body.context.source)) {
          sendJson(res, 400, { error: 'Invalid context.source.' });
          return;
        }
      }

      if (action === 'patient.resource.view') {
        const patientError = validatePatient(body.patient, true);
        if (patientError) {
          sendJson(res, 400, { error: patientError });
          return;
        }
        if (!isRecord(body.resource)) {
          sendJson(res, 400, { error: 'Missing resource.' });
          return;
        }
        if (
          typeof body.resource.type !== 'string' ||
          !VALID_RESOURCE_TYPES.has(body.resource.type)
        ) {
          sendJson(res, 400, { error: 'Invalid resource.type.' });
          return;
        }
        if (typeof body.resource.id !== 'string') {
          sendJson(res, 400, { error: 'Missing resource.id.' });
          return;
        }
      }

      mkdirSync(auditDir, { recursive: true });
      const line = JSON.stringify({ ...body, recordedAt: new Date().toISOString() });
      appendFileSync(join(auditDir, 'access.jsonl'), `${line}\n`, 'utf8');

      res.statusCode = 204;
      res.end();
    } catch {
      sendJson(res, 400, { error: 'Invalid request body.' });
    }
  };
}
