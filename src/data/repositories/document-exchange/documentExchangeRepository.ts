import type { DocumentSummary } from '../../../domain/models';
import type { FhirClinicalDocumentBundle } from '../../../fhir/types';
import type {
  CancelClinicalDocumentInput,
  ClinicalDocumentSearchQuery,
  DocumentExchangeResult,
  SubmitClinicalDocumentInput,
  UpdateClinicalDocumentInput,
} from './types';

export interface DocumentExchangeRepository {
  submitDocument(input: SubmitClinicalDocumentInput): Promise<DocumentExchangeResult>;
  searchDocuments(query: ClinicalDocumentSearchQuery): Promise<DocumentSummary[]>;
  retrieveDocument(documentReferenceId: string): Promise<FhirClinicalDocumentBundle | null>;
  updateDocument(input: UpdateClinicalDocumentInput): Promise<DocumentExchangeResult>;
  cancelDocument(input: CancelClinicalDocumentInput): Promise<DocumentExchangeResult>;
}
