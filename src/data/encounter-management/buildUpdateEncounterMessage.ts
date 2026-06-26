import { CEZIH_UPDATE_ENCOUNTER_EVENT } from '../../fhir/types';
import {
  buildEncounterBody,
  buildEncounterMessageBundle,
} from './encounterMessageShared';
import type { EncounterMessageContext, UpdateEncounterInput } from './types';

export function buildUpdateEncounterMessage(
  input: UpdateEncounterInput,
  context: EncounterMessageContext,
) {
  const encounterBody = buildEncounterBody(input, { visitId: input.visitId });
  return buildEncounterMessageBundle(
    CEZIH_UPDATE_ENCOUNTER_EVENT,
    input,
    context,
    encounterBody,
  );
}
