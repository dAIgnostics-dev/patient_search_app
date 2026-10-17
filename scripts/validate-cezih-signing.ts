import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, generateKeyPairSync, verify, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  BUNDLE_SIGNATURE_ALGORITHMS, base64, canonicalizeJson, canonicalBundlePayload, fromBase64,
  signBundle, verifyBundleSignature, webCryptoParameters, type JsonObject, type SignedBundle,
} from '../src/fhir/bundleSignature';
import {
  buildTestSigningBundle, changeTestClinicalContent, createTestBundleSigner,
  reverseTestPropertyOrder, TEST_SIGNING_FIXTURES, testSigningTrust,
} from '../src/data/signing/cezihTestSigning';
import { CezihTestSigningPanel } from '../src/components/CezihTestSigningPanel';
import { LocaleProvider } from '../src/i18n/LocaleContext';

assert.equal(canonicalizeJson({ z: [3, { b: 2, a: 1 }], a: -0 }), '{"a":0,"z":[3,{"a":1,"b":2}]}');
assert.equal(canonicalizeJson([333333333.33333329, 1e30, 4.50, 2e-3, 1e-27]), '[333333333.3333333,1e+30,4.5,0.002,1e-27]');
const sortedKeys = ['\r', '1', '\u0080', 'ö', '€', '😀', '\ufb33'];
assert.equal(canonicalizeJson(Object.fromEntries([...sortedKeys].reverse().map((key) => [key, true]))), `{${sortedKeys.map((key) => `${JSON.stringify(key)}:true`).join(',')}}`);
assert.equal(canonicalizeJson('é'), '"é"');
assert.notEqual(canonicalizeJson('é'), canonicalizeJson('e\u0301'), 'JCS must not normalize Unicode');
for (const invalid of [NaN, Infinity, undefined, BigInt(1), new Date(), '\ud800', '\udfff', { bad: undefined }, [undefined], Array(1), { '\ud800': 1 }]) {
  assert.throws(() => canonicalizeJson(invalid));
}
const cycle: JsonObject = {}; cycle.self = cycle;
assert.throws(() => canonicalizeJson(cycle));
const sparseWithExtra = Object.assign(Array(1), { extra: 1 });
assert.throws(() => canonicalizeJson(sparseWithExtra));
assert.throws(() => canonicalizeJson('x'.repeat(2 * 1024 * 1024)));
for (const invalid of ['', 'Zg', 'Zg===', 'Zh==', 'Zg==\n', '____']) assert.throws(() => fromBase64(invalid));

