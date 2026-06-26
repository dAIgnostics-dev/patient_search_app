import { type FormEvent, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { deleteCase } from '../data/caseApi';
import type { ConditionSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatusPair } from '../utils/formatFhirCode';

interface DeleteCaseFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  condition: ConditionSummary;
  onCancel: () => void;
  onDeleted: (condition: ConditionSummary, caseId: string) => void;
}

export function DeleteCaseForm({
  patient,
  session,
  condition,
  onCancel,
  onDeleted,
}: DeleteCaseFormProps) {
  const { locale, t } = useLocale();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t('caseDelete.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!condition.caseId) {
      setError(t('caseDelete.requiresCaseId'));
      setLoading(false);
      return;
    }
    if (!reason.trim()) {
      setError(t('caseDelete.reasonRequired'));
      setLoading(false);
      return;
    }

    try {
      const result = await deleteCase(session, {
        caseId: condition.caseId,
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
        reason,
        note: note.trim() || undefined,
      });

      if (result.outcome === 'success') {
        onDeleted(result.condition, result.caseId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('caseDelete.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('caseDelete.failed'));
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
        aria-labelledby="delete-case-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="delete-case-title">{t('caseDelete.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('caseDelete.cancel')}
          </button>
        </header>

        <p className="form-hint">{t('caseDelete.hint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('caseDelete.patientMbo')}
            <input type="text" value={patient.mbo ?? ''} readOnly />
          </label>

          <label>
            {t('caseDelete.case')}
            <input
              type="text"
              value={[condition.icd10Code, condition.display].filter(Boolean).join(' - ')}
              readOnly
            />
          </label>

          <label>
            {t('caseDelete.status')}
            <input
              type="text"
              value={formatFhirStatusPair(condition.clinicalStatus, condition.verificationStatus, locale)}
              readOnly
            />
          </label>

          <label>
            {t('caseDelete.reason')}
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('caseDelete.reasonHint')}
              required
            />
          </label>

          <label>
            {t('caseDelete.note')}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('caseDelete.noteHint')}
            />
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('caseDelete.cancel')}
            </button>
            <button type="submit" disabled={loading || !reason.trim()}>
              {loading ? t('caseDelete.submitting') : t('caseDelete.submit')}
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
