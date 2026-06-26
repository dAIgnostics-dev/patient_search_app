import { type FormEvent, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { remissionCase } from '../data/caseApi';
import type { ConditionSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatusPair } from '../utils/formatFhirCode';

interface RemissionCaseFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  condition: ConditionSummary;
  onCancel: () => void;
  onRemissioned: (condition: ConditionSummary, caseId: string) => void;
}

export function RemissionCaseForm({
  patient,
  session,
  condition,
  onCancel,
  onRemissioned,
}: RemissionCaseFormProps) {
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
      setError(t('caseRemission.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!condition.caseId) {
      setError(t('caseRemission.requiresCaseId'));
      setLoading(false);
      return;
    }
    if (!confirmed) {
      setError(t('caseRemission.confirmRequired'));
      setLoading(false);
      return;
    }

    try {
      const result = await remissionCase(session, {
        caseId: condition.caseId,
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
      });

      if (result.outcome === 'success') {
        onRemissioned(result.condition, result.caseId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('caseRemission.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('caseRemission.failed'));
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
        aria-labelledby="remission-case-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="remission-case-title">{t('caseRemission.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('caseRemission.cancel')}
          </button>
        </header>

        <p className="form-hint">{t('caseRemission.hint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('caseRemission.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          <label>
            {t('caseRemission.case')}
            <input
              type="text"
              value={[condition.icd10Code, condition.display].filter(Boolean).join(' - ')}
              readOnly
            />
          </label>

          <label>
            {t('caseRemission.status')}
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
            {t('caseRemission.confirmLabel')}
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('caseRemission.cancel')}
            </button>
            <button type="submit" disabled={loading || !confirmed}>
              {loading ? t('caseRemission.submitting') : t('caseRemission.submit')}
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
