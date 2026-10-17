import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Agent, type RequestOptions, type request } from 'node:https';
import { mock } from 'node:test';
import { resolveConfig } from 'vite';
import type { Connect, ProxyOptions } from 'vite';
import { createCezihTokenProvider } from '../server/cezihTokenProvider';
import { createCezihIntegration } from '../server/cezihProxy';
import { getCezihEndpoint } from '../src/config/cezihEndpoints';
import { CEZIH_APPLICATION_ENDPOINTS, CEZIH_AUTH_CHECK_URL, CEZIH_AUTH_STATUS_URL } from '../src/config/cezihOAuth';
import { getCezihAuthStatus } from '../src/data/cezihAuthStatus';

const env = {
  VITE_CEZIH_MODE: 'cert-live', CEZIH_CLIENT_ID: 'test:id +', CEZIH_CLIENT_SECRET: 'test secret:&+č',
};
const tokenPayload = (token = 'test-token') => ({ access_token: token, token_type: 'Bearer', expires_in: 300, refresh_token: 'unused-refresh' });
function transport(status = 200, payload: unknown = tokenPayload()) {
  const calls: Array<{ url: string; options: RequestOptions; body: string }> = [];
  let responseStatus = status;
  let responseBody = JSON.stringify(payload);
  let hold = false;
  let failure: 'request' | 'aborted' | undefined;
  let destroyed = 0;
  const waiting: Array<() => void> = [];
  const fake = (url: string, options: RequestOptions, callback: (res: IncomingMessage) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: (body: string) => void; destroy: () => void };
    req.destroy = () => { destroyed++; };
    req.end = (body) => {
      calls.push({ url, options, body });
      const finish = () => {
        if (failure === 'request') { req.emit('error', new Error(env.CEZIH_CLIENT_SECRET)); return; }
        const res = new EventEmitter() as EventEmitter & { statusCode: number; destroy: () => void };
        res.statusCode = responseStatus;
        res.destroy = () => {};
        callback(res as unknown as IncomingMessage);
        if (failure === 'aborted') { res.emit('aborted'); return; }
        res.emit('data', Buffer.from(responseBody));
        res.emit('end');
      };
      if (hold) waiting.push(finish);
      else queueMicrotask(finish);
    };
    return req;
  };
  return {
    calls, request: fake as unknown as typeof request,
    destroyed: () => destroyed,
    reply(code: number, body: unknown) { responseStatus = code; responseBody = JSON.stringify(body); },
    raw(code: number, body: string) { responseStatus = code; responseBody = body; },
    fail(kind: 'request' | 'aborted') { failure = kind; },
    hold() { hold = true; }, release() { hold = false; waiting.splice(0).forEach((finish) => finish()); },
  };
}

