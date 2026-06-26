import { type FormEvent, useMemo, useState } from 'react';
import type { PractitionerSession } from '../auth/types';
import { resolveCezihDefaultOrgHzzo } from '../config/runtime';
import { ADMISSION_CLASS_OPTIONS } from '../data/encounter-management/encounterMessageShared';
import { closeEncounter } from '../data/encounterApi';
import type { EncounterSummary } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatFhirStatus } from '../utils/formatFhirCode';
import { enrichEncounterSummary } from '../utils/enrichEncounterSummary';

interface CloseEncounterFormProps {
  session: PractitionerSession;
  encounter: EncounterSummary;
  onCancel: () => void;
  onClosed: (encounter: EncounterSummary, visitId: string) => void;
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

export function CloseEncounterForm({
  session,
  encounter,
  onCancel,
  onClosed,
}: CloseEncounterFormProps) {
  const { locale, t } = useLocale();
  const [organizationHzzoCode, setOrganizationHzzoCode] = useState(
    encounter.organizationFhirId ?? resolveCezihDefaultOrgHzzo(),
  );
  const [periodEndLocal, setPeriodEndLocal] = useState(toDatetimeLocalValue(undefined));
  const [diagnosisCaseIds, setDiagnosisCaseIds] = useState('');
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

    if (!encounter.visitId) {
      setError(t('encounterClose.requiresVisitId'));
      setLoading(false);
      return;
    }
    if (!encounter.start) {
      setError(t('encounterClose.missingPeriodStart'));
      setLoading(false);
      return;
    }
    if (!encounter.classCode) {
      setError(t('encounterClose.missingClass'));
      setLoading(false);
      return;
    }

    const caseIds = parseCommaSeparated(diagnosisCaseIds);

    try {
      const result = await closeEncounter(session, {
        visitId: encounter.visitId,
        practitionerHzjzId: session.hzjzId,
        organizationHzzoCode,
        periodStart: encounter.start,
        periodEnd: fromDatetimeLocalValue(periodEndLocal),
        classCode: encounter.classCode,
        classDisplay: classLabel || encounter.classDisplay || undefined,
        diagnosisCaseIds: caseIds.length > 0 ? caseIds : undefined,
      });

      if (result.outcome === 'success') {
        onClosed(
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
      setError(t('encounterClose.failed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('encounterClose.failed'));
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
        aria-labelledby="close-encounter-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="close-encounter-title">{t('encounterClose.title')}</h2>
          <button type="button" className="secondary-button modal-close" onClick={onCancel}>
            {t('encounterClose.cancel')}
          </button>
        </header>

        <p className="form-hint">{t('encounterClose.statusChangeHint')}</p>

        <form className="search-form encounter-create-form" onSubmit={handleSubmit}>
          <label>
            {t('encounterClose.visitId')}
            <input type="text" value={encounter.visitId ?? ''} readOnly />
          </label>

          <label>
            {t('encounterClose.status')}
            <input
              type="text"
              value={formatFhirStatus(encounter.status, locale) ?? encounter.status ?? ''}
              readOnly
            />
          </label>

          <label>
            {t('encounterClose.practitionerHzjz')}
            <input type="text" value={session.hzjzId} readOnly />
          </label>

          <label>
            {t('encounterClose.organizationHzzo')}
            <input
              type="text"
              value={organizationHzzoCode}
              onChange={(e) => setOrganizationHzzoCode(e.target.value)}
              required
            />
          </label>

          <label>
            {t('encounterClose.periodStart')}
            <input
              type="datetime-local"
              value={encounter.start ? toDatetimeLocalValue(encounter.start) : ''}
              readOnly
            />
          </label>

          <label>
            {t('encounterClose.periodEnd')}
            <input
              type="datetime-local"
              value={periodEndLocal}
              onChange={(e) => setPeriodEndLocal(e.target.value)}
              required
            />
          </label>

          <label>
            {t('encounterClose.admissionClass')}
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

          <label>
            {t('encounterClose.diagnosisCaseIds')}
            <input
              type="text"
              value={diagnosisCaseIds}
              onChange={(e) => setDiagnosisCaseIds(e.target.value)}
              placeholder={t('encounterClose.diagnosisCaseIdsHint')}
            />
          </label>

          <div className="search-actions">
            <button type="button" className="secondary-button" onClick={onCancel} disabled={loading}>
              {t('encounterClose.cancel')}
            </button>
            <button type="submit" disabled={loading}>
              {loading ? t('encounterClose.submitting') : t('encounterClose.submit')}
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
