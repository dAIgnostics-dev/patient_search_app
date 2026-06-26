import type { ConditionSummary } from '../../domain/models';
import {
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_SLUCAJ_SYSTEM,
  type FhirCondition,
  type FhirMessageBundle,
  type FhirOperationOutcome,
} from '../../fhir/types';
import { findIdentifier } from '../../mappers/fhir-utils';
import { mapFhirCondition } from '../../mappers/mapFhirCondition';
import type { CaseManagementResult } from './types';

function findMessageHeader(bundle: FhirMessageBundle) {
  const resource = bundle.entry.find((entry) => entry.resource.resourceType === 'MessageHeader')
    ?.resource;
  return resource?.resourceType === 'MessageHeader' ? resource : null;
}

function findCondition(bundle: FhirMessageBundle): FhirCondition | null {
  const resource = bundle.entry.find((entry) => entry.resource.resourceType === 'Condition')
    ?.resource;
  return resource?.resourceType === 'Condition' ? resource : null;
}

function findOperationOutcome(bundle: FhirMessageBundle): FhirOperationOutcome | null {
  const resource = bundle.entry.find(
    (entry) => entry.resource.resourceType === 'OperationOutcome',
  )?.resource;
  return resource?.resourceType === 'OperationOutcome' ? resource : null;
}

function toConditionSummary(resource: FhirCondition): ConditionSummary {
  const mapped = mapFhirCondition(resource);
  return {
    id: resource.id ?? mapped.fhirId,
    ...mapped,
  };
}

export function parseCaseManagementResponse(
  requestBundleId: string,
  response: FhirMessageBundle,
): CaseManagementResult {
  const header = findMessageHeader(response);
  const responseCode = header?.response?.code;

  if (responseCode === 'ok') {
    const condition = findCondition(response);
    if (!condition?.id) {
      return {
        outcome: 'error',
        requestBundleId,
        issues: [
          {
            severity: 'fatal',
            code: 'invalid',
            diagnostics: 'Response missing Condition resource with id.',
          },
        ],
      };
    }

    const caseId =
      findIdentifier(condition.identifier, CEZIH_CASE_IDENTIFIER_SYSTEM) ??
      findIdentifier(condition.identifier, CEZIH_SLUCAJ_SYSTEM);
    if (!caseId) {
      return {
        outcome: 'error',
        requestBundleId,
        issues: [
          {
            severity: 'fatal',
            code: 'invalid',
            diagnostics: 'Response Condition missing case identifier.',
          },
        ],
      };
    }

    return {
      outcome: 'success',
      requestBundleId,
      conditionId: condition.id,
      caseId,
      condition: toConditionSummary(condition),
    };
  }

  const outcome = findOperationOutcome(response);
  const issues =
    outcome?.issue.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      diagnostics: issue.diagnostics ?? issue.details?.coding?.[0]?.code,
    })) ?? [];

  if (issues.length === 0) {
    issues.push({
      severity: 'fatal',
      code: responseCode ?? 'unknown',
      diagnostics: 'Case management request failed without OperationOutcome details.',
    });
  }

  return {
    outcome: 'error',
    requestBundleId,
    issues,
  };
}
