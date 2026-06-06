import type { FhirPractitioner } from '../fhir/types';
import { CEZIH_HZJZ_SYSTEM } from '../fhir/types';
import { findIdentifier } from './fhir-utils';

export function mapFhirPractitioner(fhir: FhirPractitioner) {
  const name = fhir.name?.[0];

  return {
    fhirId: fhir.id,
    firstName: name?.given?.[0] ?? null,
    lastName: name?.family ?? null,
    hzjzId: findIdentifier(fhir.identifier, CEZIH_HZJZ_SYSTEM) ?? null,
  };
}
