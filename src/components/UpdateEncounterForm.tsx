import { type FormEvent, useMemo, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { resolveCezihDefaultOrgHzzo } from '../config/runtime';
import {
  ADMISSION_CLASS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../data/encounter-management/encounterMessageShared';
import { updateEncounter } from '../data/encounterApi';
import type { EncounterSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatus } from '../utils/formatFhirCode';
import { enrichEncounterSummary } from '../utils/enrichEncounterSummary';

interface UpdateEncounterFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  encounter: EncounterSummary;
  onCancel: () => void;
  onUpdated: (encounter: EncounterSummary, visitId: string) => void;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return toDatetimeLocalValueFromDate(new Date());
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return toDatetimeLocalValueFromDate(new Date());
  return toDatetimeLocalValueFromDate(date);
}

function toDatetimeLocalValueFromDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function UpdateEncounterForm({
  patient,
  session,
  encounter,
  onCancel,
  onUpdated,
}: UpdateEncounterFormProps) {
  const { locale, t } = useLocale();
  const [organizationHzzoCode, setOrganizationHzzoCode] = useState(
    encounter.organizationFhirId ?? resolveCezihDefaultOrgHzzo(),
  );
  const [periodStartLocal, setPeriodStartLocal] = useState(toDatetimeLocalValue(encounter.start));
  const [classCode, setClassCode] = useState(encounter.classCode ?? '9');
  const [localIdentifier, setLocalIdentifier] = useState('');
  const [participationOznaka, setParticipationOznaka] = useState('');
  const [participationSifra, setParticipationSifra] = useState('');
  const [priorityCode, setPriorityCode] = useState(encounter.priorityCode ?? '');
  const [additionalParticipants, setAdditionalParticipants] = useState('');
  const [diagnosisCaseIds, setDiagnosisCaseIds] = useState('');
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

  const priorityOptions = useMemo(
    () =>
      PRIORITY_OPTIONS.map((option) => ({
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
      setError(t('encounterUpdate.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!encounter.visitId) {
      setError(t('encounterUpdate.requiresVisitId'));
      setLoading(false);
      return;
    }

    const extraParticipants = parseCommaSeparated(additionalParticipants).map((hzjzId) => ({
      hzjzId,
    }));
    const caseIds = parseCommaSeparated(diagnosisCaseIds);

    try {
      const result = await updateEncounter(session, {
        visitId: encounter.visitId,
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
        additionalParticipants:
          extraParticipants.length > 0 ? extraParticipants : undefined,
        priorityCode: priorityCode.trim() || undefined,
        diagnosisCaseIds: caseIds.length > 0 ? caseIds : undefined,
      });

      if (result.outcome === 'success') {
        onUpdated(
          enrichEncounterSummary(result.encounter, session, {
            organizationHzzoCode,
            priorityCode: priorityCode.trim() || null,
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
      setError(t('encounterUpdate.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('encounterUpdate.failed'));
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
        aria-labelledby="update-encounter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="update-encounter-title">{t('encounterUpdate.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('encounterUpdate.cancel')}
          </button>
        </header>

        <p className="form-hint">{t('encounterUpdate.immutableFieldsHint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('encounterUpdate.visitId')}
            <input type="text" value={encounter.visitId ?? ''} readOnly />
          </label>

          <label>
            {t('encounterUpdate.status')}
            <input
              type="text"
              value={formatFhirStatus(encounter.status, locale) ?? encounter.status ?? ''}
              readOnly
            />
          </label>

          <label>
            {t('encounterUpdate.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          <label>
            {t('encounterUpdate.practitionerHzjz')}
            <input type="text" value={session.hzjzId} readOnly />
          </label>

          <label>
            {t('encounterUpdate.organizationHzzo')}
            <input
              type="text"
              value={organizationHzzoCode}
              onChange={(e) => setOrganizationHzzoCode(e.target.value)}
              required
            />
          </label>

          <label>
            {t('encounterUpdate.periodStart')}
            <input
              type="datetime-local"
              value={periodStartLocal}
              onChange={(e) => setPeriodStartLocal(e.target.value)}
              required
            />
          </label>

          <label>
            {t('encounterUpdate.admissionClass')}
            <select value={classCode} onChange={(e) => setClassCode(e.target.value)} required>
              {classOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} — {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('encounterUpdate.priority')}
            <select value={priorityCode} onChange={(e) => setPriorityCode(e.target.value)}>
              <option value="">{t('encounterUpdate.priorityNone')}</option>
              {priorityOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} — {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('encounterUpdate.localIdentifier')}
            <input
              type="text"
              value={localIdentifier}
              onChange={(e) => setLocalIdentifier(e.target.value)}
              placeholder={t('encounterUpdate.localIdentifierHint')}
            />
          </label>

          <label>
            {t('encounterUpdate.additionalParticipants')}
            <input
              type="text"
              value={additionalParticipants}
              onChange={(e) => setAdditionalParticipants(e.target.value)}
              placeholder={t('encounterUpdate.additionalParticipantsHint')}
            />
          </label>

          <label>
            {t('encounterUpdate.diagnosisCaseIds')}
            <input
              type="text"
              value={diagnosisCaseIds}
              onChange={(e) => setDiagnosisCaseIds(e.target.value)}
              placeholder={t('encounterUpdate.diagnosisCaseIdsHint')}
            />
          </label>

          <fieldset className="encounter-fieldset">
            <legend>{t('encounterUpdate.participationCost')}</legend>
            <label>
              {t('encounterUpdate.participationOznaka')}
              <input
                type="text"
                value={participationOznaka}
                onChange={(e) => setParticipationOznaka(e.target.value)}
                placeholder="N"
              />
            </label>
            <label>
              {t('encounterUpdate.participationSifra')}
              <input
                type="text"
                value={participationSifra}
                onChange={(e) => setParticipationSifra(e.target.value)}
              />
            </label>
          </fieldset>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('encounterUpdate.cancel')}
            </button>
            <button type="submit" disabled={loading}>
              {loading ? t('encounterUpdate.submitting') : t('encounterUpdate.submit')}
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
