import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MboLookup } from './MboLookup';
import { MyPatients } from './MyPatients';

type Tab = 'mbo' | 'my-patients';

export function AppShell() {
  const { session, logout } = useAuth();
  const { locale, t } = useLocale();
  const [tab, setTab] = useState<Tab>('mbo');

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
          <button type="button" className="secondary-button" onClick={() => logout(locale)}>
            {t('app.logout')}
          </button>
        </div>
      </header>

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
      </nav>

      <main>{tab === 'mbo' ? <MboLookup /> : <MyPatients />}</main>
    </>
  );
}