for (const fixture of [TEST_SIGNING_FIXTURES.rsa, TEST_SIGNING_FIXTURES.p256, TEST_SIGNING_FIXTURES.p384, TEST_SIGNING_FIXTURES.p521]) {
  const certificate = new X509Certificate(Buffer.from(fixture.certificate, 'base64'));
  const privateKey = createPrivateKey({ key: Buffer.from(fixture.pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
  assert.deepEqual(certificate.publicKey.export({ format: 'jwk' }), fixture.jwk);
  assert.deepEqual(createPublicKey(privateKey).export({ format: 'jwk' }), fixture.jwk);
  assert(certificate.verify(certificate.publicKey), 'Development certificate must really be self-signed');
  assert(certificate.subject.includes('CEZIH LOCAL TEST ONLY'));
}

function parts(bundle: SignedBundle) {
  return Buffer.from(bundle.signature.data, 'base64').toString('utf8').split('.');
}
function replaceJws(bundle: SignedBundle, segments: string[]): SignedBundle {
  const copy = structuredClone(bundle);
  copy.signature.data = Buffer.from(segments.join('.')).toString('base64');
  return copy;
}

for (const algorithm of BUNDLE_SIGNATURE_ALGORITHMS) {
  const signer = await createTestBundleSigner(algorithm);
  for (const kind of ['message', 'document'] as const) {
    const unsigned = buildTestSigningBundle(kind, 'Synthetic content — čćžšđ 😀');
    const before = JSON.stringify(unsigned);
    const signed = await signBundle(unsigned, signer);
    assert.equal(JSON.stringify(unsigned), before, 'Signing must not mutate the original');
    assert.equal((unsigned.signature as JsonObject).data, undefined);
    await verifyBundleSignature(signed, signer);
    await verifyBundleSignature(reverseTestPropertyOrder(signed), signer);
    await assert.rejects(verifyBundleSignature(changeTestClinicalContent(signed), signer));
    const mutatedTime = structuredClone(signed); mutatedTime.signature.when = '2000-01-01T00:00:00Z';
    await assert.rejects(verifyBundleSignature(mutatedTime, signer));
    const changedSigner = structuredClone(signed); changedSigner.signature.who = { reference: 'Practitioner/another' };
    await assert.rejects(verifyBundleSignature(changedSigner, signer));
    const [header, payload, signature] = parts(signed);
    assert.equal(payload, '', 'Use detached JWS serialization');
    for (const part of [header, signature]) assert.match(part, /^[A-Za-z0-9_-]+$/, 'JWS segments must be unpadded Base64URL');
    const jose = JSON.parse(Buffer.from(header, 'base64url').toString());
    assert.equal(jose.alg, algorithm);
    assert.deepEqual(jose.jwk, signer.publicJwk);
    assert.deepEqual(jose.x5c, signer.certificateChain);
    assert(!('d' in jose.jwk));
    const canonicalPayload = canonicalBundlePayload(signed);
    assert(!('data' in JSON.parse(canonicalPayload).signature), 'Exclude data instead of replacing it with an empty string');
    const payloadPart = Buffer.from(canonicalPayload).toString('base64url');
    const signingInput = Buffer.from(`${header}.${payloadPart}`);
    const certificate = new X509Certificate(Buffer.from(signer.certificateChain[0], 'base64'));
    assert(verify(`sha${algorithm.slice(2)}`, signingInput, { key: certificate.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), 'Verify independently with Node crypto and the X.509 public key');
    assert(!verify(`sha${algorithm.slice(2)}`, Buffer.from(`${header}.`), { key: certificate.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), 'Detached payload still participates in the signature');
    if (algorithm.startsWith('ES')) assert.equal(Buffer.from(signature, 'base64url').length, algorithm === 'ES256' ? 64 : algorithm === 'ES384' ? 96 : 132);
    await verifyBundleSignature(replaceJws(signed, [header, payloadPart, signature]), signer);
    await assert.rejects(verifyBundleSignature(replaceJws(signed, [header, Buffer.from('{}').toString('base64url'), signature]), signer));
    await assert.rejects(verifyBundleSignature(replaceJws(signed, [header, '', `${signature}=`]), signer));
    const damagedSignature = Buffer.from(signature, 'base64url'); damagedSignature[0] ^= 1;
    await assert.rejects(verifyBundleSignature(replaceJws(signed, [header, '', damagedSignature.toString('base64url')]), signer));
    await assert.rejects(verifyBundleSignature(replaceJws(signed, [header, '', '']), signer));
    await assert.rejects(verifyBundleSignature(replaceJws(signed, ['e30', '', signature]), signer));
    await assert.rejects(verifyBundleSignature(signed, { ...signer, certificateChain: [base64(new Uint8Array([1, 2, 3]))] }));
    await assert.rejects(verifyBundleSignature(signed, testSigningTrust(algorithm === 'RS256' ? 'RS384' : 'RS256')));
  }
}

const rsaSigner = await createTestBundleSigner('RS256');
const source = buildTestSigningBundle('message', 'Original');
// Binary.data and every field outside the root signature.data remain covered.
(source.entry as unknown[]).push({ resource: { resourceType: 'Binary', data: 'c2lnbmVkIGJ5dGVz', signature: { data: 'nested-data' } } });
const binarySigned = await signBundle(source, rsaSigner);
await verifyBundleSignature(binarySigned, rsaSigner);
const binaryChanged = structuredClone(binarySigned);
((binaryChanged.entry as { resource: JsonObject }[]).at(-1)!.resource).data = 'Y2hhbmdlZA==';
await assert.rejects(verifyBundleSignature(binaryChanged, rsaSigner));
assert(canonicalBundlePayload(binarySigned).includes('nested-data'));
const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
await assert.rejects(verifyBundleSignature(binarySigned, { ...rsaSigner, publicJwk: otherKeys.publicKey.export({ format: 'jwk' }) }));
const absent = structuredClone(source); delete absent.signature;
await assert.rejects(signBundle(absent, rsaSigner));
const badAuthor = buildTestSigningBundle('message', 'Test');
((badAuthor.entry as { resource: JsonObject }[])[0].resource).author = { reference: 'Practitioner/wrong' };
await assert.rejects(signBundle(badAuthor, rsaSigner));
const attested = buildTestSigningBundle('document', 'Attester test');
const composition = (attested.entry as { resource: JsonObject }[])[0].resource;
composition.type = { coding: [{ code: '004' }] };
await assert.rejects(signBundle(attested, rsaSigner));
composition.attester = [{ mode: 'professional', party: (attested.signature as JsonObject).who }];
await verifyBundleSignature(await signBundle(attested, rsaSigner), rsaSigner);
for (const forbidden of ['targetFormat', 'sigFormat', 'onBehalfOf']) {
  const copy = structuredClone(source); (copy.signature as JsonObject)[forbidden] = 'test';
  await assert.rejects(signBundle(copy, rsaSigner));
}
await assert.rejects(signBundle(source, { ...rsaSigner, publicJwk: { ...rsaSigner.publicJwk, d: 'private' } }));
await assert.rejects(signBundle(source, { ...rsaSigner, certificateChain: [] }));
await assert.rejects(signBundle(source, { ...rsaSigner, sign: async () => new ArrayBuffer(0) }));
assert.throws(() => webCryptoParameters('RS1' as never), 'Legacy RS1 needs a card/explicit compatibility adapter, never silent fallback');
assert.throws(() => webCryptoParameters('none' as never));

// Render the real panel with its locale provider without starting a server or network.
const markup = renderToStaticMarkup(createElement(LocaleProvider, null, createElement(CezihTestSigningPanel)));
for (const text of ['SAMO LOKALNI TEST', 'Izradi i potpiši testni Bundle', 'Provjeri potpis', 'Izmijeni potpisani sadržaj', 'Promijeni redoslijed JSON ključeva', 'ES512']) assert(markup.includes(text));
assert(markup.includes('disabled=""'), 'Verification/mutation buttons start disabled');
for (const file of ['src/fhir/bundleSignature.ts', 'src/data/signing/cezihTestSigning.ts', 'src/components/CezihTestSigningPanel.tsx']) {
  assert(!/\b(fetch|WebSocket|XMLHttpRequest|cezihFetch)\s*\(/.test(readFileSync(file, 'utf8')), 'Test signing has no network calls');
}
console.log('Offline FHIR signing: JCS vectors, six algorithms × message/document, X.509/JWK consistency, independent verification, tampering, author/attester rules and panel rendering passed.');