let time = 1700000000000;
const basicTransport = transport();
const agent = new Agent({ rejectUnauthorized: true });
const provider = createCezihTokenProvider(env, agent, CEZIH_APPLICATION_ENDPOINTS, { request: basicTransport.request, now: () => time });
assert.equal(provider.getStatus().state, 'ready');
assert.equal(basicTransport.calls.length, 0, 'Construction and status reads never request a token');
basicTransport.hold();
const simultaneous = [provider.getToken(), provider.getToken(), provider.getToken()];
assert.equal(basicTransport.calls.length, 1);
assert.equal(provider.getStatus().state, 'fetching');
basicTransport.release();
assert.deepEqual(await Promise.all(simultaneous), ['test-token', 'test-token', 'test-token']);
const first = basicTransport.calls[0];
assert.equal(first.url, getCezihEndpoint('oauth.token').url);
assert.equal(first.options.method, 'POST');
assert.equal(first.options.agent, agent);
assert.equal(first.body, 'grant_type=client_credentials');
const headers = first.options.headers as Record<string, string>;
assert.equal(headers['Content-Type'], 'application/x-www-form-urlencoded');
assert.equal(headers['Content-Length'], String(Buffer.byteLength(first.body)));
assert.equal(Buffer.from(headers.Authorization.slice(6), 'base64').toString(), 'test%3Aid+%2B:test+secret%3A%26%2B%C4%8D');
assert.equal(provider.getStatus().state, 'valid');
assert.equal(provider.getStatus().expiresAt, new Date(time + 300000).toISOString());
assert(!JSON.stringify(provider.getStatus()).includes('test-token'));
assert(!JSON.stringify(provider.getStatus()).includes(env.CEZIH_CLIENT_SECRET));
time += 269000;
await provider.getToken();
assert.equal(basicTransport.calls.length, 1);
time += 1001;
basicTransport.reply(200, tokenPayload('renewed-token'));
assert.equal(await provider.getToken(), 'renewed-token');
assert.equal(basicTransport.calls.length, 2);
provider.rejectToken('test-token');
assert.equal(provider.getStatus().state, 'valid', 'Late 401 must not evict a newer token');
provider.rejectToken('renewed-token');
assert.equal(provider.getStatus().errorCode, 'upstream_unauthorized');
await provider.getToken();
assert.equal(basicTransport.calls.length, 3);
time += 301000;
assert.equal(provider.getStatus().state, 'expired');

const postTransport = transport();
const postProvider = createCezihTokenProvider({ ...env, CEZIH_TOKEN_AUTH_METHOD: 'client_secret_post', CEZIH_SCOPE: 'scope-a scope-b' }, agent, [], { request: postTransport.request });
await postProvider.getToken();
const post = postTransport.calls[0];
const postForm = new URLSearchParams(post.body);
assert.equal(postForm.get('client_id'), env.CEZIH_CLIENT_ID);
assert.equal(postForm.get('client_secret'), env.CEZIH_CLIENT_SECRET);
assert.equal(postForm.get('grant_type'), 'client_credentials');
assert.equal(postForm.get('scope'), 'scope-a scope-b');
assert.equal((post.options.headers as Record<string, string>).Authorization, undefined);
assert(!post.body.includes('refresh_token'));

const failures = transport(401, { error: 'invalid_client', error_description: env.CEZIH_CLIENT_SECRET });
const rejected = createCezihTokenProvider(env, agent, [], { request: failures.request, now: () => time });
await assert.rejects(rejected.getToken(), { message: 'CEZIH_AUTH_INVALID_CLIENT' });
time += 100000;
await assert.rejects(rejected.getToken(), /INVALID_CLIENT/);
assert.equal(failures.calls.length, 1, 'No retry storm or automatic Basic/POST fallback');
assert(!JSON.stringify(rejected.getStatus()).includes(env.CEZIH_CLIENT_SECRET));
for (const payload of [null, {}, { ...tokenPayload(), expires_in: -1 }, { ...tokenPayload(), token_type: 'Basic' },
  { ...tokenPayload(), access_token: 'bad\r\nheader' }, { ...tokenPayload(), expires_in: 8700000000000 }]) {
  const invalid = transport(200, payload);
  await assert.rejects(createCezihTokenProvider(env, agent, [], { request: invalid.request }).getToken(), /INVALID_RESPONSE/);
}
for (const kind of ['request', 'aborted'] as const) {
  const broken = transport(); broken.fail(kind);
  await assert.rejects(createCezihTokenProvider(env, agent, [], { request: broken.request }).getToken(), { message: 'CEZIH_AUTH_UNAVAILABLE' });
}
const stalled = transport(); stalled.hold();
mock.timers.enable({ apis: ['setTimeout'] });
try {
  const timed = createCezihTokenProvider(env, agent, [], { request: stalled.request });
  const rejectedOnTimeout = assert.rejects(timed.getToken(), /UNAVAILABLE/);
  mock.timers.tick(10000);
  await rejectedOnTimeout;
  assert.equal(stalled.destroyed(), 1);
} finally { mock.timers.reset(); }
const unavailable = transport(503, { error: 'unavailable' });
const recovering = createCezihTokenProvider(env, agent, [], { request: unavailable.request, now: () => time });
await assert.rejects(recovering.getToken(), /UNAVAILABLE/);
await assert.rejects(recovering.getToken(), /UNAVAILABLE/);
assert.equal(unavailable.calls.length, 1);
time += 5001;
unavailable.reply(200, tokenPayload());
await recovering.getToken();
assert.equal(unavailable.calls.length, 2);
for (const raw of ['not json', 'x'.repeat(65537)]) {
  const invalid = transport(); invalid.raw(200, raw);
  await assert.rejects(createCezihTokenProvider(env, agent, [], { request: invalid.request }).getToken());
}
const absent = createCezihTokenProvider({ VITE_CEZIH_MODE: 'cert-live' }, agent, [], { request: failures.request });
await assert.rejects(absent.getToken(), /UNCONFIGURED/);
assert.equal(absent.getStatus().state, 'unconfigured');
const disabled = createCezihTokenProvider({ ...env, VITE_CEZIH_MODE: 'cert-offline' }, agent, [], { request: failures.request });
await assert.rejects(disabled.getToken(), /UNCONFIGURED/);
assert.equal(failures.calls.length, 1);
assert.throws(() => createCezihTokenProvider({ ...env, CEZIH_TOKEN_AUTH_METHOD: 'unsupported' }, agent, []), /AUTH_METHOD/);

