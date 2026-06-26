import { CEZIH_DELETE_CASE_EVENT } from '../../fhir/types';
import { buildCaseMessageBundle, buildDeleteConditionBody } from './caseMessageShared';
import type { CaseMessageContext, DeleteCaseInput } from './types';

export function buildDeleteCaseMessage(input: DeleteCaseInput, context: CaseMessageContext) {
  const conditionBody = buildDeleteConditionBody(input);
  return buildCaseMessageBundle(CEZIH_DELETE_CASE_EVENT, input, context, conditionBody);
}
