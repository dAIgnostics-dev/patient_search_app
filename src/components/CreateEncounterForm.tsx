import { type FormEvent, useMemo, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { createEncounter } from '../data/encounterApi';
import { ADMISSION_CLASS_OPTIONS } from '../data/encounter-management/encounterMessageShared';
import { resolveCezihDefaultOrgHzzo } from '../config/runtime';
import type { EncounterSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { enrichEncounterSummary } from '../utils/enrichEncounterSummary';

interface CreateEncounterFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  onCancel: () => void;
  onCreated: (encounter: EncounterSummary, visitId: string) => void;
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

export function CreateEncounterForm({
  patient,
  session,
  onCancel,
  onCreated,
}: CreateEncounterFormProps) {
  const { locale, t } = useLocale();
  const [organizationHzzoCode, setOrganizationHzzoCode] = useState(resolveCezihDefaultOrgHzzo());
  const [periodStartLocal, setPeriodStartLocal] = useState(toDatetimeLocalValue(new Date()));
  const [classCode, setClassCode] = useState('9');
  const [localIdentifier, setLocalIdentifier] = useState('');
  const [participationOznaka, setParticipationOznaka] = useState('');
  const [participationSifra, setParticipationSifra] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const classOptions = useMemo(
    () =>
      ADMISSION_CLASS_OPTIONS.map((option) => ({
        code: option.code,
        label: locale === 'hr' ? option.displayHr : option.displayEn,
      })),
    [locale],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t('encounterCreate.missingPatientMbo'));
      setLoading(false);
      return;
    }

    try {
      const result = await createEncounter(session, {
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
        organizationHzzoCode,
        periodStart: fromDatetimeLocalValue(periodStartLocal),
        classCode,
        classDisplay: classOptions.find((o) => o.code === classCode)?.label,
        localIdentifier: localIdentifier.trim() || undefined,
        participationCost: participationOznaka.trim()
          ? {
              oznaka: participationOznaka.trim(),
              sifraOslobodjenja: participationSifra.trim() || undefined,
            }
          : undefined,
      });

      if (result.outcome === 'success') {
        onCreated(
          enrichEncounterSummary(result.encounter, session, {
            organizationHzzoCode,
            classDisplay: classOptions.find((o) => o.code === classCode)?.label,
          }),
          result.visitId,
        );
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('encounterCreate.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('encounterCreate.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-encounter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="create-encounter-title">{t('encounterCreate.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('encounterCreate.cancel')}
          </button>
        </header>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('encounterCreate.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          <label>
            {t('encounterCreate.practitionerHzjz')}
            <input type="text" value={session.hzjzId} readOnly />
          </label>

          <label>
            {t('encounterCreate.organizationHzzo')}
            <input
              type="text"
              value={organizationHzzoCode}
              onChange={(e) => setOrganizationHzzoCode(e.target.value)}
              required
            />
          </label>

          <label>
            {t('encounterCreate.periodStart')}
            <input
              type="datetime-local"
              value={periodStartLocal}
              onChange={(e) => setPeriodStartLocal(e.target.value)}
              required
            />
          </label>

          <label>
            {t('encounterCreate.admissionClass')}
            <select value={classCode} onChange={(e) => setClassCode(e.target.value)} required>
              {classOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} — {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('encounterCreate.localIdentifier')}
            <input
              type="text"
              value={localIdentifier}
              onChange={(e) => setLocalIdentifier(e.target.value)}
              placeholder={t('encounterCreate.localIdentifierHint')}
            />
          </label>

          <fieldset className="encounter-fieldset">
            <legend>{t('encounterCreate.participationCost')}</legend>
            <label>
              {t('encounterCreate.participationOznaka')}
              <input
                type="text"
                value={participationOznaka}
                onChange={(e) => setParticipationOznaka(e.target.value)}
                placeholder="N"
              />
            </label>
            <label>
              {t('encounterCreate.participationSifra')}
              <input
                type="text"
                value={participationSifra}
                onChange={(e) => setParticipationSifra(e.target.value)}
              />
            </label>
          </fieldset>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('encounterCreate.cancel')}
            </button>
            <button type="submit" disabled={loading}>
              {loading ? t('encounterCreate.submitting') : t('encounterCreate.submit')}
            </button>
          </div>
        </form>

        {error && <p className="error">{error}</p>}
        {fieldErrors.length > 0 && (
          <ul className="error-list">
            {fieldErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
