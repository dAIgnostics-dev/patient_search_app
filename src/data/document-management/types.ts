export type ClinicalDocumentTypeCode = '011';

export interface SubmitDocumentAttachmentInput {
  fileName: string;
  contentType: string;
  base64Data: string;
}

export interface SubmitDocumentInput {
  patientMbo: string;
  encounterVisitId: string;
  practitionerHzjzId: string;
  organizationHzzoCode: string;
  caseId?: string;
  caseIcd10Code?: string;
  caseDisplay?: string;
  typeCode: ClinicalDocumentTypeCode;
  anamnesisText: string;
  outcomeCode: string;
  outcomeDisplay?: string;
  healthcareServiceName?: string;
  attachment?: SubmitDocumentAttachmentInput;
}

export interface SubmitDocumentValidationIssue {
  field: string;
  message: string;
}

export type SubmitDocumentResult =
  | {
      outcome: 'success';
      documentReferenceId: string;
      documentId: string;
      bundleId: string;
      summary: import('../../domain/models').DocumentSummary;
    }
  | {
      outcome: 'error';
      issues: Array<{ severity: string; code: string; diagnostics?: string }>;
    };

export type UpdateDocumentInput = SubmitDocumentInput & {
  replacesDocumentReferenceId: string;
};

export interface CancelDocumentInput {
  documentReferenceId: string;
  patientMbo: string;
  practitionerHzjzId: string;
  reason: string;
}

export type UpdateDocumentResult = SubmitDocumentResult;
export type CancelDocumentResult = SubmitDocumentResult;

export interface DocumentSearchInput {
  patientMbo: string;
  typeCode?: string;
  encounterVisitId?: string;
  dateFrom?: string;
  dateTo?: string;
  compositionStatus?: string;
}

export interface DocumentMetadataResult {
  summary: import('../../domain/models').DocumentSummary;
  bundleId: string;
  documentId: string;
  sectionCount: number;
  entryCount: number;
  sections: ClinicalDocumentSectionSummary[];
}

export interface DocumentContentResult {
  contentType: string;
  fileName: string;
  base64Data: string;
}

export interface ClinicalDocumentSectionSummary {
  code: string;
  title?: string | null;
  entryCount: number;
}

export interface ClinicalDocumentBundleSummary {
  bundleId: string;
  documentId?: string | null;
  compositionStatus?: string | null;
  typeCode: ClinicalDocumentTypeCode;
  typeDisplay: string;
  title: string;
  date?: string | null;
  patientMbo?: string | null;
  encounterVisitId?: string | null;
  caseId?: string | null;
  caseDisplay?: string | null;
  authorHzjzId?: string | null;
  authorName?: string | null;
  organizationHzzoCode?: string | null;
  organizationName?: string | null;
  healthcareServiceName?: string | null;
  hasSignature: boolean;
  attachmentCount: number;
  anamnesisPreview?: string | null;
  outcomeDisplay?: string | null;
  sections: ClinicalDocumentSectionSummary[];
}
