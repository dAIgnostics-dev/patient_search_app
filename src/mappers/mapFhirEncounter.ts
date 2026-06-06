import type { FhirEncounter } from '../fhir/types';
import {
  CEZIH_HZJZ_SYSTEM,
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_VISIT_SYSTEM,
} from '../fhir/types';
import { findIdentifier } from './fhir-utils';

export function mapFhirEncounter(fhir: FhirEncounter) {
  const practitionerId = fhir.participant?.[0]?.individual?.identifier;
  const orgId = fhir.serviceProvider?.identifier;

  return {
    fhirId: fhir.id,
    status: fhir.status ?? null,
    start: fhir.period?.start ?? null,
    end: fhir.period?.end ?? null,
    classCode: fhir.class?.code ?? null,
    classDisplay: fhir.class?.display ?? null,
    visitId:
      findIdentifier(fhir.identifier, CEZIH_VISIT_SYSTEM) ??
      fhir.identifier?.[0]?.value ??
      null,
    practitionerFhirId:
      practitionerId?.system === CEZIH_HZJZ_SYSTEM
        ? practitionerId.value ?? null
        : practitionerId?.value ?? null,
    organizationFhirId:
      orgId?.system === CEZIH_HZZO_ORG_SYSTEM ? orgId.value ?? null : orgId?.value ?? null,
    subjectMbo: fhir.subject?.identifier?.value ?? null,
  };
}
