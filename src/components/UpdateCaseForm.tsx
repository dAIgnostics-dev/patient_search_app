import { type FormEvent, useMemo, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { updateCase } from '../data/caseApi';
import {
  CASE_VERIFICATION_STATUS_OPTIONS,
  formatCaseVerificationStatusLabel,
} from '../data/case-management/caseMessageShared';
import { DIAGNOSIS_CATALOG } from '../data/case-management/diagnosisCatalog';
import type { ConditionSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatusPair } from '../utils/formatFhirCode';

interface UpdateCaseFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  condition: ConditionSummary;
  onCancel: () => void;
  onUpdated: (condition: ConditionSummary, caseId: string) => void;
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function UpdateCaseForm({
  patient,
  session,
  condition,
  onCancel,
  onUpdated,
}: UpdateCaseFormProps) {
  const { locale, t } = useLocale();
  const status = (condition.clinicalStatus ?? '').toLowerCase();
  const canEditAbatementDate = status === 'resolved' || status === 'remission';
  const initialDiagnosis =
    DIAGNOSIS_CATALOG.find((item) => item.code === condition.icd10Code) ??
    (condition.icd10Code && condition.display
      ? { code: condition.icd10Code, display: condition.display }
      : DIAGNOSIS_CATALOG[0]);

  const [diagnosisCode, setDiagnosisCode] = useState(initialDiagnosis?.code ?? '');
  const [verificationStatus, setVerificationStatus] = useState(
    condition.verificationStatus ?? 'unconfirmed',
  );
  const [onsetDate, setOnsetDate] = useState(dateInputValue(condition.onsetDate));
  const [abatementDate, setAbatementDate] = useState(
    condition.abatementDate ? condition.abatementDate.slice(0, 10) : '',
  );
  const [localIdentifier, setLocalIdentifier] = useState('');
  const [note, setNote] = useState(condition.note ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const diagnosisOptions = useMemo(() => {
    if (
      condition.icd10Code &&
      condition.display &&
      !DIAGNOSIS_CATALOG.some((item) => item.code === condition.icd10Code)
    ) {
      return [...DIAGNOSIS_CATALOG, { code: condition.icd10Code, display: condition.display }];
    }
    return DIAGNOSIS_CATALOG;
  }, [condition.display, condition.icd10Code]);
  const selectedDiagnosis =
    diagnosisOptions.find((item) => item.code === diagnosisCode) ?? diagnosisOptions[0];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t('caseUpdate.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!condition.caseId) {
      setError(t('caseUpdate.requiresCaseId'));
      setLoading(false);
      return;
    }
    if (!condition.clinicalStatus) {
      setError(t('caseUpdate.requiresClinicalStatus'));
      setLoading(false);
      return;
    }
    if (!selectedDiagnosis) {
      setError(t('caseUpdate.missingDiagnosis'));
      setLoading(false);
      return;
    }

    try {
      const result = await updateCase(session, {
        caseId: condition.caseId,
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
        clinicalStatus: condition.clinicalStatus,
        localIdentifier: localIdentifier.trim() || undefined,
        verificationStatus: verificationStatus as 'confirmed' | 'unconfirmed' | 'provisional',
        diagnosisCode: selectedDiagnosis.code,
        diagnosisDisplay: selectedDiagnosis.display,
        diagnosisText: selectedDiagnosis.display,
        onsetDate,
        abatementDate: canEditAbatementDate ? abatementDate.trim() || undefined : undefined,
        note: note.trim() || undefined,
      });

      if (result.outcome === 'success') {
        onUpdated(result.condition, result.caseId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('caseUpdate.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('caseUpdate.failed'));
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
        aria-labelledby="update-case-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="update-case-title">{t('caseUpdate.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('caseUpdate.cancel')}
          </button>
        </header>

        <p className="form-hint">{t('caseUpdate.hint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('caseUpdate.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          <label>
            {t('caseUpdate.case')}
            <input
              type="text"
              value={[condition.icd10Code, condition.display].filter(Boolean).join(' - ')}
              readOnly
            />
          </label>

          <label>
            {t('caseUpdate.status')}
            <input
              type="text"
              value={formatFhirStatusPair(condition.clinicalStatus, condition.verificationStatus, locale)}
              readOnly
            />
          </label>

          <label>
            {t('caseUpdate.verificationStatus')}
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
            {t('caseUpdate.diagnosis')}
            <select
              value={diagnosisCode}
              onChange={(e) => setDiagnosisCode(e.target.value)}
              required
            >
              {diagnosisOptions.map((diagnosis) => (
                <option key={diagnosis.code} value={diagnosis.code}>
                  {diagnosis.code} - {diagnosis.display}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t('caseUpdate.onsetDate')}
            <input
              type="date"
              value={onsetDate}
              onChange={(e) => setOnsetDate(e.target.value)}
              required
            />
          </label>

          {canEditAbatementDate ? (
            <label>
              {t('caseUpdate.abatementDate')}
              <input
                type="date"
                value={abatementDate}
                onChange={(e) => setAbatementDate(e.target.value)}
              />
            </label>
          ) : (
            <p className="form-hint">{t('caseUpdate.abatementDateUnavailable')}</p>
          )}

          <label>
            {t('caseUpdate.localIdentifier')}
            <input
              type="text"
              value={localIdentifier}
              onChange={(e) => setLocalIdentifier(e.target.value)}
              placeholder={t('caseUpdate.localIdentifierHint')}
            />
          </label>

          <label>
            {t('caseUpdate.note')}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('caseUpdate.noteHint')}
              rows={3}
            />
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('caseUpdate.cancel')}
            </button>
            <button type="submit" disabled={loading}>
              {loading ? t('caseUpdate.submitting') : t('caseUpdate.submit')}
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
