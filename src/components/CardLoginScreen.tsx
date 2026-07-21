import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { resolveCardReaderStatusUrl } from '../config/runtime';
import { useLocale } from '../i18n/LocaleContext';
import { logAuthLoginFailed } from '../data/auditAccess';
import { parseLoginError, type LoginErrorDisplay } from '../utils/translateLoginError';
import { LanguageSwitcher } from './LanguageSwitcher';

interface CardReaderStatus {
  readerConnected: boolean;
  cardPresent: boolean;
  readerName?: string;
  bridgeAvailable: boolean;
  mode?: 'mock' | 'pkcs11';
}

const POLL_INTERVAL_MS = 1500;

export function CardLoginScreen() {
  const { loginWithCard } = useAuth();
  const { locale, t } = useLocale();
  const [givenName, setGivenName] = useState('');
  const [status, setStatus] = useState<CardReaderStatus>({
    readerConnected: false,
    cardPresent: false,
    bridgeAvailable: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginErrorDisplay | null>(null);
  const [mockBusy, setMockBusy] = useState(false);
  const [cardDetected, setCardDetected] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(resolveCardReaderStatusUrl());
      const payload = (await response.json()) as CardReaderStatus;
      setStatus(payload);
      if (payload.cardPresent) {
        setCardDetected(true);
      }
    } catch {
      setStatus({
        readerConnected: false,
        cardPresent: false,
        bridgeAvailable: false,
      });
    }
  }, []);

  useEffect(() => {
    if (cardDetected) return undefined;

    void refreshStatus();
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshStatus, cardDetected]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginWithCard({ givenName }, locale);
    } catch (err) {
      logAuthLoginFailed('card-login', locale, 'card');
      setError(parseLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleMockInsert(cardId: string) {
    setMockBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/card-reader/mock/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      });
      if (!response.ok) {
        throw new Error('bridge_unavailable');
      }
      setCardDetected(true);
      setStatus((prev) => ({
        ...prev,
        cardPresent: true,
        readerConnected: true,
        bridgeAvailable: true,
      }));
      await refreshStatus();
    } catch (err) {
      setError(parseLoginError(err));
    } finally {
      setMockBusy(false);
    }
  }

  const isCardPresent = cardDetected || status.cardPresent;

  const canSignIn =
    status.bridgeAvailable &&
    isCardPresent &&
    Boolean(givenName.trim()) &&
    !loading;

  const errorMessage =
    error == null
      ? null
      : error.kind === 'key'
        ? t(error.key)
        : error.message;

  return (
    <section className="panel login-panel">
      <div className="login-panel-header">
        <h2>{t('cardLogin.title')}</h2>
        <LanguageSwitcher />
      </div>
      <p className="search-hint">{t('cardLogin.hint')}</p>

      <div className="card-login-status">
        <p>
          {status.bridgeAvailable
            ? t('cardLogin.bridgeAvailable')
            : t('cardLogin.bridgeUnavailable')}
        </p>
        <p>
          {status.readerConnected
            ? t('cardLogin.readerConnected', { name: status.readerName ?? '' })
            : t('cardLogin.readerDisconnected')}
        </p>
        <p>
          {isCardPresent ? t('cardLogin.cardPresent') : t('cardLogin.cardAbsent')}
        </p>
      </div>

      <form className="search-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          {t('cardLogin.givenName')}
          <input
            type="text"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            autoComplete="given-name"
            required
          />
        </label>
        <div className="search-actions">
          <button type="submit" disabled={!canSignIn}>
            {loading ? t('cardLogin.signingIn') : t('cardLogin.signIn')}
          </button>
        </div>
      </form>

      {import.meta.env.DEV && (
        <div className="card-login-dev">
          <p className="search-hint">{t('cardLogin.devHint')}</p>
          <div className="search-actions">
            <button
              type="button"
              disabled={mockBusy}
              onClick={() => void handleMockInsert('mock-ana-001')}
            >
              {t('cardLogin.mockInsertAna')}
            </button>
          </div>
        </div>
      )}

      {errorMessage && <p className="error">{errorMessage}</p>}
    </section>
  );
}