function local(integration: ReturnType<typeof createCezihIntegration>, url: string, method = 'GET', extra: Record<string, string> = {}) {
  const req = { url, method, headers: { host: '127.0.0.1:5173', ...extra }, socket: { remoteAddress: '127.0.0.1' } } as unknown as Connect.IncomingMessage;
  let resolve!: (value: { req: typeof req; status: number; body: string; forwarded: boolean }) => void;
  const done = new Promise<Parameters<typeof resolve>[0]>((finish) => { resolve = finish; });
  const res = {
    statusCode: 200, setHeader() {},
    end(body: string) { resolve({ req, status: res.statusCode, body, forwarded: false }); },
  } as unknown as ServerResponse;
  integration.middleware(req, res, () => resolve({ req, status: res.statusCode, body: '', forwarded: true }));
  return done;
}
const liveTransport = transport();
const integration = createCezihIntegration(env, '.', { request: liveTransport.request });
assert.equal((await local(integration, CEZIH_AUTH_STATUS_URL)).status, 200);
assert.equal(liveTransport.calls.length, 0);
assert.equal((await local(integration, CEZIH_AUTH_CHECK_URL, 'GET')).status, 405);
assert.equal((await local(integration, CEZIH_AUTH_CHECK_URL, 'POST', { origin: 'https://outside.test' })).status, 403);
assert.equal((await local(integration, '/api/cezih/oauth.token', 'POST')).status, 403);
assert.equal(liveTransport.calls.length, 0);
const clinical = await local(integration, '/api/cezih/Patient.search', 'GET', { authorization: 'browser-token' });
assert.equal(clinical.status, 401);
assert(!clinical.forwarded);
assert.equal(clinical.req.headers.authorization, undefined, 'No application token for clinical calls');
await local(integration, '/not-cezih/CodeSystem.search');
assert.equal(liveTransport.calls.length, 0);
const checked = await local(integration, CEZIH_AUTH_CHECK_URL, 'POST');
assert.equal(JSON.parse(checked.body).state, 'valid');
assert(!checked.body.includes('test-token'));
const application = await local(integration, '/api/cezih/CodeSystem.search');
assert(application.forwarded);
assert.equal(application.req.headers.authorization, 'Bearer test-token');
assert.equal(liveTransport.calls.length, 1);
const codeOptions = Object.entries(integration.proxy).find(([key]) => new RegExp(key).test('/api/cezih/CodeSystem.search'))![1];
const events = new EventEmitter();
codeOptions.configure!(events as Parameters<NonNullable<ProxyOptions['configure']>>[0], codeOptions);
events.emit('proxyRes', { statusCode: 403, headers: {} }, application.req);
await local(integration, '/api/cezih/CodeSystem.search');
assert.equal(liveTransport.calls.length, 1, '403 does not refresh the token');
events.emit('proxyRes', { statusCode: 401, headers: {} }, application.req);
await local(integration, '/api/cezih/CodeSystem.search');
assert.equal(liveTransport.calls.length, 2, '401 invalidates the token for the next call without replaying requests');
const missingIntegration = createCezihIntegration({ VITE_CEZIH_MODE: 'cert-live' }, '.');
const missing = await local(missingIntegration, '/api/cezih/ValueSet.search');
assert.equal(missing.status, 503);
assert(!missing.forwarded);
assert(missing.body.includes('CEZIH_AUTH_UNCONFIGURED'));
const manualIntegration = createCezihIntegration({ VITE_CEZIH_MODE: 'cert-live', CEZIH_ACCESS_TOKEN: 'manual-token' }, '.');
assert.equal(JSON.parse((await local(manualIntegration, CEZIH_AUTH_CHECK_URL, 'POST')).body).state, 'manual');
assert.equal((await local(manualIntegration, '/api/cezih/ValueSet.search')).req.headers.authorization, 'Bearer manual-token');
assert.equal((await local(manualIntegration, '/api/cezih/Patient.search')).status, 401);
assert.equal((await local(manualIntegration, '/api/cezih/Patient.search')).req.headers.authorization, undefined);
assert.throws(() => createCezihIntegration({ ...env, CEZIH_APPLICATION_ENDPOINTS: 'missing' }, '.'), /endpoint IDs/);
for (const mode of ['mock', 'cert-offline']) {
  const offline = createCezihIntegration({ ...env, VITE_CEZIH_MODE: mode }, '.', { request: liveTransport.request });
  assert.equal((await local(offline, '/api/cezih/CodeSystem.search')).status, 503);
}
assert.equal(liveTransport.calls.length, 2);

