import type { FhirOrganization } from '../fhir/types';
import { CEZIH_HZZO_ORG_SYSTEM } from '../fhir/types';
import { findIdentifier } from './fhir-utils';

export function mapFhirOrganization(fhir: FhirOrganization) {
  return {
    fhirId: fhir.id,
    name: fhir.name ?? 'Unknown organization',
    hzzoCode: findIdentifier(fhir.identifier, CEZIH_HZZO_ORG_SYSTEM) ?? null,
  };
}
