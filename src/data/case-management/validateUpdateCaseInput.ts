import type { CaseValidationIssue, UpdateCaseInput } from './types';

export function validateUpdateCaseInput(input: UpdateCaseInput): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];

  if (!input.caseId?.trim()) {
    issues.push({ field: 'caseId', message: 'Case ID is required.' });
  }
  if (!input.patientMbo?.trim()) {
    issues.push({ field: 'patientMbo', message: 'Patient MBO is required.' });
  }
  if (!input.practitionerHzjzId?.trim()) {
    issues.push({ field: 'practitionerHzjzId', message: 'Practitioner HZJZ ID is required.' });
  }
  if (!input.clinicalStatus?.trim()) {
    issues.push({ field: 'clinicalStatus', message: 'Current clinical status is required.' });
  }
  if (input.diagnosisCode?.trim() && !input.diagnosisDisplay?.trim()) {
    issues.push({ field: 'diagnosisDisplay', message: 'Diagnosis display is required when diagnosis code is provided.' });
  }
  if (input.diagnosisDisplay?.trim() && !input.diagnosisCode?.trim()) {
    issues.push({ field: 'diagnosisCode', message: 'Diagnosis code is required when diagnosis display is provided.' });
  }

  const hasEditableField = [
    input.localIdentifier,
    input.verificationStatus,
    input.diagnosisCode,
    input.diagnosisDisplay,
    input.diagnosisText,
    input.onsetDate,
    input.abatementDate,
    input.note,
  ].some((value) => Boolean(value?.trim()));

  if (!hasEditableField) {
    issues.push({ field: 'case', message: 'At least one case field must be provided for update.' });
  }

  return issues;
}
