import type { CloseEncounterInput, EncounterValidationIssue } from './types';

export function validateCloseEncounterInput(
  input: CloseEncounterInput,
): EncounterValidationIssue[] {
  const issues: EncounterValidationIssue[] = [];

  if (!input.visitId?.trim()) {
    issues.push({ field: 'visitId', message: 'Visit identifier is required for close.' });
  }
  if (!input.practitionerHzjzId?.trim()) {
    issues.push({ field: 'practitionerHzjzId', message: 'Practitioner HZJZ ID is required.' });
  }
  if (!input.organizationHzzoCode?.trim()) {
    issues.push({ field: 'organizationHzzoCode', message: 'Organization HZZO code is required.' });
  }
  if (!input.periodStart?.trim()) {
    issues.push({ field: 'periodStart', message: 'Encounter start time is required.' });
  } else if (Number.isNaN(Date.parse(input.periodStart))) {
    issues.push({ field: 'periodStart', message: 'Encounter start time must be a valid datetime.' });
  }
  if (!input.periodEnd?.trim()) {
    issues.push({ field: 'periodEnd', message: 'Encounter end time is required.' });
  } else if (Number.isNaN(Date.parse(input.periodEnd))) {
    issues.push({ field: 'periodEnd', message: 'Encounter end time must be a valid datetime.' });
  }
  if (!input.classCode?.trim()) {
    issues.push({ field: 'classCode', message: 'Admission type (class) is required.' });
  }

  const startMs = Date.parse(input.periodStart ?? '');
  const endMs = Date.parse(input.periodEnd ?? '');
  if (
    input.periodStart?.trim() &&
    input.periodEnd?.trim() &&
    !Number.isNaN(startMs) &&
    !Number.isNaN(endMs) &&
    endMs < startMs
  ) {
    issues.push({
      field: 'periodEnd',
      message: 'Encounter end time must be on or after start time.',
    });
  }

  if (input.diagnosisCaseIds?.some((caseId) => !caseId.trim())) {
    issues.push({
      field: 'diagnosisCaseIds',
      message: 'Diagnosis case identifiers must not be empty.',
    });
  }

  return issues;
}
