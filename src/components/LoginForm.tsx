import { type FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { logAuthLoginFailed } from '../data/auditAccess';
import { parseLoginError, type LoginErrorDisplay } from '../utils/translateLoginError';

export function LoginForm() {
  const { login } = useAuth();
  const { locale, t } = useLocale();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoginErrorDisplay | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password, locale);
    } catch (err) {
      logAuthLoginFailed(username, locale);
      setError(parseLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  const errorMessage =
    error == null
      ? null
      : error.kind === 'key'
        ? t(error.key)
        : error.message;

  return (
    <section className="panel login-panel">
      <div className="login-panel-header">
        <h2>{t('login.title')}</h2>
        <LanguageSwitcher />
      </div>
      <p className="search-hint">
        {t('login.hint')} <code>npm run auth:generate</code>.
      </p>
      <form className="search-form" onSubmit={handleSubmit}>
        <label>
          {t('login.username')}
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          {t('login.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <div className="search-actions">
          <button type="submit" disabled={loading}>
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </div>
      </form>
      {errorMessage && <p className="error">{errorMessage}</p>}
    </section>
  );
}
