import type { Locale } from '../i18n/types';
import { translate, type TranslationKey } from '../i18n/translations';

const STATUS_KEYS: Record<string, TranslationKey> = {
  active: 'fhir.status.active',
  deleted: 'fhir.status.deleted',
  inactive: 'fhir.status.inactive',
  resolved: 'fhir.status.resolved',
  recurrence: 'fhir.status.recurrence',
  relapse: 'fhir.status.relapse',
  remission: 'fhir.status.remission',
  finished: 'fhir.status.finished',
  planned: 'fhir.status.planned',
  'in-progress': 'fhir.status.inProgress',
  onhold: 'fhir.status.onHold',
  cancelled: 'fhir.status.cancelled',
  stopped: 'fhir.status.stopped',
  completed: 'fhir.status.completed',
  'entered-in-error': 'fhir.status.enteredInError',
  unknown: 'fhir.status.unknown',
  confirmed: 'fhir.status.confirmed',
  unconfirmed: 'fhir.status.unconfirmed',
  provisional: 'fhir.status.provisional',
  differential: 'fhir.status.differential',
  refuted: 'fhir.status.refuted',
  draft: 'fhir.status.draft',
  'on-hold': 'fhir.status.onHold',
  revoked: 'fhir.status.revoked',
};

function normalizeCode(code: string | null | undefined): string | null {
  if (!code?.trim()) return null;
  return code.trim().toLowerCase();
}

export function formatFhirStatus(
  code: string | null | undefined,
  locale: Locale,
): string | null {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const key = STATUS_KEYS[normalized];
  return key ? translate(locale, key) : code!.trim();
}

export function formatFhirStatusPair(
  clinical: string | null | undefined,
  verification: string | null | undefined,
  locale: Locale,
): string {
  const a = formatFhirStatus(clinical, locale) ?? clinical ?? '—';
  const b = formatFhirStatus(verification, locale) ?? verification ?? '—';
  return `${a} / ${b}`;
}
