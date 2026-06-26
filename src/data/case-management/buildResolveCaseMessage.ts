import { CEZIH_RESOLVE_CASE_EVENT } from '../../fhir/types';
import { buildCaseMessageBundle, buildResolveConditionBody } from './caseMessageShared';
import type { CaseMessageContext, ResolveCaseInput } from './types';

export function buildResolveCaseMessage(input: ResolveCaseInput, context: CaseMessageContext) {
  const conditionBody = buildResolveConditionBody(input);
  return buildCaseMessageBundle(CEZIH_RESOLVE_CASE_EVENT, input, context, conditionBody);
}
