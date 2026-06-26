import { type FormEvent, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  logMboLookup,
  logPatientListSelect,
  type PatientAccessSource,
} from '../data/auditAccess';
import { findPatientByMbo, getPatientsForPractitioner } from '../data/practitionerPatients';
import { getRecentPatients } from '../data/recentPatients';
import type { EncounterSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatDate } from '../utils/localeFormat';
import { CreateEncounterForm } from './CreateEncounterForm';
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
  const [foundPatient, setFoundPatient] = useState<PatientSummary | null>(null);
  const [openedPatient, setOpenedPatient] = useState<PatientSummary | null>(null);
  const [showCreateEncounter, setShowCreateEncounter] = useState(false);
  const [accessSource, setAccessSource] = useState<PatientAccessSource>('mbo');
  const [lastMbo, setLastMbo] = useState('');
  const [recentTick, setRecentTick] = useState(0);
  const [recentLoadingPatientId, setRecentLoadingPatientId] = useState<string | null>(null);

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
    setFoundPatient(null);
    setOpenedPatient(null);
    setShowCreateEncounter(false);
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
      if (await hasPractitionerEncounter(found)) {
        setOpenedPatient(found);
        return;
      }
      setFoundPatient(found);
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

  async function hasPractitionerEncounter(entryPatient: PatientSummary): Promise<boolean> {
    if (!session) return false;
    const myPatients = await getPatientsForPractitioner(session);
    return myPatients.some(
      (patient) =>
        patient.id === entryPatient.id ||
        patient.fhirId === entryPatient.fhirId ||
        (Boolean(patient.mbo) && patient.mbo === entryPatient.mbo),
    );
  }

  async function openRecent(entryPatient: PatientSummary) {
    setError(null);
    setValidationError(null);
    setOpenedPatient(null);
    setShowCreateEncounter(false);
    setAccessSource('recent');
    if (session) logPatientListSelect(session, entryPatient, 'recent', locale);

    setRecentLoadingPatientId(entryPatient.id);
    try {
      if (await hasPractitionerEncounter(entryPatient)) {
        setFoundPatient(null);
        setOpenedPatient(entryPatient);
        return;
      }
      setFoundPatient(entryPatient);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('mbo.lookupFailed');
      if (message.toLowerCase().includes('fetch') || message.includes('FHIR')) {
        setError(t('mbo.apiError'));
      } else {
        setError(message);
      }
    } finally {
      setRecentLoadingPatientId(null);
    }
  }

  function handleBack() {
    setOpenedPatient(null);
    setFoundPatient(null);
    setShowCreateEncounter(false);
    setRecentTick((n) => n + 1);
  }

  function handleEncounterCreated(_encounter: EncounterSummary, _visitId: string) {
    if (!foundPatient) return;
    setShowCreateEncounter(false);
    setOpenedPatient(foundPatient);
  }

  if (openedPatient) {
    return (
      <PatientKarton
        patient={openedPatient}
        viewerSession={session ?? undefined}
        accessSource={accessSource}
        breadcrumbs={[
          { label: t('tabs.mbo'), onClick: handleBack },
          { label: `${openedPatient.firstName} ${openedPatient.lastName}` },
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
            {loading ? t('mbo.searching') : t('mbo.findPatient')}
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

      {foundPatient && (
        <div className="card patient-access-card">
          <h3>{t('mbo.foundTitle')}</h3>
          <p className="search-hint">{t('mbo.createEncounterRequired')}</p>
          <dl className="detail-grid">
            <div>
              <dt>{t('mbo.patient')}</dt>
              <dd>
                {foundPatient.firstName} {foundPatient.lastName}
              </dd>
            </div>
            <div>
              <dt>{t('mbo.label')}</dt>
              <dd>{foundPatient.mbo ?? t('common.emDash')}</dd>
            </div>
            <div>
              <dt>{t('mbo.birthDate')}</dt>
              <dd>{formatDate(foundPatient.birthDate, locale) ?? t('common.emDash')}</dd>
            </div>
          </dl>
          <div className="search-actions">
            <button type="button" onClick={() => setShowCreateEncounter(true)} disabled={!session}>
              {t('mbo.startEncounter')}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setFoundPatient(null);
                setShowCreateEncounter(false);
              }}
            >
              {t('mbo.clearSelection')}
            </button>
          </div>
        </div>
      )}

      {showCreateEncounter && session && foundPatient && (
        <CreateEncounterForm
          patient={foundPatient}
          session={session}
          onCancel={() => setShowCreateEncounter(false)}
          onCreated={handleEncounterCreated}
        />
      )}

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
                  disabled={recentLoadingPatientId === entry.patient.id}
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