const originalFetch = globalThis.fetch;
try {
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, calls++ === 0 ? CEZIH_AUTH_STATUS_URL : CEZIH_AUTH_CHECK_URL);
    assert.equal(init?.method, calls === 1 ? 'GET' : 'POST');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.body, undefined);
    return Response.json(provider.getStatus());
  };
  await getCezihAuthStatus(); await getCezihAuthStatus(true);
  assert.equal(calls, 2);
  globalThis.fetch = async () => Response.json({ ...provider.getStatus(), errorCode: 'unsafe text' });
  await assert.rejects(getCezihAuthStatus(), /Invalid CEZIH authentication status/);
} finally { globalThis.fetch = originalFetch; }

const canaries = { VITE_CEZIH_MODE: 'cert-live', CEZIH_CLIENT_ID: 'private-config-id', CEZIH_CLIENT_SECRET: 'private-config-secret' };
const previous = Object.fromEntries(Object.keys(canaries).map((key) => [key, process.env[key]]));
try {
  Object.assign(process.env, canaries);
  // Resolving Vite configuration neither starts the server nor requests a token.
  const resolved = await resolveConfig({ mode: 'cert-live', logLevel: 'silent' }, 'serve');
  assert.equal(resolved.env.CEZIH_CLIENT_SECRET, undefined);
  assert.equal(resolved.env.CEZIH_CLIENT_ID, undefined);
  assert(!JSON.stringify(resolved.env).includes(canaries.CEZIH_CLIENT_SECRET));
  assert(!JSON.stringify(resolved.server.proxy).includes(canaries.CEZIH_CLIENT_SECRET));
} finally {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
console.log('CEZIH OAuth validated offline: Basic/POST encoding, expiry, concurrency, errors, route isolation and safe status.');
