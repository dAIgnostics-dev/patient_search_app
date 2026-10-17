import { useState } from 'react';
import { CEZIH_CERT_ENDPOINTS, resolveCezihMode } from '../config/cezihEndpoints';
import { probeCezihEndpoint, type CezihEndpointProbeResult } from '../data/cezihEndpointProbe';
import { useLocale } from '../i18n/LocaleContext';
import { CezihAuthStatusPanel } from './CezihAuthStatusPanel';
import { CezihCardSessionPanel } from './CezihCardSessionPanel';
import { CezihTestSigningPanel } from './CezihTestSigningPanel';

export function CezihEndpointChecks() {
  const { t } = useLocale();
  const [results, setResults] = useState<Record<string, CezihEndpointProbeResult>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const live = resolveCezihMode() === 'cert-live';
  const httpEndpoints = CEZIH_CERT_ENDPOINTS.filter((endpoint) => live ? endpoint.method === 'GET' : endpoint.method);
  const checked = Object.values(results).filter((result) => result.httpStatus !== null || result.status === 'failed');
  const verified = checked.filter((result) => result.status === (live ? 'responded' : 'verified')).length;

  async function run(ids: string[]) {
    try {
      for (const id of ids) {
        setActiveId(id);
        const result = await probeCezihEndpoint(id);
        setResults((current) => ({ ...current, [id]: result }));
      }
    } finally {
      setActiveId(null);
    }
  }

  return (
    <section className="panel">
      <h2>{t('cezihProbe.title')}</h2>
      <CezihCardSessionPanel />
      {!live && <CezihTestSigningPanel />}
      {live && <CezihAuthStatusPanel />}
      <p className="search-hint">{t(live ? 'cezihProbe.hintLive' : 'cezihProbe.hint')}</p>
      <p className="warning-banner">{t(live ? 'cezihProbe.limitLive' : 'cezihProbe.limit')}</p>
      <div className="search-actions">
        <button type="button" disabled={activeId !== null} onClick={() => void run(httpEndpoints.map((endpoint) => endpoint.id))}>
          {t(activeId ? 'cezihProbe.running' : live ? 'cezihProbe.checkAllLive' : 'cezihProbe.checkAll')}
        </button>
      </div>
      <p role="status" aria-live="polite" className="meta">
        {t(live ? 'cezihProbe.summaryLive' : 'cezihProbe.summary', { checked: checked.length, total: httpEndpoints.length, verified, failed: checked.length - verified })}
      </p>
      <div className="endpoint-table-scroll">
        <table className="endpoint-table" aria-label={t('cezihProbe.title')}>
          <thead>
            <tr>
              <th scope="col">{t('cezihProbe.service')}</th>
              <th scope="col">{t('cezihProbe.method')}</th>
              <th scope="col">{t('cezihProbe.endpoint')}</th>
              <th scope="col">{t('cezihProbe.result')}</th>
            </tr>
          </thead>
          <tbody>
            {CEZIH_CERT_ENDPOINTS.map((endpoint) => {
              const result = results[endpoint.id];
              const canProbe = Boolean(endpoint.method) && (!live || endpoint.method === 'GET');
              const status = !endpoint.method ? 'websocket' : !canProbe ? 'postDisabled' : result?.status ?? 'idle';
              return (
                <tr key={endpoint.id}>
                  <th scope="row">{endpoint.service}<code className="meta">{endpoint.id}</code></th>
                  <td>{endpoint.method ?? 'WebSocket'}</td>
                  <td><code>{endpoint.url}</code></td>
                  <td>
                    <p className={status === 'failed' ? 'error' : 'meta'}>
                      {activeId === endpoint.id ? t('cezihProbe.running') : t(`cezihProbe.${status}`)}
                    </p>
                    {canProbe && (
                      <button type="button" className="secondary-button" aria-label={`${t('cezihProbe.check')} ${endpoint.service}: ${endpoint.method} (${endpoint.id})`} disabled={activeId !== null} onClick={() => void run([endpoint.id])}>
                        {t('cezihProbe.check')}
                      </button>
                    )}
                    {result && (
                      <details>
                        <summary>{t('cezihProbe.response')}{result.httpStatus !== null ? ` · HTTP ${result.httpStatus}` : ''}</summary>
                        <code>{result.localUrl}</code>
                        <pre>{result.response}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
