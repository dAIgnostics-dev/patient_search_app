import { CEZIH_CREATE_CASE_EVENT } from '../../fhir/types';
import { buildCaseMessageBundle, buildConditionBody } from './caseMessageShared';
import type { CaseMessageContext, CreateCaseInput } from './types';

export function buildCreateCaseMessage(input: CreateCaseInput, context: CaseMessageContext) {
  const conditionBody = buildConditionBody(input);
  return buildCaseMessageBundle(CEZIH_CREATE_CASE_EVENT, input, context, conditionBody);
}
