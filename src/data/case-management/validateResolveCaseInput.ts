import type { CaseValidationIssue, ResolveCaseInput } from './types';

export function validateResolveCaseInput(input: ResolveCaseInput): CaseValidationIssue[] {
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
  if (!input.abatementDate?.trim()) {
    issues.push({ field: 'abatementDate', message: 'Case abatement date is required.' });
  }

  return issues;
}
