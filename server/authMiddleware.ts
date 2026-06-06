import { readdirSync, readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Connect } from 'vite';

export interface PractitionerAccount {
  username: string;
  password: string;
  practitionerId: string;
  hzjzId: string;
  firstName: string;
  lastName: string;
}

function parseAccountFile(content: string): PractitionerAccount | null {
  const fields: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    fields[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  const { username, password, practitionerId, hzjzId, firstName, lastName } = fields;
  if (!username || !password || !practitionerId || !hzjzId || !firstName || !lastName) {
    return null;
  }

  return { username, password, practitionerId, hzjzId, firstName, lastName };
}

function loadAccounts(accountsDir: string): PractitionerAccount[] {
  const files = readdirSync(accountsDir).filter((f) => f.endsWith('.txt'));
  const accounts: PractitionerAccount[] = [];

  for (const file of files) {
    const content = readFileSync(join(accountsDir, file), 'utf8');
    const account = parseAccountFile(content);
    if (account) accounts.push(account);
  }

  return accounts;
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

        sendJson(res, 200, {
          practitionerId: match.practitionerId,
          hzjzId: match.hzjzId,
          firstName: match.firstName,
          lastName: match.lastName,
          username: match.username,
        });
      } catch {
        sendJson(res, 400, { error: 'Invalid request body.' });
      }
      return;
    }

    next();
  };
}
