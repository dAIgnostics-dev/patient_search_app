import { useLocale } from '../i18n/LocaleContext';
import type { Locale } from '../i18n/types';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'hr', label: 'Hrvatski' },
  { value: 'en', label: 'English' },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="language-switcher">
      <span className="language-switcher-label">{t('app.language')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t('app.language')}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
