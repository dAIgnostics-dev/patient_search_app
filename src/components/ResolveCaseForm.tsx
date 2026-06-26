import { type FormEvent, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { resolveCase } from '../data/caseApi';
import type { ConditionSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatusPair } from '../utils/formatFhirCode';

interface ResolveCaseFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  condition: ConditionSummary;
  onCancel: () => void;
  onResolved: (condition: ConditionSummary, caseId: string) => void;
}

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ResolveCaseForm({
  patient,
  session,
  condition,
  onCancel,
  onResolved,
}: ResolveCaseFormProps) {
  const { locale, t } = useLocale();
  const [abatementDate, setAbatementDate] = useState(todayDateValue);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t('caseResolve.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!condition.caseId) {
      setError(t('caseResolve.requiresCaseId'));
      setLoading(false);
      return;
    }
    if (!abatementDate.trim()) {
      setError(t('caseResolve.abatementDateRequired'));
      setLoading(false);
      return;
    }
    if (!confirmed) {
      setError(t('caseResolve.confirmRequired'));
      setLoading(false);
      return;
    }

    try {
      const result = await resolveCase(session, {
        caseId: condition.caseId,
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
        abatementDate,
      });

      if (result.outcome === 'success') {
        onResolved(result.condition, result.caseId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('caseResolve.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('caseResolve.failed'));
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
        aria-labelledby="resolve-case-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="resolve-case-title">{t('caseResolve.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('caseResolve.cancel')}
          </button>
        </header>

        <p className="form-hint">{t('caseResolve.hint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('caseResolve.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          <label>
            {t('caseResolve.case')}
            <input
              type="text"
              value={[condition.icd10Code, condition.display].filter(Boolean).join(' - ')}
              readOnly
            />
          </label>

          <label>
            {t('caseResolve.status')}
            <input
              type="text"
              value={formatFhirStatusPair(condition.clinicalStatus, condition.verificationStatus, locale)}
              readOnly
            />
          </label>

          <label>
            {t('caseResolve.abatementDate')}
            <input
              type="date"
              value={abatementDate}
              onChange={(e) => setAbatementDate(e.target.value)}
              required
            />
          </label>

          <label className="control-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t('caseResolve.confirmLabel')}
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('caseResolve.cancel')}
            </button>
            <button type="submit" disabled={loading || !confirmed || !abatementDate.trim()}>
              {loading ? t('caseResolve.submitting') : t('caseResolve.submit')}
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
