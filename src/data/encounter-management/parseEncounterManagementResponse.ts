import type { EncounterSummary } from '../../domain/models';
import type { FhirEncounter, FhirMessageBundle, FhirOperationOutcome } from '../../fhir/types';
import { mapFhirEncounter } from '../../mappers/mapFhirEncounter';
import type { EncounterManagementResult } from './types';

function findMessageHeader(bundle: FhirMessageBundle) {
  const resource = bundle.entry.find((entry) => entry.resource.resourceType === 'MessageHeader')
    ?.resource;
  return resource?.resourceType === 'MessageHeader' ? resource : null;
}

function findEncounter(bundle: FhirMessageBundle): FhirEncounter | null {
  const resource = bundle.entry.find((entry) => entry.resource.resourceType === 'Encounter')
    ?.resource;
  return resource?.resourceType === 'Encounter' ? resource : null;
}

function findOperationOutcome(bundle: FhirMessageBundle): FhirOperationOutcome | null {
  const resource = bundle.entry.find(
    (entry) => entry.resource.resourceType === 'OperationOutcome',
  )?.resource;
  return resource?.resourceType === 'OperationOutcome' ? resource : null;
}

function toEncounterSummary(resource: FhirEncounter): EncounterSummary {
  const mapped = mapFhirEncounter(resource);
  const individual = resource.participant?.[0]?.individual;

  return {
    id: resource.id ?? mapped.fhirId,
    fhirId: resource.id ?? mapped.fhirId,
    status: mapped.status,
    start: mapped.start,
    end: mapped.end,
    classCode: mapped.classCode,
    classDisplay: mapped.classDisplay,
    visitId: mapped.visitId,
    practitionerFhirId: mapped.practitionerFhirId,
    practitionerHzjzId:
      mapped.practitionerHzjzId ?? individual?.identifier?.value ?? null,
    organizationFhirId: mapped.organizationFhirId,
    priorityCode: mapped.priorityCode,
  };
}

export function parseEncounterManagementResponse(
  requestBundleId: string,
  response: FhirMessageBundle,
): EncounterManagementResult {
  const header = findMessageHeader(response);
  const responseCode = header?.response?.code;

  if (responseCode === 'ok') {
    const encounter = findEncounter(response);
    if (!encounter?.id) {
      return {
        outcome: 'error',
        requestBundleId,
        issues: [
          {
            severity: 'fatal',
            code: 'invalid',
            diagnostics: 'Response missing Encounter resource with id.',
          },
        ],
      };
    }

    const summary = toEncounterSummary(encounter);
    if (!summary.visitId) {
      return {
        outcome: 'error',
        requestBundleId,
        issues: [
          {
            severity: 'fatal',
            code: 'invalid',
            diagnostics: 'Response Encounter missing visit identifier.',
          },
        ],
      };
    }

    return {
      outcome: 'success',
      requestBundleId,
      encounterId: encounter.id,
      visitId: summary.visitId,
      encounter: summary,
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
      diagnostics: 'Encounter management request failed without OperationOutcome details.',
    });
  }

  return {
    outcome: 'error',
    requestBundleId,
    issues,
  };
}

/** @deprecated Use parseEncounterManagementResponse */
export const parseCreateEncounterResponse = parseEncounterManagementResponse;
