import type { CaseValidationIssue, CreateCaseInput } from './types';

const ALLOWED_VERIFICATION_STATUSES = new Set(['confirmed', 'unconfirmed', 'provisional']);

export function validateCreateCaseInput(input: CreateCaseInput): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];

  if (!input.patientMbo?.trim()) {
    issues.push({ field: 'patientMbo', message: 'Patient MBO is required.' });
  }
  if (!input.practitionerHzjzId?.trim()) {
    issues.push({ field: 'practitionerHzjzId', message: 'Practitioner HZJZ ID is required.' });
  }
  if (!input.encounterVisitId?.trim()) {
    issues.push({ field: 'encounterVisitId', message: 'Open encounter visit ID is required.' });
  }
  if (!input.onsetDate?.trim()) {
    issues.push({ field: 'onsetDate', message: 'Case onset date is required.' });
  } else if (Number.isNaN(Date.parse(input.onsetDate))) {
    issues.push({ field: 'onsetDate', message: 'Case onset date must be a valid date.' });
  }
  if (!input.diagnosisCode?.trim()) {
    issues.push({ field: 'diagnosisCode', message: 'Diagnosis code is required.' });
  }
  if (!input.diagnosisDisplay?.trim()) {
    issues.push({ field: 'diagnosisDisplay', message: 'Diagnosis display is required.' });
  }
  if (!ALLOWED_VERIFICATION_STATUSES.has(input.verificationStatus)) {
    issues.push({
      field: 'verificationStatus',
      message: 'Verification status must be confirmed, unconfirmed, or provisional.',
    });
  }

  return issues;
}
