// JCS/JWS primitives only; key access and certificate trust belong to the signer.
export const BUNDLE_SIGNATURE_ALGORITHMS = ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'] as const;
export type BundleSignatureAlgorithm = typeof BUNDLE_SIGNATURE_ALGORITHMS[number];
export type JsonObject = { [key: string]: unknown };
export type SignedBundle = JsonObject & { resourceType: 'Bundle'; type: 'message' | 'document'; signature: JsonObject & { data: string } };

export interface TrustedBundleSigner {
  algorithm: BundleSignatureAlgorithm;
  publicJwk: JsonWebKey;
  certificateChain: readonly string[];
}

export interface BundleSigner extends TrustedBundleSigner {
  sign: (input: Uint8Array<ArrayBuffer>) => Promise<ArrayBuffer>;
}

const MAX_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function object(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function validUnicode(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

/** RFC 8785: UTF-16 property ordering, ECMAScript numbers, unchanged array order. */
export function canonicalizeJson(value: unknown): string {
  let nodes = 0;
  function visit(item: unknown, depth: number): string {
    if (depth > 64 || ++nodes > 100_000) throw new Error('JSON complexity limit exceeded.');
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'string' && validUnicode(item)) return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length) throw new Error('Sparse arrays are not JSON.');
      for (let index = 0; index < item.length; index++) {
        if (!Object.hasOwn(item, index)) throw new Error('Sparse arrays are not JSON.');
      }
      return `[${item.map((entry) => visit(entry, depth + 1)).join(',')}]`;
    }
    if (object(item)) {
      return `{${Object.keys(item).sort().map((key) => {
        if (!validUnicode(key)) throw new Error('Invalid Unicode property.');
        return `${JSON.stringify(key)}:${visit(item[key], depth + 1)}`;
      }).join(',')}}`;
    }
    throw new Error('Value is outside the JCS JSON data model.');
  }
  const result = visit(value, 0);
  if (encoder.encode(result).length > MAX_BYTES) throw new Error('JSON size limit exceeded.');
  return result;
}

export function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  if (!value || value.length > MAX_BYTES * 2 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('Invalid Base64.');
  }
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (base64(bytes) !== value) throw new Error('Non-canonical Base64.');
  return bytes;
}

