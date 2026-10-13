import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import type { Connect, ProxyOptions } from 'vite';
import { createCezihMiddleware } from '../server/cezihMiddleware';
import { createCezihProxy } from '../server/cezihProxy';
import { CEZIH_CERT_ENDPOINTS, resolveCezihMode } from '../src/config/cezihEndpoints';
import { probeCezihEndpoint } from '../src/data/cezihEndpointProbe';

// All network APIs are blocked by offline-only.mjs; proxy events are simulated in memory.
assert.deepEqual(createCezihProxy({ VITE_CEZIH_MODE: 'mock' }, '.'), {});
assert.deepEqual(createCezihProxy({ VITE_CEZIH_MODE: 'cert-offline', CEZIH_ACCESS_TOKEN: 'demo' }, '.'), {});
assert.throws(() => createCezihProxy({ VITE_CEZIH_MODE: 'cert-live', CEZIH_CERT_FILE: 'missing.pem' }, '.'), /together/);
assert.throws(() => createCezihProxy({ VITE_CEZIH_MODE: 'cert-live', CEZIH_ACCESS_TOKEN: 'bad\r\nheader' }, '.'), /Invalid/);

const proxy = createCezihProxy({ VITE_CEZIH_MODE: 'cert-live', CEZIH_ACCESS_TOKEN: 'local-test-token' }, '.');
const routes = Object.entries(proxy);
assert.equal(routes.length, 49);
for (const endpoint of CEZIH_CERT_ENDPOINTS.filter((item) => item.method)) {
  const local = `/api/cezih/${endpoint.id}` + (endpoint.url.includes('{id}') ? '/test-123' : '') + '?_count=1&identifier=a%7Cb';
  const matches = routes.filter(([pattern]) => new RegExp(pattern).test(local));
  assert.equal(matches.length, 1, `Exactly one proxy for ${endpoint.id}`);
  const [, options] = matches[0];
  const upstream = new URL(endpoint.url.replace('{id}', 'test-123'));
  assert.equal(options.target, upstream.origin);
  assert.equal(options.rewrite!(local), upstream.pathname + '?_count=1&identifier=a%7Cb');
  assert.equal(options.headers?.Authorization, endpoint.id === 'oauth.token' ? undefined : 'Bearer local-test-token');
  assert.equal(options.secure, true);
  assert.equal(options.followRedirects, false);
  assert.equal(options.ws, false);
  assert.equal(options.agent.options.rejectUnauthorized, true);
  assert(!new RegExp(matches[0][0]).test(`/api/cezih/${endpoint.id}-unexpected`));
}

function gate(url: string, method = 'GET', live = true, extra: Record<string, string> = {}, address = '127.0.0.1') {
  const middleware = createCezihMiddleware(live);
  const req = {
    url, method, headers: { host: '127.0.0.1:5173', ...extra }, socket: { remoteAddress: address },
  } as unknown as Connect.IncomingMessage;
  let forwarded = false;
  let body = '';
  const res = { statusCode: 200, setHeader() {}, end(value: string) { body = value; } } as unknown as ServerResponse;
  middleware(req, res, () => { forwarded = true; });
  return { req, status: res.statusCode, forwarded, body };
}
assert.equal(gate('/api/cezih/Patient.search?identifier=a%7Cb').forwarded, true);
const post = gate('/api/cezih/case.manage', 'POST', true, {
  origin: 'http://127.0.0.1:5173', authorization: 'browser-token', cookie: 'session=demo', expect: '100-continue',
});
assert(post.forwarded);
assert.equal(post.req.headers.authorization, undefined);
assert.equal(post.req.headers.cookie, undefined);
assert.equal(post.req.headers.origin, undefined);
assert.equal(post.req.headers.expect, undefined);
assert.equal(gate('/api/cezih/Patient.search', 'POST').status, 405);
assert.equal(gate('/api/cezih/missing').status, 404);
assert.equal(gate('/api/cezih/Patient.search/extra').status, 404);
assert.equal(gate('/api/cezih/notification.push').forwarded, false);
assert.equal(gate('/api/cezih/Organization.read/%2Foutside').status, 400);
assert.equal(gate('/api/cezih/Organization.read/%2e%2e').status, 400);
assert.equal(gate('/api/cezih/Organization.read/%zz').status, 400);
assert.equal(gate('/api/cezih/Patient.search', 'GET', true, { origin: 'https://outside.test' }).status, 403);
assert.equal(gate('/api/cezih/Patient.search', 'GET', true, { host: 'outside.test' }).status, 403);
assert.equal(gate('/api/cezih/Patient.search', 'GET', true, { 'sec-fetch-site': 'cross-site' }).status, 403);
assert.equal(gate('/api/cezih/Patient.search', 'GET', true, {}, '192.0.2.1').status, 403);
assert.equal(gate('/api/cezih/Patient.search', 'GET', false).status, 503);

