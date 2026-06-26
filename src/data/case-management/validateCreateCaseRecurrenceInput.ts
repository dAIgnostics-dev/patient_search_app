import type { CaseValidationIssue, CreateCaseRecurrenceInput } from './types';
import { validateCreateCaseInput } from './validateCreateCaseInput';

export function validateCreateCaseRecurrenceInput(
  input: CreateCaseRecurrenceInput,
): CaseValidationIssue[] {
  const issues = validateCreateCaseInput(input);

  if (!input.previousCaseId?.trim()) {
    issues.push({
      field: 'previousCaseId',
      message: 'Previous resolved case ID is required for recurrence creation.',
    });
  }

  return issues;
}
