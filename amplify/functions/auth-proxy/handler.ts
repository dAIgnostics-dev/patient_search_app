import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import accounts from './accounts.json';

interface PractitionerAccount {
  username: string;
  password: string;
  practitionerId: string;
  hzjzId: string;
  firstName: string;
  lastName: string;
}

function normalizePath(rawPath: string): string {
  const collapsed = rawPath.replace(/\/+/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed || '/';
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw);
}

function isLoginPath(path: string): boolean {
  return path === '/login' || path === '/api/auth/login';
}

function isAccountsPath(path: string): boolean {
  return path === '/accounts' || path === '/api/auth/accounts';
}

export const handler: Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2> = async (event) => {
  const method = event.requestContext.http.method;
  const path = normalizePath(event.rawPath || event.requestContext.http.path || '/');

  if (method === 'OPTIONS') {
    return { statusCode: 204 };
  }

  const practitionerAccounts = accounts as PractitionerAccount[];

  if (method === 'GET' && isAccountsPath(path)) {
    return jsonResponse(
      200,
      practitionerAccounts.map(({ username, firstName, lastName, practitionerId }) => ({
        username,
        firstName,
        lastName,
        practitionerId,
      })),
    );
  }

  if (method === 'POST' && isLoginPath(path)) {
    try {
      const body = parseBody(event) as { username?: string; password?: string };
      const username = body.username?.trim();
      const password = body.password?.trim();

      if (!username || !password) {
        return jsonResponse(400, { error: 'Username and password are required.' });
      }

      const match = practitionerAccounts.find(
        (account) => account.username === username && account.password === password,
      );

      if (!match) {
        return jsonResponse(401, { error: 'Invalid username or password.' });
      }

      return jsonResponse(200, {
        practitionerId: match.practitionerId,
        hzjzId: match.hzjzId,
        firstName: match.firstName,
        lastName: match.lastName,
        username: match.username,
      });
    } catch {
      return jsonResponse(400, { error: 'Invalid request body.' });
    }
  }

  return jsonResponse(404, { error: 'Not found.' });
};
