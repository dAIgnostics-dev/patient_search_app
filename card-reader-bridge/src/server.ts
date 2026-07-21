import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createCardReaderService, resolveBridgeMode } from './cardReaderService.js';
import type { CardIdentity } from './types.js';

const DEFAULT_PORT = 4711;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
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

async function main(): Promise<void> {
  const mode = resolveBridgeMode();
  const port = Number(process.env.CARD_READER_BRIDGE_PORT ?? DEFAULT_PORT);
  const cardReader = await createCardReaderService(mode);

  const server = createServer(async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && url === '/status') {
      sendJson(res, 200, await cardReader.getStatus());
      return;
    }

    if (method === 'GET' && url === '/identity') {
      const identity = await cardReader.readIdentity();
      if (!identity) {
        const status = await cardReader.getStatus();
        if (!status.cardPresent) {
          sendJson(res, 404, { error: 'card_not_present' });
          return;
        }
        sendJson(res, 503, {
          error: 'identity_not_available',
          pkcs11Configured: status.pkcs11Configured ?? Boolean(process.env.PKCS11_MODULE?.trim()),
          mode,
        });
        return;
      }

      sendJson(res, 200, identity satisfies CardIdentity);
      return;
    }

    if (mode === 'mock' && method === 'POST' && url === '/mock/insert') {
      try {
        const body = (await readJsonBody(req)) as { cardId?: string };
        const cardId = body.cardId?.trim();
        if (!cardId) {
          sendJson(res, 400, { error: 'cardId is required' });
          return;
        }
        cardReader.mockInsert(cardId);
        sendJson(res, 200, { ok: true, cardId });
      } catch {
        sendJson(res, 400, { error: 'invalid_request' });
      }
      return;
    }

    if (mode === 'mock' && method === 'POST' && url === '/mock/remove') {
      cardReader.mockRemove();
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'not_found' });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[card-reader-bridge] listening on http://127.0.0.1:${port} (mode=${mode})`);
  });

  const shutdown = () => {
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[card-reader-bridge] fatal:', error);
  process.exit(1);
});
