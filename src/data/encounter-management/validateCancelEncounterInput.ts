import type { CancelEncounterInput, EncounterValidationIssue } from './types';
import { validateCloseEncounterInput } from './validateCloseEncounterInput';

export function validateCancelEncounterInput(
  input: CancelEncounterInput,
): EncounterValidationIssue[] {
  return validateCloseEncounterInput(input);
}
