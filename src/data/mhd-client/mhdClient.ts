import type {
  CancelDocumentRequest,
  CancelDocumentResponse,
  RetrieveDocumentRequest,
  RetrieveDocumentResponse,
  SearchDocumentsRequest,
  SearchDocumentsResponse,
  SubmitDocumentRequest,
  SubmitDocumentResponse,
  UpdateDocumentRequest,
} from './types';

export interface MhdClient {
  submitDocument(request: SubmitDocumentRequest): Promise<SubmitDocumentResponse>;
  searchDocuments(request: SearchDocumentsRequest): Promise<SearchDocumentsResponse>;
  retrieveDocument(request: RetrieveDocumentRequest): Promise<RetrieveDocumentResponse>;
  updateDocument(request: UpdateDocumentRequest): Promise<SubmitDocumentResponse>;
  cancelDocument(request: CancelDocumentRequest): Promise<CancelDocumentResponse>;
}
