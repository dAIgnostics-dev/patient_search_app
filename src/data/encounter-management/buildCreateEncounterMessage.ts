import { CEZIH_CREATE_ENCOUNTER_EVENT } from '../../fhir/types';
import {
  buildEncounterBody,
  buildEncounterMessageBundle,
} from './encounterMessageShared';
import type { CreateEncounterInput, EncounterMessageContext } from './types';

export function buildCreateEncounterMessage(
  input: CreateEncounterInput,
  context: EncounterMessageContext,
) {
  const encounterBody = buildEncounterBody(input);
  return buildEncounterMessageBundle(
    CEZIH_CREATE_ENCOUNTER_EVENT,
    input,
    context,
    encounterBody,
  );
}
