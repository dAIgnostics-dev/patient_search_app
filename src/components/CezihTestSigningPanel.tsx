import { useState } from 'react';
import {
  BUNDLE_SIGNATURE_ALGORITHMS, fromBase64, signBundle, verifyBundleSignature,
  type BundleSignatureAlgorithm, type SignedBundle,
} from '../fhir/bundleSignature';
import {
  buildTestSigningBundle, changeTestClinicalContent, createTestBundleSigner,
  reverseTestPropertyOrder, testSigningTrust, type TestBundleKind,
} from '../data/signing/cezihTestSigning';
import { useLocale } from '../i18n/LocaleContext';

type CheckState = 'unchecked' | 'valid' | 'invalid';

export function CezihTestSigningPanel() {
  const { t } = useLocale();
  const [kind, setKind] = useState<TestBundleKind>('message');
  const [algorithm, setAlgorithm] = useState<BundleSignatureAlgorithm>('RS256');
  const [signed, setSigned] = useState<SignedBundle | null>(null);
  const [original, setOriginal] = useState<SignedBundle | null>(null);
  const [signedAlgorithm, setSignedAlgorithm] = useState<BundleSignatureAlgorithm>('RS256');
  const [check, setCheck] = useState<CheckState>('unchecked');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [thumbprint, setThumbprint] = useState('');
  const available = Boolean(globalThis.crypto?.subtle);

  async function sign() {
    setBusy(true); setFailed(false); setCheck('unchecked');
    setSigned(null); setOriginal(null); setThumbprint('');
    try {
      const signer = await createTestBundleSigner(algorithm);
      const bundle = await signBundle(buildTestSigningBundle(kind, 'TEST ONLY — synthetic clinical content'), signer);
      const digest = await crypto.subtle.digest('SHA-256', fromBase64(signer.certificateChain[0]));
      setThumbprint(Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(':'));
      setSigned(bundle); setOriginal(bundle); setSignedAlgorithm(algorithm);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!signed) return;
    setBusy(true); setFailed(false);
    try { await verifyBundleSignature(signed, testSigningTrust(signedAlgorithm)); setCheck('valid'); }
    catch { setCheck('invalid'); }
    finally { setBusy(false); }
  }

  function change(next: SignedBundle) {
    setSigned(next); setCheck('unchecked'); setFailed(false);
  }

  return (
    <fieldset className="cezih-auth-panel cezih-signing-panel" disabled={busy}>
      <legend>{t('testSigning.title')}</legend>
      <p className="warning-banner">{t('testSigning.warning')}</p>
      <p className="search-hint">{t('testSigning.hint')}</p>
      {!available && <p className="error" role="alert">{t('testSigning.unavailable')}</p>}
      <div className="cezih-auth-fields">
        <label>{t('testSigning.kind')}
          <select value={kind} onChange={(event) => setKind(event.target.value as TestBundleKind)}>
            <option value="message">{t('testSigning.message')}</option>
            <option value="document">{t('testSigning.document')}</option>
          </select>
        </label>
        <label>{t('testSigning.algorithm')}
          <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value as BundleSignatureAlgorithm)}>
            {BUNDLE_SIGNATURE_ALGORITHMS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className="search-actions">
        <button type="button" disabled={!available} onClick={() => void sign()}>{t(busy ? 'testSigning.working' : 'testSigning.sign')}</button>
        <button type="button" className="secondary-button" disabled={!signed || !available} onClick={() => void verify()}>{t('testSigning.verify')}</button>
        <button type="button" className="secondary-button" disabled={!signed} onClick={() => signed && change(changeTestClinicalContent(signed))}>{t('testSigning.tamper')}</button>
        <button type="button" className="secondary-button" disabled={!signed} onClick={() => signed && change(reverseTestPropertyOrder(signed) as SignedBundle)}>{t('testSigning.reorder')}</button>
        <button type="button" className="secondary-button" disabled={!original} onClick={() => original && change(original)}>{t('testSigning.restore')}</button>
      </div>
      {failed && <p className="error" role="alert">{t('testSigning.failed')}</p>}
      <p role="status" aria-live="polite" className={check === 'invalid' ? 'error' : ''}>{t(`testSigning.${check}`)}</p>
      {signed && <>
        <p className="meta">{t('testSigning.signedAlgorithm')}: {signedAlgorithm}</p>
        <p className="meta">{t('testSigning.fingerprint')}: <code className="cezih-signing-fingerprint">{thumbprint}</code></p>
        <details>
          <summary>{t('testSigning.bundle')}</summary>
          <pre tabIndex={0}>{JSON.stringify(signed, null, 2)}</pre>
        </details>
      </>}
    </fieldset>
  );
}