const [, patientOptions] = routes.find(([pattern]) => new RegExp(pattern).test('/api/cezih/Patient.search'))!;
const events = new EventEmitter();
patientOptions.configure!(events as Parameters<NonNullable<ProxyOptions['configure']>>[0], patientOptions);
const response = { statusCode: 401, headers: { 'set-cookie': 'secret', location: 'https://outside.test' } };
events.emit('proxyRes', response);
assert.equal(response.headers['set-cookie'], undefined);
assert.equal(response.headers.location, undefined);
assert.equal((response.headers as Record<string, string>)['x-cezih-endpoint'], 'Patient.search');
assert.equal((response.headers as Record<string, string>)['x-cezih-upstream-status'], '401');
const serverRes = new ServerResponse(new IncomingMessage(new Socket()));
let errorBody = '';
serverRes.end = ((body: string) => { errorBody = body; return serverRes; }) as typeof serverRes.end;
const errorRequest = { url: '/api/cezih/Patient.search?identifier=private-value' };
events.emit('error', new Error('sensitive detail'), errorRequest, serverRes);
assert.equal(errorRequest.url, '/api/cezih/Patient.search');
assert.equal(serverRes.statusCode, 502);
assert(errorBody.includes('CEZIH_PROXY_ERROR'));
assert(!errorBody.includes('sensitive detail'));

const oldMode = process.env.VITE_CEZIH_MODE;
const originalFetch = globalThis.fetch;
try {
  // Loading configuration does not create or listen on a Vite server.
  delete process.env.VITE_CEZIH_MODE;
  const configFactory = (await import('../vite.config')).default;
  assert.equal(typeof configFactory, 'function');
  if (typeof configFactory !== 'function') throw new Error('Expected Vite config factory.');
  const config = await configFactory({ mode: 'cert-live', command: 'serve', isPreview: false });
  assert.equal(config.server?.host, '127.0.0.1');
  assert.equal(config.server?.strictPort, true);
  assert.equal(Object.keys(config.server?.proxy ?? {}).length, 49);
  assert(config.server?.fs?.deny?.includes('**/.cezih-cert.local.json'));
  await assert.rejects(async () => configFactory({ mode: 'cert-live', command: 'build' }), /local development/);
  await assert.rejects(async () => configFactory({ mode: 'cert-live', command: 'serve', isPreview: true }), /local development/);
  const mockConfig = await configFactory({ mode: 'development', command: 'serve' });
  assert.equal(mockConfig.server?.proxy, undefined);
  process.env.VITE_CEZIH_MODE = 'mock';
  await assert.rejects(async () => configFactory({ mode: 'cert-live', command: 'serve' }), /overridden/);
  process.env.VITE_CEZIH_MODE = 'cert-live';
  assert.equal(resolveCezihMode(), 'cert-live');
  const runtime = await import('../src/config/runtime');
  const { resolveResourceSourceConfig } = await import('../src/config/resourceSource');
  assert.equal(runtime.resolveCezihApiBaseUrl(), '/api/cezih');
  assert.equal(runtime.resolveAuthApiBaseUrl(), null);
  assert.equal(runtime.resolveAuditApiBaseUrl(), null);
  assert.equal(runtime.resolveApiBaseUrl(), '/api/cezih');
  assert.equal(runtime.resolveCezihMessageUrl('case'), '/api/cezih/case.manage');
  assert.equal(resolveResourceSourceConfig().cezihBaseUrl, '/api/cezih');
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, '/api/cezih/Patient.search?_count=1');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.body, undefined);
    return new Response('Unauthorized', { status: 401, headers: {
      'x-cezih-endpoint': 'Patient.search', 'x-cezih-upstream-status': '401',
    } });
  };
  const result = await probeCezihEndpoint('Patient.search');
  assert.equal(result.status, 'responded');
  assert.equal(result.httpStatus, 401);
  assert.equal((await probeCezihEndpoint('case.manage')).status, 'postDisabled');
  assert.equal((await probeCezihEndpoint('oauth.token')).status, 'postDisabled');
  assert.equal((await probeCezihEndpoint('notification.push')).status, 'websocket');
  assert.equal(calls, 1);
  globalThis.fetch = async () => new Response('proxy error', { status: 502 });
  assert.equal((await probeCezihEndpoint('Patient.search')).status, 'failed');
} finally {
  globalThis.fetch = originalFetch;
  if (oldMode === undefined) delete process.env.VITE_CEZIH_MODE;
  else process.env.VITE_CEZIH_MODE = oldMode;
}
console.log('CEZIH live configuration validated with simulated responses; no external requests.');
