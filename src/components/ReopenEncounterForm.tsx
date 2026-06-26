import { type FormEvent, useMemo, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { resolveCezihDefaultOrgHzzo } from '../config/runtime';
import { ADMISSION_CLASS_OPTIONS } from '../data/encounter-management/encounterMessageShared';
import { reopenEncounter } from '../data/encounterApi';
import type { EncounterSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatus } from '../utils/formatFhirCode';
import { enrichEncounterSummary } from '../utils/enrichEncounterSummary';

interface ReopenEncounterFormProps {
  session: PractitionerSession;
  encounter: EncounterSummary;
  onCancel: () => void;
  onReopened: (encounter: EncounterSummary, visitId: string) => void;
}

export function ReopenEncounterForm({
  session,
  encounter,
  onCancel,
  onReopened,
}: ReopenEncounterFormProps) {
  const { locale, t } = useLocale();
  const [organizationHzzoCode, setOrganizationHzzoCode] = useState(
    encounter.organizationFhirId ?? resolveCezihDefaultOrgHzzo(),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const classLabel = useMemo(() => {
    const option = ADMISSION_CLASS_OPTIONS.find((item) => item.code === encounter.classCode);
    if (!option) return encounter.classDisplay ?? encounter.classCode ?? '';
    return locale === 'hr' ? option.displayHr : option.displayEn;
  }, [encounter.classCode, encounter.classDisplay, locale]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors([]);

    if (!confirmed) {
      setError(t('encounterReopen.confirmRequired'));
      setLoading(false);
      return;
    }
    if (!encounter.visitId) {
      setError(t('encounterReopen.requiresVisitId'));
      setLoading(false);
      return;
    }
    if (!encounter.classCode) {
      setError(t('encounterReopen.missingClass'));
      setLoading(false);
      return;
    }

    try {
      const result = await reopenEncounter(session, {
        visitId: encounter.visitId,
        practitionerHzjzId: session.hzjzId,
        organizationHzzoCode,
        classCode: encounter.classCode,
        classDisplay: classLabel || encounter.classDisplay || undefined,
      });

      if (result.outcome === 'success') {
        onReopened(
          enrichEncounterSummary(result.encounter, session, {
            organizationHzzoCode,
          }),
          result.visitId,
        );
        return;
      }

      const messages = result.issues.map(
        (issue) => issue.diagnostics ?? `${issue.severity}: ${issue.code}`,
      );
      setFieldErrors(messages);
      setError(t('encounterReopen.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('encounterReopen.failed'));
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
        aria-labelledby="reopen-encounter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="reopen-encounter-title">{t('encounterReopen.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('encounterReopen.dismiss')}
          </button>
        </header>

        <p className="form-hint">{t('encounterReopen.statusChangeHint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('encounterReopen.visitId')}
            <input type="text" value={encounter.visitId ?? ''} readOnly />
          </label>

          <label>
            {t('encounterReopen.status')}
            <input
              type="text"
              value={formatFhirStatus(encounter.status, locale) ?? encounter.status ?? ''}
              readOnly
            />
          </label>

          <label>
            {t('encounterReopen.practitionerHzjz')}
            <input type="text" value={session.hzjzId} readOnly />
          </label>

          <label>
            {t('encounterReopen.organizationHzzo')}
            <input
              type="text"
              value={organizationHzzoCode}
              onChange={(e) => setOrganizationHzzoCode(e.target.value)}
              required
            />
          </label>

          <label>
            {t('encounterReopen.admissionClass')}
            <input
              type="text"
              value={
                encounter.classCode
                  ? `${encounter.classCode}${classLabel ? ` — ${classLabel}` : ''}`
                  : ''
              }
              readOnly
            />
          </label>

          <label className="control-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t('encounterReopen.confirmLabel')}
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('encounterReopen.dismiss')}
            </button>
            <button type="submit" disabled={loading || !confirmed}>
              {loading ? t('encounterReopen.submitting') : t('encounterReopen.submit')}
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
