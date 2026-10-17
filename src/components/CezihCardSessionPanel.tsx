import { useEffect, useState } from 'react';
import { resolveCezihMode } from '../config/cezihEndpoints';
import type { CezihUserAuthAction, CezihUserAuthStatus } from '../config/cezihUserAuth';
import { cezihUserAuth } from '../data/cezihUserAuth';
import { useLocale } from '../i18n/LocaleContext';

export function CezihCardSessionPanel() {
  const { t, locale } = useLocale();
  const [status, setStatus] = useState<CezihUserAuthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [actor, setActor] = useState('ana');
  const [result, setResult] = useState('success');
  const simulation = status ? status.mode === 'simulation' : resolveCezihMode() !== 'cert-live';
  useEffect(() => {
    let mounted = true;
    void cezihUserAuth().then((value) => { if (mounted) setStatus(value); }).catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, []);
  async function run(action: CezihUserAuthAction, body?: Record<string, unknown>) {
    setBusy(true); setFailed(false);
    try { setStatus(await cezihUserAuth(action, body)); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return (
    <fieldset className="cezih-auth-panel">
      <legend>{t('cardSession.title')}</legend>
      <p className="warning-banner">{t(simulation ? 'cardSession.simulation' : 'cardSession.liveBlocked')}</p>
      <p className="search-hint">{t('cardSession.hint')}</p>
      <p role="status" aria-live="polite">{status ? t(`cardSession.state.${status.state}`) : t('cardSession.loading')}</p>
      {failed && <p className="error" role="alert">{t('cardSession.failed')}</p>}
      {status?.user && <p>{status.user.displayName} · {status.user.roles.join(', ')}</p>}
      {status?.expiresAt && <p className="meta">{t('cardSession.expires')}: {new Date(status.expiresAt).toLocaleString(locale)}</p>}
      {status?.check && <p role="status">{t(`cardSession.checkResult.${status.check}`)}</p>}
      {simulation && <>
        <div className="cezih-auth-fields">
          <label>{t('cardSession.actor')}
            <select value={actor} onChange={(event) => setActor(event.target.value)} disabled={busy}>
              <option value="ana">Ana</option><option value="luka">Luka</option>
            </select>
          </label>
          <label>{t('cardSession.scenario')}
            <select value={result} onChange={(event) => setResult(event.target.value)} disabled={busy}>
              <option value="success">{t('cardSession.success')}</option>
              <option value="card-unavailable">{t('cardSession.missing')}</option>
              <option value="denied">{t('cardSession.rejected')}</option>
            </select>
          </label>
        </div>
        <div className="search-actions">
          {status?.state === 'pending' ? <>
            <button type="button" disabled={busy} onClick={() => void run('complete', { challenge: status.challenge, result, actor })}>{t('cardSession.complete')}</button>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('complete', { challenge: status.challenge, result: 'cancelled', actor })}>{t('cardSession.cancel')}</button>
          </> : <button type="button" disabled={busy || !status} onClick={() => void run('start')}>{t('cardSession.start')}</button>}
          <button type="button" className="secondary-button" disabled={busy || !status || status.state === 'pending'} onClick={() => void run('test')}>{t('cardSession.test')}</button>
          {status?.state === 'authenticated' && <>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('test', { denied: true })}>{t('cardSession.testDenied')}</button>
            <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('expire')}>{t('cardSession.expire')}</button>
          </>}
        </div>
      </>}
      <div className="search-actions">
        {!simulation && <button type="button" disabled title={t('cardSession.liveBlocked')}>{t('cardSession.realLogin')}</button>}
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void run('status')}>{t('cardSession.refresh')}</button>
        <button type="button" className="secondary-button" disabled={busy || !status} onClick={() => void run('logout')}>{t('cardSession.logout')}</button>
      </div>
    </fieldset>
  );
}
