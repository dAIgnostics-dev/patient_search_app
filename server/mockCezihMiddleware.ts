import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { dirname } from 'node:path';
import type { Connect } from 'vite';
import type { FhirClinicalDocumentBundle, FhirResource } from '../src/fhir/types';
import { CEZIH_MOCK_BUNDLES, CEZIH_MOCK_STORAGE, type CezihMockStorage } from '../src/data/mock/cezihBundles';
import type { FhirReadableResourceType } from '../src/data/fhir-client/types';

const SUPPORTED_RESOURCE_TYPES: FhirReadableResourceType[] = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Condition',
  'DocumentReference',
];

type MockStoragePayload = CezihMockStorage;

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

function seededStorage(): MockStoragePayload {
  const payload: MockStoragePayload = {};
  for (const type of SUPPORTED_RESOURCE_TYPES) {
    payload[type] = [...(CEZIH_MOCK_BUNDLES[type] ?? [])];
  }
  payload.DocumentBundle = [...(CEZIH_MOCK_STORAGE.DocumentBundle ?? [])];
  payload.Binary = [...(CEZIH_MOCK_STORAGE.Binary ?? [])];
  return payload;
}

function loadStorage(storageFile: string): MockStoragePayload {
  if (!existsSync(storageFile)) return seededStorage();
  try {
    const parsed = JSON.parse(readFileSync(storageFile, 'utf8')) as MockStoragePayload;
    return parsed && typeof parsed === 'object' ? parsed : seededStorage();
  } catch {
    return seededStorage();
  }
}

function saveStorage(storageFile: string, payload: MockStoragePayload): void {
  mkdirSync(dirname(storageFile), { recursive: true });
  writeFileSync(storageFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeStorage(raw: MockStoragePayload): MockStoragePayload {
  const payload: MockStoragePayload = {};
  for (const type of SUPPORTED_RESOURCE_TYPES) {
    payload[type] = Array.isArray(raw[type]) ? raw[type] : [];
  }
  payload.DocumentBundle = Array.isArray(raw.DocumentBundle)
    ? (raw.DocumentBundle as FhirClinicalDocumentBundle[])
    : [...(CEZIH_MOCK_STORAGE.DocumentBundle ?? [])];
  payload.Binary = Array.isArray(raw.Binary)
    ? (raw.Binary as import('../src/fhir/types').FhirBinary[])
    : [...(CEZIH_MOCK_STORAGE.Binary ?? [])];
  return payload;
}

export function createMockCezihMiddleware(storageFile: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? '';

    if (url === '/api/mock-cezih/resources' && req.method === 'GET') {
      sendJson(res, 200, loadStorage(storageFile));
      return;
    }

    if (url === '/api/mock-cezih/resources' && req.method === 'PUT') {
      try {
        const body = normalizeStorage((await readJsonBody(req)) as MockStoragePayload);
        saveStorage(storageFile, body);
        sendJson(res, 200, body);
      } catch {
        sendJson(res, 400, { error: 'Invalid mock CEZIH storage payload.' });
      }
      return;
    }

    const match = url.match(/^\/api\/mock-cezih\/resources\/([^/]+)(?:\/([^/]+))?$/);
    if (match && req.method === 'GET') {
      const resourceType = match[1] as FhirReadableResourceType;
      if (!SUPPORTED_RESOURCE_TYPES.includes(resourceType)) {
        sendJson(res, 404, { error: 'Unsupported mock CEZIH resource type.' });
        return;
      }

      const resources = loadStorage(storageFile)[resourceType] ?? [];
      const id = match[2] ? decodeURIComponent(match[2]) : null;
      sendJson(res, 200, id ? (resources.find((resource) => resource.id === id) ?? null) : resources);
      return;
    }

    next();
  };
}
