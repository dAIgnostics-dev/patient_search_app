import type { PractitionerSession } from '../auth/types';
import type { DocumentSummary } from '../domain/models';
import type {
  CancelDocumentInput,
  CancelDocumentResult,
  DocumentContentResult,
  DocumentMetadataResult,
  DocumentSearchInput,
  SubmitDocumentInput,
  SubmitDocumentResult,
  UpdateDocumentInput,
  UpdateDocumentResult,
} from './document-management/types';
import { getDocumentExchangeRepository } from './repositories/documentExchangeRegistry';
import {
  createDocumentManagementService,
  DocumentManagementService,
} from './services/documentManagementService';
import type { ClinicianContext } from './services/types';

let cachedService: DocumentManagementService | null = null;

function getDocumentService(): DocumentManagementService {
  if (!cachedService) {
    cachedService = createDocumentManagementService(getDocumentExchangeRepository());
  }
  return cachedService;
}

function toContext(session: PractitionerSession): ClinicianContext {
  return {
    clinicianId: session.practitionerId,
    hzjzId: session.hzjzId,
    username: session.username,
    firstName: session.firstName,
    lastName: session.lastName,
    auditSessionId: session.auditSessionId,
    role: 'clinician',
    organizationId: null,
  };
}

export async function submitDocument(
  session: PractitionerSession,
  input: SubmitDocumentInput,
): Promise<SubmitDocumentResult> {
  return getDocumentService().submitDocument(toContext(session), input);
}

export async function updateDocument(
  session: PractitionerSession,
  input: UpdateDocumentInput,
): Promise<UpdateDocumentResult> {
  return getDocumentService().updateDocument(toContext(session), input);
}

export async function cancelDocument(
  session: PractitionerSession,
  input: CancelDocumentInput,
): Promise<CancelDocumentResult> {
  return getDocumentService().cancelDocument(toContext(session), input);
}

export async function searchDocuments(
  session: PractitionerSession,
  query: DocumentSearchInput,
): Promise<DocumentSummary[]> {
  return getDocumentService().searchDocuments(toContext(session), query);
}

export async function getDocumentEditDefaults(
  documentReferenceId: string,
): Promise<import('./document-management/extractDocumentEditDefaults').DocumentEditDefaults | null> {
  return getDocumentService().getDocumentEditDefaults(documentReferenceId);
}

export async function getDocumentMetadata(
  documentReferenceId: string,
): Promise<DocumentMetadataResult | null> {
  return getDocumentService().getDocumentMetadata(documentReferenceId);
}

export async function getDocumentContent(
  documentReferenceId: string,
): Promise<DocumentContentResult | null> {
  return getDocumentService().getDocumentContent(documentReferenceId);
}

export type {
  CancelDocumentInput,
  CancelDocumentResult,
  DocumentContentResult,
  DocumentMetadataResult,
  DocumentSearchInput,
  SubmitDocumentInput,
  SubmitDocumentResult,
  UpdateDocumentInput,
  UpdateDocumentResult,
};
