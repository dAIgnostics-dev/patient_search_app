import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';
import type { Connect, ProxyOptions } from 'vite';
import { createCezihIntegration } from '../server/cezihProxy';
import { CEZIH_USER_AUTH_BASE, CEZIH_USER_ENDPOINTS, type CezihUserAuthStatus } from '../src/config/cezihUserAuth';
import { cezihUserAuth } from '../src/data/cezihUserAuth';
import { getCezihEndpoint } from '../src/config/cezihEndpoints';
import expectedRolePolicy from './fixtures/cezih-role-policy.json';
import {
  CASE_MANAGEMENT_ROLES, ENCOUNTER_MANAGEMENT_ROLES, DOCUMENT_SEARCH_ROLES, DOCUMENT_RETRIEVE_ROLES,
  canManageCases, canManageEncounters, canSearchDocuments, canRetrieveDocuments,
} from '../src/auth/roles';
import * as caseApi from '../src/data/caseApi';
import * as encounterApi from '../src/data/encounterApi';
import * as documentApi from '../src/data/documentApi';
import type { PractitionerSession } from '../src/auth/types';

type Integration = ReturnType<typeof createCezihIntegration>;
function browser(integration: Integration) {
  let cookie: string | undefined;
  let lastRequest: Connect.IncomingMessage;
  let lastResponse: ServerResponse;
  return {
    get cookie() { return cookie; },
    set cookie(value: string | undefined) { cookie = value; },
    get req() { return lastRequest; }, get res() { return lastResponse; },
    async call(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}, secure = false) {
      const req = new Readable({ read() {} }) as Connect.IncomingMessage;
      Object.assign(req, { url: path, method, headers: {
        host: '127.0.0.1:5173', ...(cookie ? { cookie } : {}),
        ...(method !== 'GET' ? { 'x-cezih-user-action': '1' } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...extra,
      }, socket: { remoteAddress: '127.0.0.1', encrypted: secure } });
      lastRequest = req;
      const headers = new Map<string, string>();
      let finish!: (result: { code: number; status: CezihUserAuthStatus; text: string; forwarded: boolean; headers: Map<string, string>; req: typeof req }) => void;
      const done = new Promise<Parameters<typeof finish>[0]>((resolve) => { finish = resolve; });
      const res = {
        statusCode: 200, destroyed: false, writableEnded: false,
        setHeader(name: string, value: string) {
          headers.set(name, value);
          if (name === 'Set-Cookie') cookie = value.includes('Max-Age=0') ? undefined : value.split(';')[0];
        },
        end(text = '') {
          res.writableEnded = true;
          let status: CezihUserAuthStatus;
          try { status = JSON.parse(text); } catch { status = {} as CezihUserAuthStatus; }
          finish({ code: res.statusCode, status, text, forwarded: false, headers, req });
        },
      };
      lastResponse = res as unknown as ServerResponse;
      integration.middleware(req, lastResponse, () => finish({ code: res.statusCode, status: {} as CezihUserAuthStatus, text: '', forwarded: true, headers, req }));
      queueMicrotask(() => { if (body !== undefined) req.push(JSON.stringify(body)); req.push(null); });
      return done;
    },
  };
}

