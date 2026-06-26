import type { FhirEncounter } from '../../fhir/types';
import {
  CEZIH_CANCEL_ENCOUNTER_EVENT,
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_NACIN_PRIJEMA_SYSTEM,
  CEZIH_SLUCAJ_SYSTEM,
  CEZIH_VISIT_SYSTEM,
} from '../../fhir/types';
import { buildEncounterMessageBundle } from './encounterMessageShared';
import type { CancelEncounterInput, EncounterMessageContext } from './types';

function buildCancelEncounterBody(input: CancelEncounterInput): FhirEncounter {
  const encounter: FhirEncounter = {
    resourceType: 'Encounter',
    status: 'entered-in-error',
    identifier: [{ system: CEZIH_VISIT_SYSTEM, value: input.visitId.trim() }],
    class: {
      system: CEZIH_NACIN_PRIJEMA_SYSTEM,
      code: input.classCode.trim(),
      display: input.classDisplay?.trim() || undefined,
    },
    period: {
      start: input.periodStart.trim(),
      end: input.periodEnd.trim(),
    },
    serviceProvider: {
      type: 'Organization',
      identifier: {
        system: CEZIH_HZZO_ORG_SYSTEM,
        value: input.organizationHzzoCode.trim(),
      },
    },
  };

  if (input.diagnosisCaseIds?.length) {
    encounter.diagnosis = input.diagnosisCaseIds
      .map((caseId) => caseId.trim())
      .filter(Boolean)
      .map((caseId) => ({
        condition: {
          type: 'Condition',
          identifier: {
            system: CEZIH_SLUCAJ_SYSTEM,
            value: caseId,
          },
        },
      }));
  }

  return encounter;
}

export function buildCancelEncounterMessage(
  input: CancelEncounterInput,
  context: EncounterMessageContext,
) {
  const encounterBody = buildCancelEncounterBody(input);
  return buildEncounterMessageBundle(
    CEZIH_CANCEL_ENCOUNTER_EVENT,
    input,
    context,
    encounterBody,
  );
}
