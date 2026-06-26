import type { CreateEncounterInput, CreateEncounterValidationIssue } from './types';

export function validateCreateEncounterInput(
  input: CreateEncounterInput,
): CreateEncounterValidationIssue[] {
  const issues: CreateEncounterValidationIssue[] = [];

  if (!input.patientMbo?.trim()) {
    issues.push({ field: 'patientMbo', message: 'Patient MBO is required.' });
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
  if (!input.classCode?.trim()) {
    issues.push({ field: 'classCode', message: 'Admission type (class) is required.' });
  }

  return issues;
}