let time = 1700000000000;
const mock = createCezihIntegration({ VITE_CEZIH_MODE: 'mock' }, '.', { now: () => time });
const a = browser(mock), b = browser(mock);
const route = (action: string) => CEZIH_USER_AUTH_BASE + action;
const initial = await a.call(route('status'));
assert.equal(initial.status.mode, 'simulation');
assert.equal(initial.status.state, 'signed-out');
assert(initial.headers.get('Set-Cookie')?.includes('HttpOnly'));
assert(initial.headers.get('Set-Cookie')?.includes('SameSite=Lax'));
assert(!initial.text.includes(a.cookie!.split('=')[1]));
await b.call(route('status'));
assert.notEqual(a.cookie, b.cookie);
assert.equal((await a.call(route('start'), 'GET')).code, 405);
assert.equal((await a.call(route('start'), 'POST', undefined, { 'x-cezih-user-action': '' })).code, 403);
assert.equal((await a.call(route('start'), 'POST', undefined, { origin: 'https://outside.test' })).code, 403);
assert.equal((await a.call(route('start'), 'POST', undefined, { 'sec-fetch-site': 'cross-site' })).code, 403);
assert.equal((await a.call(route('callback'))).code, 404, 'No invented callback contract');
let pending = await a.call(route('start'), 'POST');
assert.equal(pending.status.state, 'pending');
const challenge = pending.status.challenge;
const pendingCookie = a.cookie;
assert(challenge);
assert.equal((await b.call(route('complete'), 'POST', { challenge, result: 'success', actor: 'ana' })).code, 409);
assert.equal((await a.call(route('complete'), 'POST', { challenge, result: 'success', actor: 'ana', roles: ['admin'] })).code, 400);
assert.equal((await a.call(route('complete'), 'POST', { challenge: '0'.repeat(64), result: 'success', actor: 'ana' })).code, 409);
const signedIn = await a.call(route('complete'), 'POST', { challenge, result: 'success', actor: 'ana' });
assert.equal(signedIn.status.state, 'authenticated');
assert.equal(signedIn.status.user?.subject, 'simulation-ana');
assert.equal(signedIn.status.challenge, null);
assert.notEqual(a.cookie, pendingCookie);
assert.equal(mock.userSessions.get(pendingCookie), undefined, 'Retired cookies cannot authorize');
assert.equal(mock.userSessions.upstream(mock.userSessions.get(a.cookie)), null);
assert.equal((await a.call(route('complete'), 'POST', { challenge, result: 'success', actor: 'ana' })).code, 409);
assert.equal((await b.call(route('status'))).status.user, null);
assert.equal((await a.call(route('test'), 'POST')).code, 200);
const denied = await a.call(route('test'), 'POST', { denied: true });
assert.equal(denied.code, 403); assert.equal(denied.status.state, 'authenticated');
assert.equal((await a.call(route('expire'), 'POST')).status.state, 'expired');
assert.equal((await a.call(route('test'), 'POST')).code, 401);
for (const result of ['cancelled', 'card-unavailable', 'denied', 'success']) {
  pending = await a.call(route('start'), 'POST');
  const completed = await a.call(route('complete'), 'POST', { challenge: pending.status.challenge, result, actor: 'luka' });
  assert.equal(completed.status.state, result === 'success' ? 'authenticated' : result);
}
time += 300001;
assert.equal((await a.call(route('status'))).status.state, 'expired');
pending = await a.call(route('start'), 'POST'); time += 60001;
assert.equal((await a.call(route('complete'), 'POST', { challenge: pending.status.challenge, result: 'success', actor: 'ana' })).code, 409);
assert.equal((await a.call(route('status'))).status.state, 'expired');
pending = await a.call(route('start'), 'POST');
const beforeComplete = a.cookie;
await a.call(route('complete'), 'POST', { challenge: pending.status.challenge, result: 'success', actor: 'ana' });
const afterComplete = a.cookie;
await a.call(route('logout'), 'POST', undefined, { cookie: beforeComplete! });
assert.equal(mock.userSessions.get(afterComplete), undefined, 'An in-flight logout revokes a newly rotated session');
assert.equal((await a.call(route('status'))).status.state, 'signed-out');
assert.equal((await a.call(route('start'), 'POST', { unknown: 'x'.repeat(5000) })).code, 400);
const tls = await browser(mock).call(route('status'), 'GET', undefined, { origin: 'https://127.0.0.1:5173' }, true);
assert(tls.headers.get('Set-Cookie')?.includes('; Secure'));

