import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import type { Connect } from 'vite';
import type { ServerResponse } from 'node:http';
import { CEZIH_CERT_ENDPOINTS, getCezihEndpoint, cezihProxyUrl } from '../src/config/cezihEndpoints';
import { createCezihMiddleware } from '../server/cezihMiddleware';
import { CezihFhirClient } from '../src/data/fhir-client/cezihClient';
import { cezihFetch } from '../src/data/fhir-client/cezihFetch';
import { CezihMhdClient } from '../src/data/mhd-client/cezihMhdClient';
import { CEZIH_MBO_SYSTEM, CEZIH_VISIT_SYSTEM, type FhirMessageBundle, type FhirPatient, type FhirClinicalDocumentBundle } from '../src/fhir/types';
import { CezihAppRepository } from '../src/data/repositories/cezihAppRepository';
import { validateSubmitDocumentInput } from '../src/data/document-management/validateSubmitDocumentInput';
import { createDocumentManagementService } from '../src/data/services/documentManagementService';
import { MockDocumentExchangeRepository } from '../src/data/repositories/document-exchange/baseDocumentExchangeRepository';
import { probeCezihEndpoint } from '../src/data/cezihEndpointProbe';

process.env.VITE_CEZIH_MODE = 'cert-offline';
const { resolveCezihMessageUrl, resolveCezihMhdUrl, resolveApiBaseUrl, resolveAuthApiBaseUrl, resolveAuditAccessUrl } = await import('../src/config/runtime');
const { getCezihMessageClient, resetCezihMessageClient } = await import('../src/data/fhir-client/cezihMessageClientFactory');
const originalFetch = globalThis.fetch;
const middleware = createCezihMiddleware();

function gateway(url: string, method = 'GET') {
  let body = '';
  const headers = new Map<string, string>();
  const response = {
    statusCode: 0,
    setHeader(key: string, value: string) { headers.set(key, value); },
    end(value: string) { body = value; },
  };
  middleware({ url, method } as Connect.IncomingMessage, response as unknown as ServerResponse, () => assert.fail('Route unexpectedly fell through'));
  return { status: response.statusCode, body: JSON.parse(body), headers };
}

