import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:4711';

function resolveBridgeUrl(): string {
  return process.env.CARD_READER_BRIDGE_URL?.trim() || DEFAULT_BRIDGE_URL;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function proxyBridge(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const response = await fetch(`${resolveBridgeUrl()}${path}`, init);
    const text = await response.text();
    let body: unknown = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: 'invalid_bridge_response' };
      }
    }
    return { ok: response.ok, status: response.status, body };
  } catch {
    return {
      ok: false,
      status: 503,
      body: {
        readerConnected: false,
        cardPresent: false,
        bridgeAvailable: false,
        mode: 'pkcs11',
      },
    };
  }
}

function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export function createCardReaderMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? '';
    const method = req.method ?? 'GET';

    if (url === '/api/card-reader/status' && method === 'GET') {
      const result = await proxyBridge('/status');
      if (!result.ok && result.status === 503) {
        sendJson(res, 200, result.body);
        return;
      }
      sendJson(res, result.status, {
        ...(result.body as Record<string, unknown>),
        bridgeAvailable: true,
      });
      return;
    }

    if (url === '/api/card-reader/identity' && method === 'GET') {
      const result = await proxyBridge('/identity');
      sendJson(res, result.status, result.body);
      return;
    }

    if (url === '/api/card-reader/mock/insert' && method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const result = await proxyBridge('/mock/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        sendJson(res, result.status, result.body);
      } catch {
        sendJson(res, 400, { error: 'invalid_request' });
      }
      return;
    }

    if (url === '/api/card-reader/mock/remove' && method === 'POST') {
      const result = await proxyBridge('/mock/remove', { method: 'POST' });
      sendJson(res, result.status, result.body);
      return;
    }

    next();
  };
}

export async function fetchCardReaderStatusFromBridge(): Promise<{
  ok: boolean;
  status: number;
  statusBody: Record<string, unknown> | null;
}> {
  const result = await proxyBridge('/status');
  if (!result.ok && result.status === 503) {
    return { ok: true, status: 200, statusBody: result.body as Record<string, unknown> };
  }
  return {
    ok: result.ok,
    status: result.status,
    statusBody: result.body as Record<string, unknown>,
  };
}

export async function fetchCardIdentityFromBridge(): Promise<{
  ok: boolean;
  status: number;
  identity: Record<string, unknown> | null;
}> {
  const result = await proxyBridge('/identity');
  if (!result.ok) {
    return { ok: false, status: result.status, identity: null };
  }
  return {
    ok: true,
    status: result.status,
    identity: result.body as Record<string, unknown>,
  };
}
