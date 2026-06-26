import { CEZIH_CREATE_CASE_RECURRENCE_EVENT } from '../../fhir/types';
import { buildCaseMessageBundle, buildConditionBody } from './caseMessageShared';
import type { CaseMessageContext, CreateCaseRecurrenceInput } from './types';

export function buildCreateCaseRecurrenceMessage(
  input: CreateCaseRecurrenceInput,
  context: CaseMessageContext,
) {
  const conditionBody = buildConditionBody(input);
  return buildCaseMessageBundle(
    CEZIH_CREATE_CASE_RECURRENCE_EVENT,
    input,
    context,
    conditionBody,
  );
}
