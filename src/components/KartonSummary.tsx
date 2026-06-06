import type { PatientDetail } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import {
  formatActiveConditionCount,
  formatDate,
  formatPractitionerCount,
} from '../utils/localeFormat';

interface KartonSummaryProps {
  detail: PatientDetail;
}

function activeConditions(detail: PatientDetail) {
  return detail.conditions.filter(
    (c) => !c.clinicalStatus || c.clinicalStatus.toLowerCase() === 'active',
  );
}

function latestEncounter(detail: PatientDetail) {
  if (detail.encounters.length === 0) return null;
  return [...detail.encounters].sort((a, b) => {
    const ta = a.start ? Date.parse(a.start) : 0;
    const tb = b.start ? Date.parse(b.start) : 0;
    return tb - ta;
  })[0];
}

export function KartonSummary({ detail }: KartonSummaryProps) {
  const { locale, t } = useLocale();
  const active = activeConditions(detail);
  const latest = latestEncounter(detail);

  return (
    <div className="karton-summary">
      <div className="summary-card">
        <h4>{t('summary.activeConditions')}</h4>
        {active.length === 0 ? (
          <p className="summary-value">{t('summary.noneDocumented')}</p>
        ) : (
          <>
            <p className="summary-value">
              {formatActiveConditionCount(active.length, locale)}
            </p>
            <ul className="summary-list">
              {active.slice(0, 3).map((c) => (
                <li key={c.id}>
                  {c.icd10Code} — {c.display}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="summary-card">
        <h4>{t('summary.lastEncounter')}</h4>
        {!latest ? (
          <p className="summary-value">{t('summary.noEncounters')}</p>
        ) : (
          <>
            <p className="summary-value">
              {latest.classDisplay ?? latest.classCode ?? t('karton.visit')}
            </p>
            <p className="summary-meta">
              {formatDate(latest.start, locale) ?? t('common.emDash')}
              {detail.primaryOrganizationName && ` · ${detail.primaryOrganizationName}`}
            </p>
          </>
        )}
      </div>

      <div className="summary-card">
        <h4>{t('summary.careTeam')}</h4>
        <p className="summary-value">
          {formatPractitionerCount(detail.practitioners.length, locale)}
        </p>
        {detail.primaryOrganizationName && (
          <p className="summary-meta">{detail.primaryOrganizationName}</p>
        )}
      </div>
    </div>
  );
}
