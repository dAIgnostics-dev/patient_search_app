import type { Locale } from '../i18n/types';
import { translate, type TranslationKey } from '../i18n/translations';

function intlLocale(locale: Locale): string {
  return locale === 'hr' ? 'hr-HR' : 'en-GB';
}

export function formatDate(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined, locale: Locale): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

const GENDER_KEYS: Record<string, TranslationKey> = {
  male: 'gender.male',
  female: 'gender.female',
  other: 'gender.other',
  unknown: 'gender.unknown',
};

export function formatGender(gender: string | null | undefined, locale: Locale): string | null {
  if (!gender) return null;
  const key = GENDER_KEYS[gender.toLowerCase()];
  return key ? translate(locale, key) : gender;
}

/** Croatian age pluralization; English uses simple rule. */
export function formatAge(age: number, locale: Locale): string {
  if (locale === 'hr') {
    const mod10 = age % 10;
    const mod100 = age % 100;
    if (mod10 === 1 && mod100 !== 11) return translate(locale, 'karton.yearsOne');
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return translate(locale, 'karton.yearsFew', { count: age });
    }
    return translate(locale, 'karton.years', { count: age });
  }
  return age === 1
    ? translate(locale, 'karton.yearsOne')
    : translate(locale, 'karton.years', { count: age });
}

export function formatPatientCount(count: number, locale: Locale): string {
  if (count === 1) return translate(locale, 'myPatients.patientCountOne');
  if (locale === 'hr') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return translate(locale, 'myPatients.patientCountFew', { count });
    }
  }
  return translate(locale, 'myPatients.patientCount', { count });
}

export function formatActiveConditionCount(count: number, locale: Locale): string {
  if (count === 1) return translate(locale, 'summary.activeCountOne');
  return translate(locale, 'summary.activeCount', { count });
}

export function formatPractitionerCount(count: number, locale: Locale): string {
  if (count === 1) return translate(locale, 'summary.practitionersOne');
  return translate(locale, 'summary.practitionersMany', { count });
}
