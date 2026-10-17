import { readFileSync } from 'node:fs';
import { ServerResponse } from 'node:http';
import { Agent } from 'node:https';
import path from 'node:path';
import type { Connect, ProxyOptions } from 'vite';
import { CEZIH_CERT_ENDPOINTS } from '../src/config/cezihEndpoints';
import { CEZIH_APPLICATION_ENDPOINTS, CEZIH_AUTH_CHECK_URL, CEZIH_AUTH_STATUS_URL } from '../src/config/cezihOAuth';
import { createCezihMiddleware } from './cezihMiddleware';
import { createCezihTokenProvider, CezihTokenError, type CezihTokenDependencies } from './cezihTokenProvider';
import { CEZIH_USER_ENDPOINTS } from '../src/config/cezihUserAuth';
import { createCezihUserAuth } from './cezihUserAuth';
import type { IncomingMessage } from 'node:http';
import { canManageCases, canManageEncounters, canSearchDocuments, canRetrieveDocuments } from '../src/auth/roles';

/** Vite streams request/response bodies unchanged; target hosts come only from the catalogue. */
export function createCezihIntegration(env: Record<string, string>, root: string, deps: CezihTokenDependencies = {}) {
  const live = env.VITE_CEZIH_MODE === 'cert-live';
  const userAuth = createCezihUserAuth(live, deps.now);
  if (!live) {
    const offlineGate = createCezihMiddleware();
    const middleware: Connect.NextHandleFunction = (req, res, next) => userAuth.middleware(req, res, () => offlineGate(req, res, next));
    return { proxy: {}, middleware, userSessions: userAuth.sessions };
  }
  if (Boolean(env.CEZIH_CERT_FILE) !== Boolean(env.CEZIH_KEY_FILE)) {
    throw new Error('CEZIH_CERT_FILE and CEZIH_KEY_FILE must be configured together.');
  }
  const token = env.CEZIH_ACCESS_TOKEN?.trim();
  const pem = (name: string) => env[name] ? readFileSync(path.resolve(root, env[name])) : undefined;
  const agent = new Agent({
    rejectUnauthorized: true,
    ca: pem('CEZIH_CA_FILE'), cert: pem('CEZIH_CERT_FILE'), key: pem('CEZIH_KEY_FILE'),
  });
  const applicationEndpoints = env.CEZIH_APPLICATION_ENDPOINTS === undefined ? CEZIH_APPLICATION_ENDPOINTS
    : env.CEZIH_APPLICATION_ENDPOINTS.split(',').map((id) => id.trim()).filter(Boolean);
  if (!applicationEndpoints.length || applicationEndpoints.some((id) =>
    CEZIH_USER_ENDPOINTS.includes(id) || !CEZIH_CERT_ENDPOINTS.some((endpoint) => endpoint.id === id && endpoint.method && id !== 'oauth.token'))) {
    throw new Error('CEZIH_APPLICATION_ENDPOINTS must list known HTTP endpoint IDs, excluding clinical routes and oauth.token.');
  }
  const auth = createCezihTokenProvider(env, agent, applicationEndpoints, deps);
  const gate = createCezihMiddleware(true);
  const requestSessions = new WeakMap<IncomingMessage, { session: NonNullable<ReturnType<typeof userAuth.sessions.get>>; value: string }>();
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    userAuth.middleware(req, res, () => {
      if (!(req.url ?? '').startsWith('/api/cezih/')) return next();
      const cookie = req.headers.cookie;
      gate(req, res, () => {
        const pathname = (req.url ?? '').split('?')[0];
        const id = pathname.slice('/api/cezih/'.length).split('/')[0];
        async function authorize() {
          if (pathname === CEZIH_AUTH_STATUS_URL || pathname === CEZIH_AUTH_CHECK_URL) {
            if (pathname === CEZIH_AUTH_CHECK_URL) {
              try { await auth.getToken(); } catch { /* The safe status below describes the failure. */ }
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(auth.getStatus()));
            return;
          }
          if (CEZIH_USER_ENDPOINTS.includes(id)) {
            const session = userAuth.sessions.get(cookie);
            const value = userAuth.sessions.upstream(session);
            if (!value || !session) {
              res.statusCode = 401; res.setHeader('Content-Type', 'application/fhir+json');
              res.end(JSON.stringify({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'login',
                diagnostics: 'CEZIH_USER_AUTH_REQUIRED: verified smart-card SSO session is not available; the SSO handoff contract is not configured.' }] }));
              return;
            }
            const roleCheck = id === 'case.manage' ? canManageCases : id === 'encounter.manage' ? canManageEncounters
              : id === 'DocumentReference.search' ? canSearchDocuments : id === 'document.retrieve' ? canRetrieveDocuments : null;
            if (roleCheck && !session.user?.roles.some(roleCheck)) {
              res.statusCode = 403; res.setHeader('Content-Type', 'application/fhir+json');
              res.end(JSON.stringify({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'forbidden',
                diagnostics: 'CEZIH_USER_ROLE_FORBIDDEN: the verified user has no permitted role for this operation.' }] }));
              return;
            }
            req.headers.mod_auth_openid_session = value;
            requestSessions.set(req, { session, value });
          } else if (applicationEndpoints.includes(id)) req.headers.authorization = `Bearer ${await auth.getToken()}`;
          else if (pathname.startsWith('/api/cezih/') && token) req.headers.authorization = `Bearer ${token}`;
          if (!res.destroyed) next();
        }
        void authorize().catch((error: unknown) => {
          if (res.destroyed || res.writableEnded) return;
          res.statusCode = error instanceof CezihTokenError && error.code === 'unconfigured' ? 503 : 502;
          res.setHeader('Content-Type', 'application/fhir+json');
          res.end(JSON.stringify({ resourceType: 'OperationOutcome', issue: [{
            severity: 'error', code: 'security', diagnostics: error instanceof CezihTokenError ? error.message : 'CEZIH_AUTH_UNAVAILABLE',
          }] }));
        });
      });
    });
  };
  const proxy: Record<string, ProxyOptions> = Object.fromEntries(CEZIH_CERT_ENDPOINTS.filter((endpoint) =>
    endpoint.method && endpoint.id !== 'oauth.token').map((endpoint) => {
      const target = new URL(endpoint.url);
      const localPath = `/api/cezih/${endpoint.id}`;
      const pattern = '^' + localPath.replace(/\./g, '\\.') + '(?:/|\\?|$)';
      const options: ProxyOptions = {
        target: target.origin, agent, secure: true, changeOrigin: true, ws: false,
        followRedirects: false, proxyTimeout: 10000, timeout: 15000,
        rewrite(url) {
          const [pathname] = url.split('?');
          const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
          const id = pathname.slice(localPath.length + 1);
          return target.pathname.replace('%7Bid%7D', encodeURIComponent(decodeURIComponent(id))) + query;
        },
        configure(proxy) {
          proxy.on('proxyRes', (response, req) => {
            const userSession = req && requestSessions.get(req);
            if (response.statusCode === 401 && userSession) userAuth.sessions.invalidate(userSession.session, userSession.value);
            if (response.statusCode === 401 && applicationEndpoints.includes(endpoint.id)) {
              const authorization = req.headers.authorization;
              if (authorization?.startsWith('Bearer ')) auth.rejectToken(authorization.slice(7));
            }
            delete response.headers['set-cookie'];
            delete response.headers.location;
            response.headers['cache-control'] = 'no-store';
            response.headers['x-cezih-endpoint'] = endpoint.id;
            response.headers['x-cezih-upstream-status'] = String(response.statusCode);
          });
          proxy.on('error', (_error, req, res) => {
            // Vite's default error logger must not print patient search parameters.
            req.url = localPath;
            if (!(res instanceof ServerResponse) || res.headersSent || res.writableEnded) return;
            res.writeHead(502, { 'Content-Type': 'application/fhir+json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({
              resourceType: 'OperationOutcome',
              issue: [{ severity: 'error', code: 'transient', diagnostics:
                'CEZIH_PROXY_ERROR: no upstream response; check VPN, DNS, TLS certificates and connectivity.' }],
            }));
          });
        },
      };
      return [pattern, options];
    }));
  return { proxy, middleware, userSessions: userAuth.sessions };
}
