import { useEffect, useState } from 'react';
import type { CezihAuthStatus } from '../config/cezihOAuth';
import { getCezihAuthStatus } from '../data/cezihAuthStatus';
import { useLocale } from '../i18n/LocaleContext';

export function CezihAuthStatusPanel() {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<CezihAuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    // Reading status never obtains a token or contacts CEZIH.
    void getCezihAuthStatus().then((value) => { if (mounted) setStatus(value); })
      .catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, []);

  async function load(check: boolean) {
    setBusy(true);
    setFailed(false);
    try { setStatus(await getCezihAuthStatus(check)); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }

  return (
    <fieldset className="cezih-auth-panel">
      <legend>{t('cezihAuth.title')}</legend>
      <p className="search-hint">{t('cezihAuth.hint')}</p>
      <p role="status" aria-live="polite">
        {failed ? t('cezihAuth.statusUnavailable') : status ? t(`cezihAuth.${status.state === 'error' ? 'failed' : status.state}`) : t('cezihAuth.loading')}
      </p>
      {status && <>
        <p className="meta">{t('cezihAuth.method')}: {status.authMethod}</p>
        {status.expiresAt && <p className="meta">{t('cezihAuth.expires')}: {new Date(status.expiresAt).toLocaleString(locale)}</p>}
        <p className="meta">{t('cezihAuth.endpoints')}: {status.applicationEndpoints.join(', ')}</p>
        {status.errorCode && <p className="error">{t(`cezihAuth.error.${status.errorCode}`)}</p>}
      </>}
      <div className="search-actions">
        <button type="button" disabled={busy} onClick={() => void load(true)}>{t(busy ? 'cezihAuth.loading' : 'cezihAuth.check')}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void load(false)}>{t('cezihAuth.refresh')}</button>
      </div>
    </fieldset>
  );
}
