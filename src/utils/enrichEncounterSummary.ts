import type { PractitionerSession } from '../auth/types';
import type { EncounterSummary } from '../domain/models';
import { practitionerDisplayName } from './practitionerDisplayName';

export interface EncounterSummaryExtras {
  organizationHzzoCode?: string;
  organizationName?: string | null;
  priorityCode?: string | null;
  classDisplay?: string | null;
}

export function practitionerNameFromSession(session: PractitionerSession): string {
  return practitionerDisplayName({
    id: session.practitionerId,
    fhirId: session.practitionerId,
    firstName: session.firstName,
    lastName: session.lastName,
    hzjzId: session.hzjzId,
  });
}

export function enrichEncounterSummary(
  encounter: EncounterSummary,
  session?: PractitionerSession,
  extras?: EncounterSummaryExtras,
): EncounterSummary {
  const practitionerName =
    encounter.practitionerName ??
    (session ? practitionerNameFromSession(session) : null);

  return {
    ...encounter,
    practitionerHzjzId:
      encounter.practitionerHzjzId ?? session?.hzjzId ?? null,
    practitionerName,
    organizationFhirId:
      extras?.organizationHzzoCode ?? encounter.organizationFhirId ?? null,
    organizationName:
      extras?.organizationName !== undefined
        ? extras.organizationName
        : encounter.organizationName ?? null,
    priorityCode:
      extras?.priorityCode !== undefined ? extras.priorityCode : encounter.priorityCode ?? null,
    classDisplay: extras?.classDisplay ?? encounter.classDisplay ?? null,
  };
}
