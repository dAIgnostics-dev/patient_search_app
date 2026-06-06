import type { FhirMedicationRequest } from '../fhir/types';

export function mapFhirMedicationRequest(fhir: FhirMedicationRequest) {
  const coding = fhir.medicationCodeableConcept?.coding?.[0];

  return {
    fhirId: fhir.id,
    status: fhir.status ?? null,
    intent: fhir.intent ?? null,
    display: coding?.display ?? fhir.medicationCodeableConcept?.text ?? null,
    code: coding?.code ?? null,
    authoredOn: fhir.authoredOn ?? null,
    dosage: fhir.dosageInstruction?.[0]?.text ?? null,
    note: fhir.note?.[0]?.text ?? null,
  };
}
