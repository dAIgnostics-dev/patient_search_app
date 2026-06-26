import type { FhirEncounter } from '../../fhir/types';
import {
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_NACIN_PRIJEMA_SYSTEM,
  CEZIH_REOPEN_ENCOUNTER_EVENT,
  CEZIH_VISIT_SYSTEM,
} from '../../fhir/types';
import { buildEncounterMessageBundle } from './encounterMessageShared';
import type { EncounterMessageContext, ReopenEncounterInput } from './types';

function buildReopenEncounterBody(input: ReopenEncounterInput): FhirEncounter {
  return {
    resourceType: 'Encounter',
    status: 'in-progress',
    identifier: [{ system: CEZIH_VISIT_SYSTEM, value: input.visitId.trim() }],
    class: {
      system: CEZIH_NACIN_PRIJEMA_SYSTEM,
      code: input.classCode.trim(),
      display: input.classDisplay?.trim() || undefined,
    },
    serviceProvider: {
      type: 'Organization',
      identifier: {
        system: CEZIH_HZZO_ORG_SYSTEM,
        value: input.organizationHzzoCode.trim(),
      },
    },
  };
}

export function buildReopenEncounterMessage(
  input: ReopenEncounterInput,
  context: EncounterMessageContext,
) {
  const encounterBody = buildReopenEncounterBody(input);
  return buildEncounterMessageBundle(
    CEZIH_REOPEN_ENCOUNTER_EVENT,
    input,
    context,
    encounterBody,
  );
}