function base64url(bytes: Uint8Array): string {
  return base64(bytes).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error('Invalid Base64URL.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const result = fromBase64(padded);
  if (base64url(result) !== value) throw new Error('Non-canonical Base64URL.');
  return result;
}

export function webCryptoParameters(algorithm: BundleSignatureAlgorithm): {
  key: RsaHashedImportParams | EcKeyImportParams;
  signature: AlgorithmIdentifier | EcdsaParams;
} {
  if (!BUNDLE_SIGNATURE_ALGORITHMS.includes(algorithm)) throw new Error('Unsupported signature algorithm.');
  const hash = `SHA-${algorithm.slice(2)}`;
  return algorithm.startsWith('RS')
    ? { key: { name: 'RSASSA-PKCS1-v1_5', hash }, signature: 'RSASSA-PKCS1-v1_5' }
    : { key: { name: 'ECDSA', namedCurve: algorithm === 'ES512' ? 'P-521' : `P-${algorithm.slice(2)}` }, signature: { name: 'ECDSA', hash } };
}

function joseHeader(signer: TrustedBundleSigner): string {
  webCryptoParameters(signer.algorithm);
  const jwk = signer.publicJwk;
  if (!['RSA', 'EC'].includes(jwk.kty ?? '') || ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'].some((key) => key in jwk)) {
    throw new Error('A public signing key is required.');
  }
  if (!signer.certificateChain.length) throw new Error('Signing certificate is required.');
  signer.certificateChain.forEach(fromBase64);
  return canonicalizeJson({ alg: signer.algorithm, jwk, x5c: signer.certificateChain });
}

function requireBundle(bundle: unknown): asserts bundle is JsonObject & { signature: JsonObject } {
  if (!object(bundle) || bundle.resourceType !== 'Bundle' || !['message', 'document'].includes(String(bundle.type)) || !object(bundle.signature)) {
    throw new Error('A message/document Bundle with signature metadata is required.');
  }
  const signature = bundle.signature;
  if (!Array.isArray(signature.type) || signature.type.length !== 1 || !object(signature.type[0]) ||
    signature.type[0].system !== 'urn:iso-astm:E1762-95:2013' || signature.type[0].code !== '1.2.840.10065.1.12.1.1' ||
    typeof signature.when !== 'string' || !Number.isFinite(Date.parse(signature.when)) || !object(signature.who) ||
    ['targetFormat', 'sigFormat', 'onBehalfOf'].some((key) => key in signature)) {
    throw new Error('Signature metadata does not match the supplied CEZIH profiles.');
  }
  if (!Array.isArray(bundle.entry)) throw new Error('Bundle entries are required.');
  const resources = bundle.entry.filter(object).filter((entry) => object(entry.resource));
  if (bundle.type === 'message') {
    const header = resources[0]?.resource as JsonObject | undefined;
    if (header?.resourceType !== 'MessageHeader' || canonicalizeJson(header.author) !== canonicalizeJson(signature.who)) {
      throw new Error('Message signer must equal MessageHeader.author.');
    }
  } else {
    const who = signature.who;
    const composition = resources[0]?.resource as JsonObject | undefined;
    if (composition?.resourceType !== 'Composition' || typeof who.reference !== 'string' || !who.reference.startsWith('urn:uuid:') || 'identifier' in who || 'type' in who) {
      throw new Error('Document signer must use a local Practitioner reference.');
    }
    const practitioner = resources.find((entry) => entry.fullUrl === who.reference)?.resource as JsonObject | undefined;
    if (practitioner?.resourceType !== 'Practitioner') throw new Error('Document signer Practitioner is missing.');
    const type = composition.type as { coding?: { code?: string }[] } | undefined;
    const codes = type?.coding?.map((coding) => coding.code) ?? [];
    const authors = Array.isArray(composition.author) ? composition.author.filter(object) : [];
    const attesters = Array.isArray(composition.attester) ? composition.attester.filter(object).map((attester) => attester.party).filter(object) : [];
    if ((codes.some((code) => ['001', '002', '003', '009', '010'].includes(code ?? '')) && !authors.some((author) => author.reference === who.reference)) ||
      (codes.some((code) => ['004', '005', '006', '007', '011', '012', '013'].includes(code ?? '')) && !attesters.some((attester) => attester.reference === who.reference))) {
      throw new Error('Document signer must match the author/attester for this document type.');
    }
  }
}

export function canonicalBundlePayload(bundle: unknown): string {
  requireBundle(bundle);
  // Only the root signature.data is excluded; Binary.data and nested signatures stay signed.
  const signature = { ...bundle.signature };
  delete signature.data;
  return canonicalizeJson({ ...bundle, signature });
}

export async function signBundle(bundle: unknown, signer: BundleSigner): Promise<SignedBundle> {
  const payload = canonicalBundlePayload(bundle);
  const headerPart = base64url(encoder.encode(joseHeader(signer)));
  const payloadPart = base64url(encoder.encode(payload));
  const signature = await signer.sign(encoder.encode(`${headerPart}.${payloadPart}`));
  if (!signature.byteLength) throw new Error('Signer returned an empty signature.');
  const signed = JSON.parse(payload) as SignedBundle;
  signed.signature.data = base64(encoder.encode(`${headerPart}..${base64url(new Uint8Array(signature))}`));
  return signed;
}

/** The caller supplies a trusted certificate/key; a key from the JWS itself is never trusted. */
export async function verifyBundleSignature(bundle: unknown, trustedSigner: TrustedBundleSigner): Promise<void> {
  requireBundle(bundle);
  if (typeof bundle.signature.data !== 'string') throw new Error('Signature data is missing.');
  const parts = decoder.decode(fromBase64(bundle.signature.data)).split('.');
  if (parts.length !== 3) throw new Error('Invalid compact JWS.');
  const [headerPart, embeddedPayload, signaturePart] = parts;
  // This signer uses a fixed protected-header contract, also rejecting duplicate JSON members.
  if (decoder.decode(fromBase64url(headerPart)) !== joseHeader(trustedSigner)) throw new Error('Untrusted signing key, certificate or algorithm.');
  const payloadPart = base64url(encoder.encode(canonicalBundlePayload(bundle)));
  if (embeddedPayload && embeddedPayload !== payloadPart) throw new Error('JWS payload does not match Bundle.');
  const parameters = webCryptoParameters(trustedSigner.algorithm);
  const key = await crypto.subtle.importKey('jwk', trustedSigner.publicJwk, parameters.key, false, ['verify']);
  const valid = await crypto.subtle.verify(parameters.signature, key, fromBase64url(signaturePart), encoder.encode(`${headerPart}.${payloadPart}`));
  if (!valid) throw new Error('Bundle signature verification failed.');
}
