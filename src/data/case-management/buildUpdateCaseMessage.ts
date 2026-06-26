import { CEZIH_CASE_RESPONSE_EVENT } from '../../fhir/types';
import { buildCaseMessageBundle, buildUpdateConditionBody } from './caseMessageShared';
import type { CaseMessageContext, UpdateCaseInput } from './types';

export function buildUpdateCaseMessage(input: UpdateCaseInput, context: CaseMessageContext) {
  const conditionBody = buildUpdateConditionBody(input);
  return buildCaseMessageBundle(CEZIH_CASE_RESPONSE_EVENT, input, context, conditionBody);
}
