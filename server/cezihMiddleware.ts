import type { Connect } from 'vite';
import { CEZIH_CERT_ENDPOINTS } from '../src/config/cezihEndpoints';
import { CEZIH_AUTH_CHECK_URL, CEZIH_AUTH_STATUS_URL } from '../src/config/cezihOAuth';
import { CEZIH_USER_AUTH_ACTIONS, CEZIH_USER_AUTH_BASE } from '../src/config/cezihUserAuth';

/** Live requests reach Vite's allowlisted proxy only after these checks. */
export function createCezihMiddleware(live = false): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (!path.startsWith('/api/cezih/')) return next();
    const parts = path.slice('/api/cezih/'.length).split('/');
    const endpoint = CEZIH_CERT_ENDPOINTS.find((item) => item.id === parts[0]);
    const userAction = CEZIH_USER_AUTH_ACTIONS.find((action) => path === CEZIH_USER_AUTH_BASE + action);
    const authMethod = userAction ? userAction === 'status' ? 'GET' : 'POST'
      : path === CEZIH_AUTH_STATUS_URL ? 'GET' : path === CEZIH_AUTH_CHECK_URL ? 'POST' : null;
    const expectsId = endpoint?.url.includes('{id}') ?? false;
    const validPath = expectsId ? parts.length === 2 && Boolean(parts[1]) : parts.length === 1;
    const method = authMethod ?? endpoint?.method;
    const status = !authMethod && (!endpoint || !validPath) ? 404 : method !== req.method ? 405 : 503;
    if (live && status === 503 && method) {
      const address = req.socket.remoteAddress;
      const host = req.headers.host ?? '';
      const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '') &&
        /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host);
      const origin = req.headers.origin;
      const scheme = (req.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
      if (!local || (origin && origin !== `${scheme}://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') {
        res.statusCode = 403;
        res.end('CEZIH_LOCAL_ONLY: use the local application on this computer.');
        return;
      }
      if (endpoint?.id === 'oauth.token') {
        res.statusCode = 403;
        res.end('CEZIH_TOKEN_SERVER_ONLY: use the authentication status/check endpoints.');
        return;
      }
      if (expectsId) {
        let id = '';
        try { id = decodeURIComponent(parts[1]); } catch { /* Invalid escape sequence. */ }
        if (!/^[A-Za-z0-9.-]{1,64}$/.test(id) || id === '.' || id === '..') {
          res.statusCode = 400;
          res.end('Invalid FHIR resource ID.');
          return;
        }
      }
      // Browser sessions and browser-supplied tokens never authenticate the upstream call.
      for (const header of Object.keys(req.headers)) {
        if (['authorization', 'proxy-authorization', 'cookie', 'origin', 'referer', 'expect', 'mod_auth_openid_session'].includes(header) ||
          header.startsWith('x-forwarded-') || header.startsWith('x-cezih-')) delete req.headers[header];
      }
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }
    if (status === 405 && method) res.setHeader('Allow', method);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/fhir+json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      resourceType: 'OperationOutcome',
      ...(status === 503 && endpoint ? { extension: [
        { url: 'urn:cezih:offline:endpoint', valueUri: endpoint.url },
        { url: 'urn:cezih:offline:method', valueCode: endpoint.method },
      ] } : {}),
      issue: [{
        severity: 'error',
        code: status === 404 ? 'not-found' : status === 405 ? 'not-supported' : 'forbidden',
        diagnostics: status === 503
          ? 'CEZIH_NETWORK_DISABLED: OAuth2 and transport contracts are not configured; no upstream request was made.'
          : 'Unknown CEZIH route or unsupported method.',
      }],
    }));
  };
}
