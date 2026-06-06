import { type FormEvent, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  logMboLookup,
  logPatientListSelect,
  type PatientAccessSource,
} from '../data/auditAccess';
import { findPatientByMbo } from '../data/practitionerPatients';
import { getRecentPatients } from '../data/recentPatients';
import type { PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatDate } from '../utils/localeFormat';
import { PatientKarton } from './PatientKarton';

function isValidMbo(value: string): boolean {
  return /^\d{9}$/.test(value.trim());
}

export function MboLookup() {
  const { session } = useAuth();
  const { locale, t } = useLocale();
  const [mbo, setMbo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [accessSource, setAccessSource] = useState<PatientAccessSource>('mbo');
  const [lastMbo, setLastMbo] = useState('');
  const [recentTick, setRecentTick] = useState(0);

  const recentPatients = useMemo(() => {
    if (!session) return [];
    void recentTick;
    return getRecentPatients(session.practitionerId);
  }, [session, recentTick]);

  async function runLookup(mboValue: string) {
    const trimmed = mboValue.trim();
    setLoading(true);
    setError(null);
    setValidationError(null);
    setPatient(null);
    setAccessSource('mbo');
    setLastMbo(trimmed);

    try {
      const found = await findPatientByMbo(trimmed);
      if (!found) {
        if (session) logMboLookup(session, trimmed, 'not_found', null, locale);
        setError(t('mbo.notFound', { mbo: trimmed }));
        return;
      }
      if (session) logMboLookup(session, trimmed, 'success', found, locale);
      setPatient(found);
    } catch (err) {
      if (session) logMboLookup(session, trimmed, 'error', null, locale);
      const message = err instanceof Error ? err.message : t('mbo.lookupFailed');
      if (message.toLowerCase().includes('fetch') || message.includes('FHIR')) {
        setError(t('mbo.apiError'));
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = mbo.trim();
    if (!trimmed) {
      setValidationError(t('mbo.enterMbo'));
      return;
    }
    if (!isValidMbo(trimmed)) {
      setValidationError(t('mbo.invalidMbo'));
      return;
    }
    await runLookup(trimmed);
  }

  function openRecent(entryPatient: PatientSummary) {
    setError(null);
    setValidationError(null);
    setAccessSource('recent');
    if (session) logPatientListSelect(session, entryPatient, 'recent', locale);
    setPatient(entryPatient);
  }

  function handleBack() {
    setPatient(null);
    setRecentTick((n) => n + 1);
  }

  if (patient) {
    return (
      <PatientKarton
        patient={patient}
        viewerSession={session ?? undefined}
        accessSource={accessSource}
        breadcrumbs={[
          { label: t('tabs.mbo'), onClick: handleBack },
          { label: `${patient.firstName} ${patient.lastName}` },
        ]}
        onBack={handleBack}
      />
    );
  }

  return (
    <section className="panel">
      <h2>{t('mbo.title')}</h2>
      <p className="search-hint">{t('mbo.hint')}</p>
      <form className="search-form" onSubmit={handleSearch}>
        <label>
          {t('mbo.label')}
          <input
            type="text"
            inputMode="numeric"
            value={mbo}
            onChange={(e) => {
              setMbo(e.target.value);
              setValidationError(null);
            }}
            placeholder="180223069"
            required
          />
        </label>
        <div className="search-actions">
          <button type="submit" disabled={loading}>
            {loading ? t('mbo.searching') : t('mbo.openKarton')}
          </button>
          {error && (
            <button
              type="button"
              className="retry-button"
              disabled={loading || !lastMbo}
              onClick={() => lastMbo && runLookup(lastMbo)}
            >
              {t('mbo.retry')}
            </button>
          )}
        </div>
      </form>
      {validationError && <p className="error">{validationError}</p>}
      {error && <p className="error">{error}</p>}

      <div className="recent-patients">
        <h3>{t('mbo.recentTitle')}</h3>
        {recentPatients.length === 0 ? (
          <p className="empty">{t('mbo.recentEmpty')}</p>
        ) : (
          <ul className="result-list">
            {recentPatients.map((entry) => (
              <li key={entry.patient.id}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => openRecent(entry.patient)}
                >
                  {entry.patient.firstName} {entry.patient.lastName}
                </button>
                <span className="meta">
                  {t('mbo.label')} {entry.patient.mbo ?? t('common.emDash')}
                  {` · ${formatDate(entry.openedAt, locale) ?? t('common.emDash')}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
