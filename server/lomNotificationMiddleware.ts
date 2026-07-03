import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';

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

export function createLomNotificationMiddleware(queueFile: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/lom-notifications')) {
      next();
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        if (!isRecord(body) || typeof body.documentReferenceId !== 'string') {
          sendJson(res, 400, { error: 'Invalid LOM notification payload.' });
          return;
        }

        mkdirSync(dirname(queueFile), { recursive: true });
        appendFileSync(queueFile, `${JSON.stringify(body)}\n`, 'utf8');
        sendJson(res, 202, { accepted: true });
      } catch {
        sendJson(res, 500, { error: 'Failed to persist LOM notification.' });
      }
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed.' });
  };
}

export function defaultLomQueuePath(rootDir: string): string {
  return join(rootDir, 'mock-data/lom-notifications.jsonl');
}
