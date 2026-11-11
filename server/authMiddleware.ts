import { readdirSync, readFileSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { TLSSocket } from 'node:tls';
import type { Connect } from 'vite';

export interface PractitionerAccount {
  username: string;
  /** Absent for card-only accounts (password login disabled). */
  password?: string;
  practitionerId: string;
  hzjzId: string;
  firstName: string;
  lastName: string;
  /** Smart card certificate subject serialNumber (e.g. PNOHR-<OIB>); enables card login. */
  certSerialNumber?: string;
}

/** Extended key usage OID for TLS client authentication. */
const CLIENT_AUTH_EKU = '1.3.6.1.5.5.7.3.2';

function parseAccountFile(content: string): PractitionerAccount | null {
  const fields: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    fields[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  const { username, password, practitionerId, firstName, lastName, certSerialNumber } = fields;
  const hzjzId = fields.hzjzId ?? '';
  if (!username || !practitionerId || !firstName || !lastName) return null;
  if (!password && !certSerialNumber) return null;

  return {
    username,
    password: password || undefined,
    practitionerId,
    hzjzId,
    firstName,
    lastName,
    certSerialNumber: certSerialNumber || undefined,
  };
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

function toSession(account: PractitionerAccount) {
  return {
    practitionerId: account.practitionerId,
    hzjzId: account.hzjzId,
    firstName: account.firstName,
    lastName: account.lastName,
    username: account.username,
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Card login: the TLS layer (see vite.config.ts, mode "card") requests a client
 * certificate and verifies it against auth/ca/. Here we only accept certificates
 * that chained to that CA, are meant for client authentication, and whose
 * subject serialNumber is registered in an account file.
 * Revocation (CRL/OCSP) is NOT checked — local POC only.
 */
function handleCardLogin(req: Connect.IncomingMessage, res: ServerResponse, accountsDir: string) {
  const socket = req.socket as Partial<TLSSocket>;
  if (typeof socket.getPeerCertificate !== 'function') {
    sendJson(res, 400, { error: 'Card login requires HTTPS (npm run dev:card).' });
    return;
  }

  const cert = socket.getPeerCertificate();
  if (!cert || Object.keys(cert).length === 0) {
    sendJson(res, 401, { error: 'No card certificate presented.' });
    return;
  }

  if (!socket.authorized) {
    console.warn(`[card-login] untrusted certificate: ${String(socket.authorizationError)}`);
    sendJson(res, 401, { error: 'Card certificate is not trusted.' });
    return;
  }

  if (!cert.ext_key_usage?.includes(CLIENT_AUTH_EKU)) {
    sendJson(res, 403, { error: 'Card certificate is not valid for login.' });
    return;
  }

  const serial = firstValue((cert.subject as Record<string, string | string[] | undefined>).serialNumber);
  const match = serial
    ? loadAccounts(accountsDir).find((a) => a.certSerialNumber === serial)
    : undefined;

  if (!match) {
    sendJson(res, 403, { error: 'Card is not registered to a practitioner account.' });
    return;
  }

  sendJson(res, 200, toSession(match));
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
        const match = accounts.find(
          (a) => a.password !== undefined && a.username === username && a.password === password,
        );

        if (!match) {
          sendJson(res, 401, { error: 'Invalid username or password.' });
          return;
        }

        sendJson(res, 200, toSession(match));
      } catch {
        sendJson(res, 400, { error: 'Invalid request body.' });
      }
      return;
    }

    if (url === '/api/auth/card-login' && req.method === 'POST') {
      handleCardLogin(req, res, accountsDir);
      return;
    }

    next();
  };
}
