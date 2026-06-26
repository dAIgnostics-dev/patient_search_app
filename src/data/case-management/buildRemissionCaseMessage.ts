import { CEZIH_REMISSION_CASE_EVENT } from '../../fhir/types';
import { buildCaseMessageBundle, buildRemissionConditionBody } from './caseMessageShared';
import type { CaseMessageContext, RemissionCaseInput } from './types';

export function buildRemissionCaseMessage(input: RemissionCaseInput, context: CaseMessageContext) {
  const conditionBody = buildRemissionConditionBody(input);
  return buildCaseMessageBundle(CEZIH_REMISSION_CASE_EVENT, input, context, conditionBody);
}
