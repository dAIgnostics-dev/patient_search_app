import type { FhirAllergyIntolerance } from '../fhir/types';
import { firstCodingCode } from './fhir-utils';

export function mapFhirAllergyIntolerance(fhir: FhirAllergyIntolerance) {
  const coding = fhir.code?.coding?.[0];

  return {
    fhirId: fhir.id,
    display: coding?.display ?? fhir.code?.text ?? null,
    code: coding?.code ?? null,
    clinicalStatus: firstCodingCode(fhir.clinicalStatus?.coding) ?? null,
    verificationStatus: firstCodingCode(fhir.verificationStatus?.coding) ?? null,
    type: fhir.type ?? null,
    category: fhir.category?.[0] ?? null,
    criticality: fhir.criticality ?? null,
    onsetDate: fhir.onsetDateTime ?? null,
    note: fhir.note?.[0]?.text ?? null,
  };
}