try {
  assert.equal(resolveApiBaseUrl(), '/api/cezih');
  assert.equal(resolveAuthApiBaseUrl(), null);
  assert.equal(resolveAuditAccessUrl(), '/api/audit/access');
  assert.equal(CEZIH_CERT_ENDPOINTS.length, 50);
  assert.equal(new Set(CEZIH_CERT_ENDPOINTS.map((item) => item.id)).size, 50);
  assert.equal(getCezihEndpoint('notification.push').method, null);
  assert.equal(new URL(getCezihEndpoint('notification.push').url).protocol, 'wss:');
  for (const endpoint of CEZIH_CERT_ENDPOINTS) {
    if (endpoint.method === null) continue;
    const path = cezihProxyUrl(endpoint.id) + (endpoint.url.includes('{id}') ? '/offline-id' : '');
    const response = gateway(path, endpoint.method);
    assert.equal(response.status, 503);
    assert.match(response.body.issue[0].diagnostics, /CEZIH_NETWORK_DISABLED/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(gateway('/api/cezih/unknown').status, 404);
  assert.equal(gateway('/api/cezih/Patient.search/extra').status, 404);
  assert.equal(gateway('/api/cezih/Patient.search', 'POST').status, 405);
  assert.equal(gateway('/api/cezih/notification.push').status, 405);
  process.env.CEZIH_NETWORK_ENABLED = 'true';
  assert.equal(gateway('/api/cezih/oauth.token', 'POST').status, 503);
  delete process.env.CEZIH_NETWORK_ENABLED;
  assert.throws(() => cezihFetch(getCezihEndpoint('oauth.token').url), /Direct CEZIH network access is disabled/);
  assert.throws(() => cezihFetch('//certws2.cezih.hr/'), /Direct CEZIH network access is disabled/);

  let probeRequests = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith('/api/cezih/'));
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.body, undefined);
    assert.equal(init?.redirect, 'error');
    probeRequests++;
    const response = gateway(url, init?.method);
    return Response.json(response.body, { status: response.status });
  };
  for (const endpoint of CEZIH_CERT_ENDPOINTS) {
    const result = await probeCezihEndpoint(endpoint.id);
    assert.equal(result.status, endpoint.method ? 'verified' : 'websocket');
    assert.equal(result.httpStatus, endpoint.method ? 503 : null);
  }
  assert.equal(probeRequests, 49, 'The WebSocket entry must not open a connection.');
  globalThis.fetch = async () => Response.json({ resourceType: 'OperationOutcome', issue: [{ diagnostics: 'CEZIH_NETWORK_DISABLED:' }] }, { status: 503 });
  assert.equal((await probeCezihEndpoint('case.manage')).status, 'failed', '503 alone does not prove correct routing.');
  globalThis.fetch = async () => {
    const response = gateway('/api/cezih/encounter.manage', 'POST');
    return Response.json(response.body, { status: response.status });
  };
  assert.equal((await probeCezihEndpoint('case.manage')).status, 'failed', 'A different upstream endpoint must not pass.');
  globalThis.fetch = async () => { throw new Error('Offline gateway unavailable'); };
  assert.equal((await probeCezihEndpoint('case.manage')).status, 'failed');
  globalThis.fetch = async () => new Response('Not JSON', { status: 404 });
  assert.equal((await probeCezihEndpoint('case.manage')).httpStatus, 404);

  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fixturePath = '.cezih-cert.local.json';
  const fixture = existsSync(fixturePath) ? JSON.parse(readFileSync(fixturePath, 'utf8')) : {
    testPatient: { mbo: '180223069', firstName: 'Offline', lastName: 'Fixture' },
  };
  const patient: FhirPatient = {
    resourceType: 'Patient', id: 'offline-fixture-patient',
    identifier: [{ system: CEZIH_MBO_SYSTEM, value: fixture.testPatient.mbo }],
    name: [{ given: [fixture.testPatient.firstName], family: fixture.testPatient.lastName }],
  };
  const client = new CezihFhirClient('/api/cezih');
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith('/api/cezih/'), 'Tests may only simulate local gateway URLs.');
    requests.push({ url, init });
    if (url.startsWith('/api/cezih/Organization.read/')) {
      return Response.json({ resourceType: 'Organization', id: decodeURIComponent(url.split('/').at(-1)!) });
    }
    const resource = url.startsWith('/api/cezih/Patient.search') ? patient : null;
    return Response.json({ resourceType: 'Bundle', type: 'searchset', total: resource ? 1 : 0, entry: resource ? [{ resource }] : [] });
  };
  const found = await new CezihAppRepository(client).findPatientByMbo(fixture.testPatient.mbo);
  assert.equal(found?.mbo, fixture.testPatient.mbo);
  assert.equal(found?.firstName, fixture.testPatient.firstName);
  assert.equal(found?.lastName, fixture.testPatient.lastName);
  assert.equal(new URL(requests[0].url, 'http://offline.invalid').searchParams.get('identifier'), fixture.testPatient.mbo);
  assert.equal((await client.read('Patient', patient.id))?.id, patient.id);
  await client.read('Organization', 'org /id');
  assert.equal(requests.at(-1)?.url, '/api/cezih/Organization.read/org%20%2Fid');

  let page = 0;
  globalThis.fetch = async (input) => {
    assert.ok(String(input).startsWith('/api/cezih/Patient.search'));
    page++;
    return Response.json({ resourceType: 'Bundle', type: 'searchset', entry: [{ resource: { ...patient, id: `page-${page}` } }],
      link: page === 1 ? [{ relation: 'next', url: `${getCezihEndpoint('Patient.search').url}?page=2` }] : [],
    });
  };
  assert.equal((await client.searchAll('Patient')).length, 2);
  globalThis.fetch = async () => Response.json({ resourceType: 'Bundle', type: 'searchset', entry: [], link: [{ relation: 'next', url: 'https://unlisted.invalid/Patient' }] });
  await assert.rejects(client.searchAll('Patient'), /outside the configured endpoint/);
  globalThis.fetch = async () => Response.json({ resourceType: 'Bundle', type: 'searchset', entry: [], link: [{ relation: 'next', url: `${getCezihEndpoint('Patient.search').url}?page=2` }] });
  await assert.rejects(client.searchAll('Patient'), /cycle/);

  requests.length = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith('/api/cezih/'));
    requests.push({ url, init });
    return Response.json(JSON.parse(String(init?.body)));
  };
  const message: FhirMessageBundle = { resourceType: 'Bundle', type: 'message', id: 'offline-message', entry: [] };
  resetCezihMessageClient();
  assert.notEqual(resolveCezihMessageUrl('case'), resolveCezihMessageUrl('encounter'));
  await getCezihMessageClient('case').postMessage(message);
  await getCezihMessageClient('encounter').postMessage(message);
  assert.deepEqual(requests.map((item) => item.url), ['/api/cezih/case.manage', '/api/cezih/encounter.manage']);
  assert.ok(requests.every((item) => item.init?.method === 'POST'));

  const mhd = new CezihMhdClient(resolveCezihMhdUrl()!);
  const document: FhirClinicalDocumentBundle = { resourceType: 'Bundle', type: 'document', id: 'offline-document', entry: [] };
  const beforeRegistration = requests.length;
  await assert.rejects(mhd.submitDocument({ bundle: document }), /response contract/);
  assert.equal(requests.length, beforeRegistration);
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.ok(url.startsWith('/api/cezih/DocumentReference.search?'));
    requests.push({ url });
    return Response.json({ resourceType: 'Bundle', type: 'searchset', entry: [], total: 0 });
  };
  await mhd.searchDocuments({ patientMbo: fixture.testPatient.mbo, dateFrom: '2026-01-01', dateTo: '2026-12-31' });
  assert.deepEqual(new URL(requests.at(-1)!.url, 'http://offline.invalid').searchParams.getAll('date'), ['ge2026-01-01', 'le2026-12-31']);
  let documentPage = 0;
  globalThis.fetch = async (input) => {
    assert.ok(String(input).startsWith('/api/cezih/DocumentReference.search?'));
    documentPage++;
    return Response.json({ resourceType: 'Bundle', type: 'searchset', total: 2, entry: [{ resource: {
      resourceType: 'DocumentReference', id: `offline-doc-${documentPage}`,
      extension: [{ url: 'http://fhir.cezih.hr/specifikacije/StructureDefinition/hr-clinical-document-summary',
        extension: [{ url: 'compositionStatus', valueCode: documentPage === 1 ? 'final' : 'preliminary' }] }],
    } }], link: documentPage === 1 ? [{ relation: 'next', url: `${getCezihEndpoint('DocumentReference.search').url}?page=2` }] : [] });
  };
  assert.equal((await mhd.searchDocuments({ compositionStatus: 'final' })).total, 1);
  assert.equal(documentPage, 2);
  const count = requests.length;
  await assert.rejects(mhd.retrieveDocument({ documentReferenceId: 'doc' }), /ITI-68/);
  await assert.rejects(mhd.updateDocument({ bundle: document, replacesDocumentReferenceId: 'doc' }), /replacement contract/);
  await assert.rejects(mhd.cancelDocument({ documentReferenceId: 'doc' }), /cancellation contract/);
  assert.equal(requests.length, count);

  // A CERT-only encounter must validate through the supplied client, not the mock store.
  globalThis.fetch = async (input) => {
    assert.ok(String(input).startsWith('/api/cezih/Encounter.search?'));
    return Response.json({ resourceType: 'Bundle', type: 'searchset', entry: [{ resource: {
      resourceType: 'Encounter', id: 'cert-only', status: 'in-progress',
      identifier: [{ system: CEZIH_VISIT_SYSTEM, value: 'offline-cert-visit' }],
    } }] });
  };
  assert.deepEqual(await validateSubmitDocumentInput({ patientMbo: fixture.testPatient.mbo, encounterVisitId: 'offline-cert-visit',
    practitionerHzjzId: 'offline-clinician', organizationHzzoCode: 'offline-org', typeCode: '011', anamnesisText: 'Offline check', outcomeCode: '1',
  }, 'offline-clinician', client), []);
  globalThis.fetch = async (input, init) => Response.json(gateway(String(input), init?.method).body, { status: 503 });
  await assert.rejects(client.search('Patient'), /CEZIH_NETWORK_DISABLED/);
  const blockedSubmission = await createDocumentManagementService(new MockDocumentExchangeRepository(), undefined, client).submitDocument(
    { clinicianId: 'offline', hzjzId: 'offline', role: 'clinician' },
    { patientMbo: fixture.testPatient.mbo, encounterVisitId: 'offline-cert-visit', practitionerHzjzId: 'offline',
      organizationHzzoCode: 'offline', typeCode: '011', anamnesisText: 'Offline check', outcomeCode: '1' },
  );
  assert.equal(blockedSubmission.outcome, 'error');
  if (blockedSubmission.outcome === 'error') assert.match(blockedSubmission.issues[0].diagnostics!, /CEZIH_NETWORK_DISABLED/);
  console.log(`CERT offline validation passed: 50 endpoints, 49 web-app probes, separate messages, FHIR pagination, MHD guards${existsSync(fixturePath) ? ', local test patient' : ''}. No network requests.`);
} finally {
  globalThis.fetch = originalFetch;
  delete process.env.VITE_CEZIH_MODE;
  delete process.env.CEZIH_NETWORK_ENABLED;
  resetCezihMessageClient();
}
