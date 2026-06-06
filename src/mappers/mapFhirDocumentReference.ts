import type { FhirDocumentReference } from '../fhir/types';

export function mapFhirDocumentReference(fhir: FhirDocumentReference) {
  const typeCoding = fhir.type?.coding?.[0];
  const attachment = fhir.content?.[0]?.attachment;

  return {
    fhirId: fhir.id,
    status: fhir.status ?? null,
    typeDisplay: typeCoding?.display ?? fhir.type?.text ?? null,
    typeCode: typeCoding?.code ?? null,
    category: fhir.category?.[0]?.coding?.[0]?.display ?? fhir.category?.[0]?.text ?? null,
    date: fhir.date ?? null,
    description: fhir.description ?? attachment?.title ?? null,
    contentType: attachment?.contentType ?? null,
  };
}
