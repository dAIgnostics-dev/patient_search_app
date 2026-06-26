import { type FormEvent, useMemo, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { createCase, createCaseRecurrence } from '../data/caseApi';
import {
  CASE_VERIFICATION_STATUS_OPTIONS,
  formatCaseVerificationStatusLabel,
} from '../data/case-management/caseMessageShared';
import { DIAGNOSIS_CATALOG } from '../data/case-management/diagnosisCatalog';
import type { ConditionSummary, EncounterSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import { formatDateTime } from '../utils/localeFormat';

function formatOpenEncounterLabel(
  encounter: EncounterSummary,
  locale: 'hr' | 'en',
  t: (key: TranslationKey) => string,
): string {
  const parts = [
    formatDateTime(encounter.start, locale),
    encounter.classDisplay ?? encounter.classCode,
    encounter.organizationName,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : t('karton.encounter');
}

function formatPreviousCaseLabel(
  condition: ConditionSummary,
  locale: 'hr' | 'en',
  t: (key: TranslationKey) => string,
): string {
  const diagnosis = [condition.icd10Code, condition.display].filter(Boolean).join(' — ');
  const period = [
    condition.onsetDate ? formatDateTime(condition.onsetDate, locale) : null,
    condition.abatementDate ? formatDateTime(condition.abatementDate, locale) : null,
  ].filter(Boolean);
  const periodLabel = period.length > 0 ? period.join(' - ') : null;
  return [diagnosis || t('karton.conditions'), periodLabel].filter(Boolean).join(' · ');
}

interface CreateCaseFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  openEncounters: EncounterSummary[];
  mode?: 'create' | 'recurrence';
  previousCases?: ConditionSummary[];
  onCancel: () => void;
  onCreated: (condition: ConditionSummary, caseId: string) => void;
}

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CreateCaseForm({
  patient,
  session,
  openEncounters,
  mode = 'create',
  previousCases = [],
  onCancel,
  onCreated,
}: CreateCaseFormProps) {
  const { locale, t } = useLocale();
  const isRecurrence = mode === 'recurrence';
  const initialPreviousCase = previousCases[0] ?? null;
  const [encounterVisitId, setEncounterVisitId] = useState(openEncounters[0]?.visitId ?? '');
  const [previousCaseId, setPreviousCaseId] = useState(initialPreviousCase?.caseId ?? '');
  const [diagnosisCode, setDiagnosisCode] = useState(
    initialPreviousCase?.icd10Code ?? DIAGNOSIS_CATALOG[0]?.code ?? '',
  );
  const [onsetDate, setOnsetDate] = useState(todayDateValue());
  const [verificationStatus, setVerificationStatus] = useState('unconfirmed');
  const [localIdentifier, setLocalIdentifier] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const selectedDiagnosis = useMemo(
    () =>
      DIAGNOSIS_CATALOG.find((item) => item.code === diagnosisCode) ??
      previousCases
        .filter((item) => item.icd10Code && item.display)
        .map((item) => ({ code: item.icd10Code!, display: item.display! }))
        .find((item) => item.code === diagnosisCode) ??
      DIAGNOSIS_CATALOG[0],
    [diagnosisCode, previousCases],
  );
  const diagnosisOptions = useMemo(() => {
    const options = [...DIAGNOSIS_CATALOG];
    for (const condition of previousCases) {
      if (!condition.icd10Code || !condition.display) continue;
      if (!options.some((item) => item.code === condition.icd10Code)) {
        options.push({ code: condition.icd10Code, display: condition.display });
      }
    }
    return options;
  }, [previousCases]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t('caseCreate.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!encounterVisitId) {
      setError(t('caseCreate.requiresOpenEncounter'));
      setLoading(false);
      return;
    }
    if (!selectedDiagnosis) {
      setError(t('caseCreate.missingDiagnosis'));
      setLoading(false);
      return;
    }
    if (isRecurrence && !previousCaseId) {
      setError(t('caseRecurrenceCreate.requiresPreviousCase'));
      setLoading(false);
      return;
    }

    try {
      const input = {
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
        encounterVisitId,
        onsetDate,
        diagnosisCode: selectedDiagnosis.code,
        diagnosisDisplay: selectedDiagnosis.display,
        diagnosisText: selectedDiagnosis.display,
        verificationStatus: verificationStatus as 'confirmed' | 'unconfirmed' | 'provisional',
        localIdentifier: localIdentifier.trim() || undefined,
        note: note.trim() || undefined,
      };
      const result = isRecurrence
        ? await createCaseRecurrence(session, { ...input, previousCaseId })
        : await createCase(session, input);

      if (result.outcome === 'success') {
        onCreated(result.condition, result.caseId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t(isRecurrence ? 'caseRecurrenceCreate.failed' : 'caseCreate.failed'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(isRecurrence ? 'caseRecurrenceCreate.failed' : 'caseCreate.failed'),
      );
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
        aria-labelledby="create-case-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="create-case-title">
            {t(isRecurrence ? 'caseRecurrenceCreate.title' : 'caseCreate.title')}
          </h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('caseCreate.cancel')}
          </button>
        </header>

        <p className="form-hint">
          {t(isRecurrence ? 'caseRecurrenceCreate.hint' : 'caseCreate.hint')}
        </p>
        {isRecurrence && previousCases.length === 0 && (
          <p className="warning-banner">{t('caseRecurrenceCreate.noPreviousCases')}</p>
        )}

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('caseCreate.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          {isRecurrence && previousCases.length > 0 && (
            <label>
              {t('caseRecurrenceCreate.previousCase')}
              <select
                value={previousCaseId}
                onChange={(e) => {
                  const nextCaseId = e.target.value;
                  setPreviousCaseId(nextCaseId);
                  const nextCase = previousCases.find((item) => item.caseId === nextCaseId);
                  if (nextCase?.icd10Code) setDiagnosisCode(nextCase.icd10Code);
                }}
                required
              >
                {previousCases.map((condition) => (
                  <option key={condition.id} value={condition.caseId ?? ''}>
                    {formatPreviousCaseLabel(condition, locale, t)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            {t('caseCreate.encounter')}
            <select
              value={encounterVisitId}
              onChange={(e) => setEncounterVisitId(e.target.value)}
              required
            >
              {openEncounters.map((encounter) => (
                <option key={encounter.id} value={encounter.visitId ?? ''}>
                  {formatOpenEncounterLabel(encounter, locale, t)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('caseCreate.diagnosis')}
            <select
              value={diagnosisCode}
              onChange={(e) => setDiagnosisCode(e.target.value)}
              required
            >
              {diagnosisOptions.map((diagnosis) => (
                <option key={diagnosis.code} value={diagnosis.code}>
                  {diagnosis.code} — {diagnosis.display}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('caseCreate.onsetDate')}
            <input
              type="date"
              value={onsetDate}
              onChange={(e) => setOnsetDate(e.target.value)}
              required
            />
          </label>

          <label>
            {t('caseCreate.verificationStatus')}
            <select
              value={verificationStatus}
              onChange={(e) => setVerificationStatus(e.target.value)}
              required
            >
              {CASE_VERIFICATION_STATUS_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {formatCaseVerificationStatusLabel(option.code, locale)}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('caseCreate.localIdentifier')}
            <input
              type="text"
              value={localIdentifier}
              onChange={(e) => setLocalIdentifier(e.target.value)}
              placeholder={t('caseCreate.localIdentifierHint')}
            />
          </label>

          <label>
            {t('caseCreate.note')}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('caseCreate.noteHint')}
            />
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('caseCreate.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || openEncounters.length === 0 || (isRecurrence && previousCases.length === 0)}
            >
              {loading
                ? t(isRecurrence ? 'caseRecurrenceCreate.submitting' : 'caseCreate.submitting')
                : t(isRecurrence ? 'caseRecurrenceCreate.submit' : 'caseCreate.submit')}
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
