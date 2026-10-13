import { readFileSync } from 'node:fs';
import { ServerResponse } from 'node:http';
import { Agent } from 'node:https';
import path from 'node:path';
import type { ProxyOptions } from 'vite';
import { CEZIH_CERT_ENDPOINTS } from '../src/config/cezihEndpoints';

/** Vite streams request/response bodies unchanged; target hosts come only from the catalogue. */
export function createCezihProxy(env: Record<string, string>, root: string): Record<string, ProxyOptions> {
  if (env.VITE_CEZIH_MODE !== 'cert-live') return {};
  if (Boolean(env.CEZIH_CERT_FILE) !== Boolean(env.CEZIH_KEY_FILE)) {
    throw new Error('CEZIH_CERT_FILE and CEZIH_KEY_FILE must be configured together.');
  }
  const token = env.CEZIH_ACCESS_TOKEN?.trim();
  if (token && /[\r\n]/.test(token)) throw new Error('Invalid CEZIH_ACCESS_TOKEN.');
  const pem = (name: string) => env[name] ? readFileSync(path.resolve(root, env[name])) : undefined;
  const agent = new Agent({
    rejectUnauthorized: true,
    ca: pem('CEZIH_CA_FILE'), cert: pem('CEZIH_CERT_FILE'), key: pem('CEZIH_KEY_FILE'),
  });
  return Object.fromEntries(CEZIH_CERT_ENDPOINTS.filter((endpoint) => endpoint.method).map((endpoint) => {
    const target = new URL(endpoint.url);
    const localPath = `/api/cezih/${endpoint.id}`;
    const pattern = '^' + localPath.replace(/\./g, '\\.') + '(?:/|\\?|$)';
    const options: ProxyOptions = {
      target: target.origin, agent, secure: true, changeOrigin: true, ws: false,
      followRedirects: false, proxyTimeout: 10000, timeout: 15000,
      headers: token && endpoint.id !== 'oauth.token' ? { Authorization: `Bearer ${token}` } : {},
      rewrite(url) {
        const [pathname] = url.split('?');
        const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
        const id = pathname.slice(localPath.length + 1);
        return target.pathname.replace('%7Bid%7D', encodeURIComponent(decodeURIComponent(id))) + query;
      },
      configure(proxy) {
        proxy.on('proxyRes', (response) => {
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
}
