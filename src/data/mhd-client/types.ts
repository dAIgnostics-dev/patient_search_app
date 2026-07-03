import type { FhirClinicalDocumentBundle, FhirDocumentReference } from '../../fhir/types';

export interface MhdOperationIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  diagnostics?: string;
}

export interface SubmitDocumentRequest {
  bundle: FhirClinicalDocumentBundle;
}

export interface SubmitDocumentResponse {
  bundleId: string;
  documentId: string;
  documentReferenceId: string;
}

export interface SearchDocumentsRequest {
  patientMbo?: string;
  typeCode?: string;
  encounterVisitId?: string;
  dateFrom?: string;
  dateTo?: string;
  compositionStatus?: string;
}

export interface SearchDocumentsResponse {
  total: number;
  entries: FhirDocumentReference[];
}

export interface RetrieveDocumentRequest {
  documentReferenceId?: string;
  documentId?: string;
}

export interface RetrieveDocumentResponse {
  bundle: FhirClinicalDocumentBundle;
}

export interface UpdateDocumentRequest {
  replacesDocumentReferenceId: string;
  bundle: FhirClinicalDocumentBundle;
}

export interface CancelDocumentRequest {
  documentReferenceId: string;
  reason?: string;
}

export interface CancelDocumentResponse {
  documentReferenceId: string;
  compositionStatus: 'entered-in-error';
}
