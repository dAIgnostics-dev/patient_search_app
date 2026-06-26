import type { EncounterValidationIssue, UpdateEncounterInput } from './types';
import { validateCreateEncounterInput } from './validateCreateEncounterInput';

export function validateUpdateEncounterInput(
  input: UpdateEncounterInput,
): EncounterValidationIssue[] {
  const issues = validateCreateEncounterInput(input);

  if (!input.visitId?.trim()) {
    issues.push({ field: 'visitId', message: 'Visit identifier is required for update.' });
  }

  const authorHzjz = input.practitionerHzjzId?.trim();
  const participantHzjzIds = [
    authorHzjz,
    ...(input.additionalParticipants ?? []).map((p) => p.hzjzId.trim()).filter(Boolean),
  ].filter(Boolean);

  if (authorHzjz && !participantHzjzIds.includes(authorHzjz)) {
    issues.push({
      field: 'practitionerHzjzId',
      message: 'Author must be included in encounter participants.',
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