const live = createCezihIntegration({ VITE_CEZIH_MODE: 'cert-live', CEZIH_ACCESS_TOKEN: 'manual-application-token' }, '.', { now: () => time });
const liveA = browser(live), liveB = browser(live);
assert.equal((await liveA.call(route('status'))).status.state, 'not-configured');
assert.equal((await liveA.call(route('start'), 'POST')).code, 501);
assert.equal((await liveA.call(route('complete'), 'POST', { challenge, result: 'success', actor: 'ana' })).code, 501);
for (const id of CEZIH_USER_ENDPOINTS) {
  const method = getCezihEndpoint(id).method!;
  const rejected = await liveA.call(`/api/cezih/${id}`, method, undefined, { mod_auth_openid_session: 'forged', authorization: 'Bearer forged' });
  assert.equal(rejected.code, 401); assert(!rejected.forwarded);
  assert.equal(rejected.req.headers.mod_auth_openid_session, undefined);
  assert.equal(rejected.req.headers.authorization, undefined);
}
const stolenSimulationCookie = a.cookie;
liveA.cookie = stolenSimulationCookie;
assert.equal((await liveA.call('/api/cezih/Patient.search')).code, 401);
await liveA.call(route('status')); await liveB.call(route('status'));
function verified(client: ReturnType<typeof browser>, value: string, subject: string, roles = ['private_care_specialist']) {
  const session = live.userSessions.get(client.cookie)!;
  live.userSessions.completeVerified(session, { subject, displayName: subject, roles }, value, time + 600000, client.req, client.res);
  return session;
}
const sessionA = verified(liveA, 'server-only-session-A', 'verified-a');
verified(liveB, 'server-only-session-B', 'verified-b');
const callA = await liveA.call('/api/cezih/Patient.search', 'GET', undefined, { mod_auth_openid_session: 'forged' });
const callB = await liveB.call('/api/cezih/Patient.search');
assert(callA.forwarded && callB.forwarded);
assert.equal(callA.req.headers.mod_auth_openid_session, 'server-only-session-A');
assert.equal(callB.req.headers.mod_auth_openid_session, 'server-only-session-B');
assert.equal(callA.req.headers.authorization, undefined);
assert(!(await liveA.call(route('status'))).text.includes('server-only-session-A'));
const [, options] = Object.entries(live.proxy).find(([key]) => new RegExp(key).test('/api/cezih/Patient.search'))!;
const events = new EventEmitter();
options.configure!(events as Parameters<NonNullable<ProxyOptions['configure']>>[0], options);
events.emit('proxyRes', { statusCode: 403, headers: {} }, callA.req);
assert.equal((await liveA.call(route('status'))).status.state, 'authenticated');
events.emit('proxyRes', { statusCode: 401, headers: {} }, callA.req);
assert.equal((await liveA.call(route('status'))).status.state, 'expired');
assert.equal((await liveB.call('/api/cezih/Patient.search')).req.headers.mod_auth_openid_session, 'server-only-session-B');
verified(liveA, 'renewed-session-A', 'verified-a');
events.emit('proxyRes', { statusCode: 401, headers: {} }, callA.req);
assert.equal((await liveA.call(route('status'))).status.state, 'authenticated', 'Late 401 must not invalidate a newer session');
verified(liveA, 'restricted-session', 'restricted', ['unknown-role']);
assert.equal((await liveA.call('/api/cezih/case.manage', 'POST')).code, 403);
assert.equal((await liveA.call('/api/cezih/DocumentReference.search')).code, 403);
await liveA.call(route('logout'), 'POST');
assert.equal(live.userSessions.upstream(sessionA), null);
assert.throws(() => live.userSessions.completeVerified(sessionA, { subject: 'a', displayName: 'a', roles: ['specialist'] }, 'late', time + 1000, liveA.req, liveA.res));
assert.throws(() => createCezihIntegration({ VITE_CEZIH_MODE: 'cert-live', CEZIH_APPLICATION_ENDPOINTS: 'Patient.search' }, '.'), /clinical routes/);

