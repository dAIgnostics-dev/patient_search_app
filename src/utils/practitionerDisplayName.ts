import type { PractitionerSummary } from '../domain/models';

export function practitionerDisplayName(p: PractitionerSummary): string {
  const parts = [p.firstName, p.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (p.hzjzId ?? 'Unknown');
}
