import fixtures from './cezih-signing-test-keys.json';
import {
  fromBase64, webCryptoParameters,
  type BundleSignatureAlgorithm, type BundleSigner, type JsonObject, type TrustedBundleSigner,
} from '../../fhir/bundleSignature';

// These keys are public fixtures, never an identity or a source of CEZIH credentials.
export const TEST_SIGNING_FIXTURES = fixtures;
export type TestBundleKind = 'message' | 'document';

export function testSigningTrust(algorithm: BundleSignatureAlgorithm): TrustedBundleSigner {
  const fixture = algorithm.startsWith('RS') ? fixtures.rsa : algorithm === 'ES256' ? fixtures.p256 : algorithm === 'ES384' ? fixtures.p384 : fixtures.p521;
  return { algorithm, publicJwk: { ...fixture.jwk }, certificateChain: [fixture.certificate] };
}

export async function createTestBundleSigner(algorithm: BundleSignatureAlgorithm): Promise<BundleSigner> {
  const trust = testSigningTrust(algorithm);
  const fixture = algorithm.startsWith('RS') ? fixtures.rsa : algorithm === 'ES256' ? fixtures.p256 : algorithm === 'ES384' ? fixtures.p384 : fixtures.p521;
  const parameters = webCryptoParameters(algorithm);
  const privateKey = await crypto.subtle.importKey('pkcs8', fromBase64(fixture.pkcs8), parameters.key, false, ['sign']);
  return { ...trust, sign: (input) => crypto.subtle.sign(parameters.signature, privateKey, input) };
}

export function buildTestSigningBundle(kind: TestBundleKind, content: string): JsonObject {
  const bundleId = crypto.randomUUID();
  const headerId = crypto.randomUUID();
  const clinicalId = crypto.randomUUID();
  const practitionerId = crypto.randomUUID();
  const practitionerRef = `urn:uuid:${practitionerId}`;
  const now = new Date().toISOString();
  const practitionerIdentifier = { system: 'http://fhir.cezih.hr/specifikacije/identifikatori/HZJZ-broj-zdravstvenog-djelatnika', value: 'TEST-ONLY-0001' };
  const who = kind === 'message' ? { type: 'Practitioner', identifier: practitionerIdentifier } : { reference: practitionerRef };
  return {
    resourceType: 'Bundle', id: bundleId, type: kind, timestamp: now,
    meta: { profile: [`http://fhir.cezih.hr/specifikacije/StructureDefinition/${kind === 'message' ? 'hr-request-message' : 'hr-document'}`], tag: [{ system: 'urn:local:test-signing', code: 'TEST-ONLY' }] },
    ...(kind === 'document' ? { identifier: { system: 'urn:ietf:rfc:3986', value: `urn:oid:2.25.${BigInt(`0x${bundleId.replace(/-/g, '')}`)}` } } : {}),
    signature: { type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }], when: now, who },
    entry: kind === 'message' ? [
      { fullUrl: `urn:uuid:${headerId}`, resource: {
        resourceType: 'MessageHeader', id: headerId,
        eventCoding: { system: 'urn:local:test-signing', code: 'test-action' },
        author: who, source: { endpoint: 'urn:local:test-signing' }, focus: [{ reference: `urn:uuid:${clinicalId}` }],
      } },
      { fullUrl: `urn:uuid:${clinicalId}`, resource: {
        resourceType: 'Condition', id: clinicalId, subject: { reference: 'Patient/test-only' }, code: { text: content },
      } },
    ] : [
      { fullUrl: `urn:uuid:${headerId}`, resource: {
        resourceType: 'Composition', id: headerId, status: 'final',
        type: { coding: [{ system: 'http://fhir.cezih.hr/specifikacije/CodeSystem/vrsta-dokumenta', code: '001' }] },
        subject: { reference: 'Patient/test-only' }, date: now, author: [who], title: 'TEST ONLY',
        section: [{ entry: [{ reference: `urn:uuid:${clinicalId}` }] }],
      } },
      { fullUrl: practitionerRef, resource: { resourceType: 'Practitioner', id: practitionerId, identifier: [practitionerIdentifier], name: [{ text: 'TEST ONLY' }] } },
      { fullUrl: `urn:uuid:${clinicalId}`, resource: { resourceType: 'Observation', id: clinicalId, status: 'final', code: { text: 'TEST ONLY' }, valueString: content } },
    ],
  };
}

export function changeTestClinicalContent<T extends JsonObject>(bundle: T): T {
  const copy = structuredClone(bundle);
  const entries = copy.entry as { resource: JsonObject }[];
  const clinical = entries.find((entry) => ['Condition', 'Observation'].includes(String(entry.resource.resourceType)))!.resource;
  if (clinical.resourceType === 'Condition') {
    const code = clinical.code as JsonObject;
    code.text = `${code.text} [CHANGED]`;
  } else clinical.valueString = `${clinical.valueString} [CHANGED]`;
  return copy;
}

export function reverseTestPropertyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseTestPropertyOrder);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reverseTestPropertyOrder(entry)]));
  }
  return value;
}
