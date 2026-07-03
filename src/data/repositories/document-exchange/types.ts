import type { DocumentSummary } from '../../../domain/models';
import type { FhirClinicalDocumentBundle } from '../../../fhir/types';
import type { MhdOperationIssue } from '../../mhd-client/types';

export interface ClinicalDocumentSearchQuery {
  patientMbo: string;
  typeCode?: string;
  encounterVisitId?: string;
  dateFrom?: string;
  dateTo?: string;
  compositionStatus?: string;
}

export interface SubmitClinicalDocumentInput {
  bundle: FhirClinicalDocumentBundle;
}

export interface UpdateClinicalDocumentInput {
  replacesDocumentReferenceId: string;
  bundle: FhirClinicalDocumentBundle;
}

export interface CancelClinicalDocumentInput {
  documentReferenceId: string;
  reason?: string;
}

export type DocumentExchangeResult =
  | {
      outcome: 'success';
      documentReferenceId: string;
      documentId: string;
      bundleId: string;
      summary: DocumentSummary;
    }
  | {
      outcome: 'error';
      issues: MhdOperationIssue[];
    };