// Independent contract from the supplied role lists: test the actual gateway in memory.
const policies = [
  { id: 'case.manage', expected: expectedRolePolicy.caseManagement, actual: CASE_MANAGEMENT_ROLES, check: canManageCases },
  { id: 'encounter.manage', expected: expectedRolePolicy.encounterManagement, actual: ENCOUNTER_MANAGEMENT_ROLES, check: canManageEncounters },
  { id: 'DocumentReference.search', expected: expectedRolePolicy.documentSearch, actual: DOCUMENT_SEARCH_ROLES, check: canSearchDocuments },
  { id: 'document.retrieve', expected: expectedRolePolicy.documentRetrieve, actual: DOCUMENT_RETRIEVE_ROLES, check: canRetrieveDocuments },
];
for (const policy of policies) {
  assert.deepEqual([...policy.actual].sort(), [...policy.expected].sort(), `${policy.id}: exact role list from the specification`);
  for (const absent of [undefined, null, '']) assert.equal(policy.check(absent), false);
}
assert.deepEqual(expectedRolePolicy.documentSearch.filter((role) => !expectedRolePolicy.documentRetrieve.includes(role)).sort(), [
  'private_care_specialistic_nurse', 'private_care_specialistic_technician', 'specialistic_nurse', 'specialistic_technician',
]);
const testedRoles = [...new Set(policies.flatMap((policy) => policy.expected)), 'unknown_role', 'clinician', 'Specialist', 'emergency_technician', 'specialist,nurse', 'resident\u200b', ' resident '];
for (const role of testedRoles) {
  const client = browser(live);
  await client.call(route('status'));
  verified(client, 'role-test-session', 'role-test-user', [role]);
  for (const policy of policies) {
    const allowed = policy.expected.includes(role.trim());
    assert.equal(policy.check(role), allowed, `${policy.id}: helper ${role}`);
    const result = await client.call(`/api/cezih/${policy.id}`, getCezihEndpoint(policy.id).method!, undefined, {
      'x-cezih-roles': 'private_care_specialist', mod_auth_openid_session: 'forged', authorization: 'Bearer forged',
    });
    assert.equal(result.forwarded, allowed, `${policy.id}: server decision for ${role}`);
    assert.equal(result.code, allowed ? 200 : 403);
    assert.equal(result.req.headers.mod_auth_openid_session, allowed ? 'role-test-session' : undefined);
    assert.equal(result.req.headers.authorization, undefined, 'An application token never bypasses user roles');
  }
  await client.call(route('logout'), 'POST');
}
const multiRoleClient = browser(live);
await multiRoleClient.call(route('status'));
verified(multiRoleClient, 'multiple-role-session', 'role-test-user', ['unknown_role', 'specialistic_nurse']);
assert((await multiRoleClient.call('/api/cezih/DocumentReference.search')).forwarded, 'One permitted role is enough');
assert.equal((await multiRoleClient.call('/api/cezih/document.retrieve')).code, 403, 'Search rights do not imply retrieve rights');
await multiRoleClient.call(route('logout'), 'POST');

// Reject before validating input or invoking any service, even when bypassing the UI.
const deniedSession: PractitionerSession = {
  practitionerId: 'role-test-user', hzjzId: 'TEST-ONLY', firstName: 'Test', lastName: 'Only',
  username: 'role-test-user', auditSessionId: 'role-test-session', role: 'unknown_role',
};
for (const operation of [caseApi.createCase, caseApi.createCaseRecurrence, caseApi.deleteCase, caseApi.updateCase,
  caseApi.relapseCase, caseApi.remissionCase, caseApi.resolveCase,
  encounterApi.createEncounter, encounterApi.updateEncounter, encounterApi.closeEncounter, encounterApi.cancelEncounter, encounterApi.reopenEncounter]) {
  const result = await operation(deniedSession, undefined as never);
  assert.equal(result.outcome, 'error');
  assert(result.issues.some((issue) => issue.code === 'forbidden'));
}
assert.deepEqual(await documentApi.searchDocuments(deniedSession, undefined as never), []);
for (const role of ['unknown_role', 'specialistic_nurse', 'specialistic_technician', 'private_care_specialistic_nurse', 'private_care_specialistic_technician']) {
  for (const operation of [documentApi.getDocumentMetadata, documentApi.getDocumentContent, documentApi.getDocumentEditDefaults]) {
    assert.equal(await operation({ ...deniedSession, role }, 'test-only'), null, `${role}: cannot retrieve documents through the app API`);
  }
}

const oldFetch = globalThis.fetch;
try {
  const ui = browser(mock);
  globalThis.fetch = async (url, init) => {
    assert(String(url).startsWith(CEZIH_USER_AUTH_BASE));
    assert.equal(init?.credentials, 'same-origin');
    if (init?.method === 'POST') assert.equal((init.headers as Record<string, string>)['X-CEZIH-User-Action'], '1');
    const result = await ui.call(String(url), init?.method, init?.body ? JSON.parse(String(init.body)) : undefined);
    return new Response(result.text, { status: result.code, headers: { 'Content-Type': 'application/json' } });
  };
  assert.equal((await cezihUserAuth()).mode, 'simulation');
  const started = await cezihUserAuth('start');
  assert.equal((await cezihUserAuth('complete', { challenge: started.challenge, result: 'success', actor: 'ana' })).state, 'authenticated');
  assert.equal((await cezihUserAuth('test')).check, 'allowed');
  await cezihUserAuth('expire');
  assert.equal((await cezihUserAuth('test')).check, 'requires-login');
  await cezihUserAuth('logout');
} finally { globalThis.fetch = oldFetch; }
console.log('CEZIH card session validated offline: simulated states, cookies, logout, replay protection, isolation, exact role policy, all roles across four gateway routes, API denials and blocked live SSO.');
