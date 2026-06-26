import { type FormEvent, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { relapseCase } from '../data/caseApi';
import type { ConditionSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatusPair } from '../utils/formatFhirCode';

interface RelapseCaseFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  condition: ConditionSummary;
  onCancel: () => void;
  onRelapsed: (condition: ConditionSummary, caseId: string) => void;
}

export function RelapseCaseForm({
  patient,
  session,
  condition,
  onCancel,
  onRelapsed,
}: RelapseCaseFormProps) {
  const { locale, t } = useLocale();
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
      setError(t('caseRelapse.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!condition.caseId) {
      setError(t('caseRelapse.requiresCaseId'));
      setLoading(false);
      return;
    }
    if (!confirmed) {
      setError(t('caseRelapse.confirmRequired'));
      setLoading(false);
      return;
    }

    try {
      const result = await relapseCase(session, {
        caseId: condition.caseId,
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
      });

      if (result.outcome === 'success') {
        onRelapsed(result.condition, result.caseId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('caseRelapse.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('caseRelapse.failed'));
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
        aria-labelledby="relapse-case-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="relapse-case-title">{t('caseRelapse.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('caseRelapse.cancel')}
          </button>
        </header>

        <p className="form-hint">{t('caseRelapse.hint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('caseRelapse.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          <label>
            {t('caseRelapse.case')}
            <input
              type="text"
              value={[condition.icd10Code, condition.display].filter(Boolean).join(' - ')}
              readOnly
            />
          </label>

          <label>
            {t('caseRelapse.status')}
            <input
              type="text"
              value={formatFhirStatusPair(condition.clinicalStatus, condition.verificationStatus, locale)}
              readOnly
            />
          </label>

          <label className="control-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t('caseRelapse.confirmLabel')}
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('caseRelapse.cancel')}
            </button>
            <button type="submit" disabled={loading || !confirmed}>
              {loading ? t('caseRelapse.submitting') : t('caseRelapse.submit')}
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
