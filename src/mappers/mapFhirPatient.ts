import type { FhirPatient } from '../fhir/types';
import type { PatientSummary } from '../domain/models';
import { CEZIH_MBO_SYSTEM } from '../fhir/types';
import { findIdentifier } from './fhir-utils';

export function mapFhirPatient(fhir: FhirPatient): Omit<PatientSummary, 'id'> & {
  fhirId: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  gender?: string | null;
  mbo?: string | null;
  active?: boolean | null;
  oib?: string | null;
} {
  const name = fhir.name?.[0];
  const given = name?.given?.[0] ?? name?.text?.split(' ')[0] ?? 'Unknown';
  const family = name?.family ?? name?.text?.split(' ').slice(1).join(' ') ?? 'Unknown';

  return {
    fhirId: fhir.id,
    firstName: given,
    lastName: family,
    birthDate: fhir.birthDate ?? null,
    gender: fhir.gender ?? null,
    mbo: findIdentifier(fhir.identifier, CEZIH_MBO_SYSTEM) ?? null,
    active: fhir.active ?? null,
    oib: null,
  };
}
