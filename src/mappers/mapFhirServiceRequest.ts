import type { FhirServiceRequest } from '../fhir/types';

export function mapFhirServiceRequest(fhir: FhirServiceRequest) {
  const coding = fhir.code?.coding?.[0];

  return {
    fhirId: fhir.id,
    status: fhir.status ?? null,
    intent: fhir.intent ?? null,
    priority: fhir.priority ?? null,
    display: coding?.display ?? fhir.code?.text ?? null,
    code: coding?.code ?? null,
    authoredOn: fhir.authoredOn ?? null,
    note: fhir.note?.[0]?.text ?? null,
  };
}
