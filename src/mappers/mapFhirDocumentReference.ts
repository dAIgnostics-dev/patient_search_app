import type { FhirDocumentReference } from '../fhir/types';
import { readClinicalDocumentSummaryExtension } from './mapClinicalDocumentBundle';

export function mapFhirDocumentReference(fhir: FhirDocumentReference) {
  const typeCoding = fhir.type?.coding?.[0];
  const attachment = fhir.content?.[0]?.attachment;
  const summaryExt = readClinicalDocumentSummaryExtension(fhir.extension);

  return {
    fhirId: fhir.id,
    status: fhir.status ?? null,
    typeDisplay: typeCoding?.display ?? fhir.type?.text ?? null,
    typeCode: typeCoding?.code ?? null,
    category: fhir.category?.[0]?.coding?.[0]?.display ?? fhir.category?.[0]?.text ?? null,
    date: fhir.date ?? null,
    description: fhir.description ?? attachment?.title ?? null,
    contentType: attachment?.contentType ?? null,
    documentId: summaryExt.documentId ?? fhir.identifier?.[0]?.value ?? null,
    compositionStatus: summaryExt.compositionStatus ?? null,
    title: fhir.description ?? fhir.type?.text ?? typeCoding?.display ?? null,
    encounterVisitId:
      summaryExt.encounterVisitId ??
      fhir.context?.encounter?.[0]?.identifier?.value ??
      null,
    caseId: summaryExt.caseId ?? null,
    caseDisplay: summaryExt.caseDisplay ?? null,
    authorHzjzId: summaryExt.authorHzjzId ?? fhir.author?.[0]?.identifier?.value ?? null,
    authorName: summaryExt.authorName ?? fhir.author?.[0]?.display ?? null,
    organizationHzzoCode:
      summaryExt.organizationHzzoCode ?? fhir.custodian?.identifier?.value ?? null,
    organizationName: summaryExt.organizationName ?? fhir.custodian?.display ?? null,
    healthcareServiceName: summaryExt.healthcareServiceName ?? null,
    hasSignature: summaryExt.hasSignature ?? null,
    attachmentCount: summaryExt.attachmentCount ?? (fhir.content?.length ?? null),
    anamnesisPreview: summaryExt.anamnesisPreview ?? null,
    outcomeDisplay: summaryExt.outcomeDisplay ?? null,
  };
}
