import { request, type Agent } from 'node:https';
import { getCezihEndpoint } from '../src/config/cezihEndpoints';
import type { CezihAuthErrorCode, CezihAuthStatus } from '../src/config/cezihOAuth';

export class CezihTokenError extends Error {
  constructor(readonly code: CezihAuthErrorCode) {
    super(`CEZIH_AUTH_${code.toUpperCase()}`);
  }
}

export interface CezihTokenDependencies {
  request?: typeof request;
  now?: () => number;
}

export function createCezihTokenProvider(
  env: Record<string, string>, agent: Agent, applicationEndpoints: string[], deps: CezihTokenDependencies = {},
) {
  const clientId = env.CEZIH_CLIENT_ID?.trim();
  const secret = env.CEZIH_CLIENT_SECRET;
  const credentials = Boolean(clientId && secret);
  const manual = env.CEZIH_ACCESS_TOKEN?.trim();
  const authMethod = env.CEZIH_TOKEN_AUTH_METHOD || 'client_secret_basic';
  if (authMethod !== 'client_secret_basic' && authMethod !== 'client_secret_post') {
    throw new Error('CEZIH_TOKEN_AUTH_METHOD must be client_secret_basic or client_secret_post.');
  }
  const validBearer = (value: string) => /^[A-Za-z0-9._~+/-]+=*$/.test(value);
  if (manual && !validBearer(manual)) throw new Error('Invalid CEZIH_ACCESS_TOKEN.');
  const now = deps.now ?? Date.now;
  let cached: { value: string; expiresAt: number; usableUntil: number } | undefined;
  let pending: Promise<string> | undefined;
  let lastError: CezihAuthErrorCode | null = null;
  let retryAfter = 0;

  async function acquire(): Promise<string> {
    const form = new URLSearchParams({ grant_type: 'client_credentials' });
    if (env.CEZIH_SCOPE?.trim()) form.set('scope', env.CEZIH_SCOPE.trim());
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' };
    if (authMethod === 'client_secret_basic') {
      const encode = (value: string) => new URLSearchParams({ v: value }).toString().slice(2);
      headers.Authorization = `Basic ${Buffer.from(`${encode(clientId!)}:${encode(secret!)}`).toString('base64')}`;
    } else {
      form.set('client_id', clientId!);
      form.set('client_secret', secret!);
    }
    const body = form.toString();
    headers['Content-Length'] = String(Buffer.byteLength(body));
    const startedAt = now();
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const fail = () => { clearTimeout(deadline); reject(new CezihTokenError('unavailable')); };
      try {
        const req = (deps.request ?? request)(getCezihEndpoint('oauth.token').url, {
          method: 'POST', agent, headers,
        }, (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > 65536) { fail(); res.destroy(); return; }
            chunks.push(Buffer.from(chunk));
          });
          res.on('error', fail);
          res.on('aborted', fail);
          res.on('end', () => {
            clearTimeout(deadline);
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
          });
        });
        req.on('error', fail);
        deadline = setTimeout(() => { fail(); req.destroy(); }, 10000);
        req.end(body);
      } catch { fail(); }
    });
    if (response.status >= 500) throw new CezihTokenError('unavailable');
    let payload: { access_token?: unknown; token_type?: unknown; expires_in?: unknown; error?: unknown };
    try { payload = JSON.parse(response.body); }
    catch { throw new CezihTokenError(response.status === 200 ? 'invalid_response' : 'oauth_rejected'); }
    if (!payload || typeof payload !== 'object') throw new CezihTokenError('invalid_response');
    if (response.status !== 200) {
      const known = ['invalid_client', 'invalid_scope', 'unauthorized_client', 'unsupported_grant_type'] as const;
      const code = known.find((value) => value === payload.error);
      throw new CezihTokenError(code ?? 'oauth_rejected');
    }
    const lifetime = typeof payload.expires_in === 'number' ? payload.expires_in * 1000 : 0;
    if (typeof payload.access_token !== 'string' || !validBearer(payload.access_token) ||
      typeof payload.token_type !== 'string' || payload.token_type.toLowerCase() !== 'bearer' ||
      !Number.isSafeInteger(lifetime) || lifetime <= 0 || !Number.isSafeInteger(startedAt + lifetime)) {
      throw new CezihTokenError('invalid_response');
    }
    const expiresAt = startedAt + lifetime;
    const usableUntil = expiresAt - Math.min(30000, lifetime / 10);
    if (usableUntil <= now() || !Number.isFinite(new Date(expiresAt).getTime())) throw new CezihTokenError('invalid_response');
    cached = { value: payload.access_token, expiresAt, usableUntil };
    lastError = null;
    retryAfter = 0;
    return cached.value;
  }

  return {
    getStatus(): CezihAuthStatus {
      let state: CezihAuthStatus['state'] = credentials ? 'ready' : manual ? 'manual' : 'unconfigured';
      if (cached) state = cached.expiresAt > now() ? 'valid' : 'expired';
      if (lastError) state = 'error';
      if (pending) state = 'fetching';
      return {
        state, authMethod, expiresAt: cached ? new Date(cached.expiresAt).toISOString() : null,
        errorCode: lastError, applicationEndpoints: [...applicationEndpoints],
      };
    },
    async getToken(): Promise<string> {
      if (env.VITE_CEZIH_MODE !== 'cert-live') throw new CezihTokenError('unconfigured');
      if (!credentials) {
        if (manual) return manual;
        throw new CezihTokenError('unconfigured');
      }
      if (cached && cached.usableUntil > now()) return cached.value;
      if (pending) return pending;
      if (lastError && now() < retryAfter) throw new CezihTokenError(lastError);
      pending = acquire().catch((error: unknown) => {
        cached = undefined;
        lastError = error instanceof CezihTokenError ? error.code : 'unavailable';
        // Wrong credentials/scopes require a configuration change and restart, not repeated requests.
        retryAfter = ['invalid_client', 'invalid_scope', 'unauthorized_client', 'unsupported_grant_type'].includes(lastError)
          ? Infinity : now() + 5000;
        throw new CezihTokenError(lastError);
      }).finally(() => { pending = undefined; });
      return pending;
    },
    rejectToken(value: string) {
      // A late 401 for an older token must not invalidate a newer cached token.
      if (cached?.value === value) { cached = undefined; retryAfter = 0; lastError = 'upstream_unauthorized'; }
      else if (!credentials && manual === value) lastError = 'upstream_unauthorized';
    },
  };
}
