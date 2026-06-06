import type { AllergySummary, PatientDetail } from '../domain/models';
import { useLocale } from '../i18n/LocaleContext';
import { formatAge, formatGender } from '../utils/localeFormat';
import { patientAge } from '../utils/patientAge';

interface PatientBannerProps {
  detail: PatientDetail;
}

function isHighCriticality(allergy: AllergySummary): boolean {
  const criticality = allergy.criticality?.toLowerCase();
  return criticality === 'high' || criticality === 'unable-to-assess';
}

function activeConditions(detail: PatientDetail) {
  return detail.conditions.filter(
    (c) => !c.clinicalStatus || c.clinicalStatus.toLowerCase() === 'active',
  );
}

export function PatientBanner({ detail }: PatientBannerProps) {
  const { locale, t } = useLocale();
  const age = patientAge(detail.birthDate);
  const criticalAllergies = detail.allergies.filter(isHighCriticality);
  const active = activeConditions(detail).slice(0, 3);
  const genderLabel = formatGender(detail.gender, locale);

  return (
    <header className="patient-banner">
      <div className="patient-banner-main">
        <h2 className="patient-banner-name">
          {detail.firstName} {detail.lastName}
        </h2>
        <p className="patient-banner-meta">
          {t('mbo.label')} {detail.mbo ?? t('common.emDash')}
          {age != null && ` · ${formatAge(age, locale)}`}
          {genderLabel && ` · ${genderLabel}`}
        </p>
      </div>
      <div className="patient-banner-badges">
        {active.length > 0 && (
          <div
            className="patient-banner-conditions"
            role="list"
            aria-label={t('karton.activeConditions')}
          >
            {active.map((cond) => (
              <span key={cond.id} className="condition-badge" role="listitem">
                {cond.icd10Code ? `${cond.icd10Code} ` : ''}
                {cond.display ?? t('karton.conditions')}
              </span>
            ))}
          </div>
        )}
        {criticalAllergies.length > 0 && (
          <div
            className="patient-banner-allergies"
            role="list"
            aria-label={t('karton.criticalAllergies')}
          >
            {criticalAllergies.map((allergy) => (
              <span key={allergy.id} className="allergy-badge" role="listitem">
                {allergy.display ?? allergy.code ?? t('karton.allergy')}
              </span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
