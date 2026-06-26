import type { EncounterValidationIssue, ReopenEncounterInput } from './types';

export function validateReopenEncounterInput(
  input: ReopenEncounterInput,
): EncounterValidationIssue[] {
  const issues: EncounterValidationIssue[] = [];

  if (!input.visitId?.trim()) {
    issues.push({ field: 'visitId', message: 'Visit identifier is required for reopen.' });
  }
  if (!input.practitionerHzjzId?.trim()) {
    issues.push({ field: 'practitionerHzjzId', message: 'Practitioner HZJZ ID is required.' });
  }
  if (!input.organizationHzzoCode?.trim()) {
    issues.push({ field: 'organizationHzzoCode', message: 'Organization HZZO code is required.' });
  }
  if (!input.classCode?.trim()) {
    issues.push({ field: 'classCode', message: 'Admission type (class) is required.' });
  }

  return issues;
}
