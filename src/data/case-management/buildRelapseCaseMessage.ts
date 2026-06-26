import { CEZIH_RELAPSE_CASE_EVENT } from '../../fhir/types';
import { buildCaseMessageBundle, buildRelapseConditionBody } from './caseMessageShared';
import type { CaseMessageContext, RelapseCaseInput } from './types';

export function buildRelapseCaseMessage(input: RelapseCaseInput, context: CaseMessageContext) {
  const conditionBody = buildRelapseConditionBody(input);
  return buildCaseMessageBundle(CEZIH_RELAPSE_CASE_EVENT, input, context, conditionBody);
}
