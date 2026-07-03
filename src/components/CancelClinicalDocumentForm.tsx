import { type FormEvent, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { cancelDocument } from '../data/documentApi';
import type { DocumentSummary, PatientSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatus } from '../utils/formatFhirCode';
import { formatDateTime } from '../utils/localeFormat';

interface CancelClinicalDocumentFormProps {
  patient: PatientSummary;
  session: PractitionerSession;
  document: DocumentSummary;
  onCancel: () => void;
  onCancelled: (summary: DocumentSummary, documentReferenceId: string) => void;
}

export function CancelClinicalDocumentForm({
  patient,
  session,
  document,
  onCancel,
  onCancelled,
}: CancelClinicalDocumentFormProps) {
  const { locale, t } = useLocale();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!patient.mbo) {
      setError(t('documentCancel.missingPatientMbo'));
      setLoading(false);
      return;
    }
    if (!reason.trim()) {
      setError(t('documentCancel.reasonRequired'));
      setLoading(false);
      return;
    }

    try {
      const result = await cancelDocument(session, {
        documentReferenceId: document.id,
        patientMbo: patient.mbo,
        practitionerHzjzId: session.hzjzId,
        reason: reason.trim(),
      });

      if (result.outcome === 'success') {
        onCancelled(result.summary, result.documentReferenceId);
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('documentCancel.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('documentCancel.failed'));
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = formatFhirStatus(document.compositionStatus, locale) ?? document.compositionStatus;

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="modal-panel modal-panel--document"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-document-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="cancel-document-title">{t('documentCancel.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('documentCancel.cancel')}
          </button>
        </header>

        <p className="modal-hint">{t('documentCancel.hint')}</p>

        <form className="modal-form modal-form--document" onSubmit={handleSubmit}>
          <fieldset>
            <legend>{t('documentCancel.document')}</legend>
            <ul className="summary-list">
              <li>
                {t('documentCancel.documentId')}: {document.id}
              </li>
              <li>
                {t('documentCancel.documentType')}: {document.typeDisplay}
              </li>
              <li>
                {t('documentCancel.status')}: {statusLabel}
              </li>
              <li>
                {t('documentCancel.date')}:{' '}
                {document.date ? formatDateTime(document.date, locale) : t('common.emDash')}
              </li>
            </ul>
          </fieldset>

          <label>
            {t('documentCancel.reason')}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              placeholder={t('documentCancel.reasonHint')}
            />
          </label>

          {error && <p className="error">{error}</p>}
          {fieldErrors.length > 0 && (
            <ul className="field-errors">
              {fieldErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('documentCancel.dismiss')}
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? t('documentCancel.submitting') : t('documentCancel.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
