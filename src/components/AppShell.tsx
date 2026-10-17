import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MboLookup } from './MboLookup';
import { MyPatients } from './MyPatients';
import { CezihEndpointChecks } from './CezihEndpointChecks';

type Tab = 'mbo' | 'my-patients' | 'cezih-endpoints';

export function AppShell() {
  const { session, logout } = useAuth();
  const { locale, t } = useLocale();
  const [tab, setTab] = useState<Tab>('mbo');
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function signOut() {
    setLoggingOut(true); setLogoutFailed(false);
    try { await logout(locale); }
    catch { setLogoutFailed(true); }
    finally { setLoggingOut(false); }
  }

  if (!session) return null;

  return (
    <>
      <header className="header app-header">
        <div>
          <h1>{t('app.title')}</h1>
          <p>
            {t('app.signedInAs', {
              firstName: session.firstName,
              lastName: session.lastName,
              hzjzId: session.hzjzId,
            })}
          </p>
        </div>
        <div className="header-actions">
          <LanguageSwitcher />
          <button type="button" className="secondary-button" disabled={loggingOut} onClick={() => void signOut()}>
            {t('app.logout')}
          </button>
        </div>
      </header>
      {logoutFailed && <p className="error" role="alert">{t('cardSession.logoutFailed')}</p>}

      <nav className="tab-nav" aria-label={t('app.navMain')}>
        <button
          type="button"
          className={tab === 'mbo' ? 'tab-button tab-active' : 'tab-button'}
          onClick={() => setTab('mbo')}
        >
          {t('tabs.mbo')}
        </button>
        <button
          type="button"
          className={tab === 'my-patients' ? 'tab-button tab-active' : 'tab-button'}
          onClick={() => setTab('my-patients')}
        >
          {t('tabs.myPatients')}
        </button>
        {import.meta.env.DEV && (
          <button
            type="button"
            className={tab === 'cezih-endpoints' ? 'tab-button tab-active' : 'tab-button'}
            onClick={() => setTab('cezih-endpoints')}
          >
            {t('tabs.cezihEndpoints')}
          </button>
        )}
      </nav>

      <main>{tab === 'mbo' ? <MboLookup /> : tab === 'my-patients' ? <MyPatients /> : import.meta.env.DEV ? <CezihEndpointChecks /> : null}</main>
    </>
  );
}
