import type { CaseValidationIssue, DeleteCaseInput } from './types';

export function validateDeleteCaseInput(input: DeleteCaseInput): CaseValidationIssue[] {
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
  if (!input.reason?.trim()) {
    issues.push({ field: 'reason', message: 'Deletion reason is required.' });
  }

  return issues;
}
