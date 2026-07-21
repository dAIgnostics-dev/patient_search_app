import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';
import {
  fetchCardIdentityFromBridge,
} from './cardReaderMiddleware';
import {
  cardIdentityNamesMatch,
  findAccountByUsername,
  loadAccounts,
  MOCK_CARD_LOGIN_USERNAME,
  toSessionPayload,
  type CardIdentityInput,
} from './cardAuthShared';

export interface PractitionerAccount {
  username: string;
  password: string;
  practitionerId: string;
  hzjzId: string;
  firstName: string;
  lastName: string;
  oib?: string;
}

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

export function createAuthMiddleware(accountsDir: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const url = req.url ?? '';

    if (url === '/api/auth/accounts' && req.method === 'GET') {
      const accounts = loadAccounts(accountsDir);
      sendJson(
        res,
        200,
        accounts.map(({ username, firstName, lastName, practitionerId }) => ({
          username,
          firstName,
          lastName,
          practitionerId,
        })),
      );
      return;
    }

    if (url === '/api/auth/login' && req.method === 'POST') {
      try {
        const body = (await readJsonBody(req)) as { username?: string; password?: string };
        const username = body.username?.trim();
        const password = body.password?.trim();

        if (!username || !password) {
          sendJson(res, 400, { error: 'Username and password are required.' });
          return;
        }

        const accounts = loadAccounts(accountsDir);
        const match = accounts.find((a) => a.username === username && a.password === password);

        if (!match) {
          sendJson(res, 401, { error: 'Invalid username or password.' });
          return;
        }

        sendJson(res, 200, toSessionPayload(match));
      } catch {
        sendJson(res, 400, { error: 'Invalid request body.' });
      }
      return;
    }

    if (url === '/api/auth/login-with-card' && req.method === 'POST') {
      try {
        const body = (await readJsonBody(req)) as {
          givenName?: string;
        };
        const givenName = body.givenName?.trim();

        if (!givenName) {
          sendJson(res, 400, { error: 'Name is required.' });
          return;
        }

        const bridgeResult = await fetchCardIdentityFromBridge();
        if (!bridgeResult.ok || !bridgeResult.identity) {
          const errorCode =
            bridgeResult.status === 404
              ? 'card_not_present'
              : bridgeResult.status === 503
                ? 'identity_not_available'
                : 'bridge_unavailable';
          sendJson(res, bridgeResult.status === 404 ? 404 : 503, { error: errorCode });
          return;
        }

        const accounts = loadAccounts(accountsDir);
        const cardIdentity = bridgeResult.identity as CardIdentityInput;

        if (!cardIdentityNamesMatch({ givenName }, cardIdentity)) {
          sendJson(res, 401, { error: 'card_identity_mismatch' });
          return;
        }

        const account = findAccountByUsername(accounts, MOCK_CARD_LOGIN_USERNAME);
        if (!account) {
          sendJson(res, 401, { error: 'Card is not mapped to a practitioner account.' });
          return;
        }

        sendJson(res, 200, toSessionPayload(account));
      } catch {
        sendJson(res, 400, { error: 'Invalid request body.' });
      }
      return;
    }

    next();
  };
}
