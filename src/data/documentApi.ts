import {
  canRegisterDocument,
  canRetrieveDocuments,
  canSearchDocuments,
} from '../auth/roles';
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

/**
 * Preduvjet autorizacije: samo dozvoljene uloge smiju registrirati/zamijeniti/
 * stornirati dokument. Vraća error rezultat kad uloga nije ovlaštena.
 */
function roleForbiddenResult(): SubmitDocumentResult {
  return {
    outcome: 'error',
    issues: [
      {
        severity: 'error',
        code: 'forbidden',
        diagnostics: 'role_not_allowed',
      },
    ],
  };
}

export async function submitDocument(
  session: PractitionerSession,
  input: SubmitDocumentInput,
): Promise<SubmitDocumentResult> {
  if (!canRegisterDocument(session.role, input.typeCode)) return roleForbiddenResult();
  return getDocumentService().submitDocument(toContext(session), input);
}

export async function updateDocument(
  session: PractitionerSession,
  input: UpdateDocumentInput,
): Promise<UpdateDocumentResult> {
  if (!canRegisterDocument(session.role, input.typeCode)) return roleForbiddenResult();
  return getDocumentService().updateDocument(toContext(session), input);
}

export async function cancelDocument(
  session: PractitionerSession,
  input: CancelDocumentInput,
): Promise<CancelDocumentResult> {
  // CancelDocumentInput nema typeCode; svi dokumenti su trenutno tipa 011.
  if (!canRegisterDocument(session.role, '011')) return roleForbiddenResult();
  return getDocumentService().cancelDocument(toContext(session), input);
}

export async function searchDocuments(
  session: PractitionerSession,
  query: DocumentSearchInput,
): Promise<DocumentSummary[]> {
  if (!canSearchDocuments(session.role)) return [];
  return getDocumentService().searchDocuments(toContext(session), query);
}

export async function getDocumentEditDefaults(
  session: PractitionerSession,
  documentReferenceId: string,
): Promise<import('./document-management/extractDocumentEditDefaults').DocumentEditDefaults | null> {
  if (!canRetrieveDocuments(session.role)) return null;
  return getDocumentService().getDocumentEditDefaults(documentReferenceId);
}

export async function getDocumentMetadata(
  session: PractitionerSession,
  documentReferenceId: string,
): Promise<DocumentMetadataResult | null> {
  if (!canRetrieveDocuments(session.role)) return null;
  return getDocumentService().getDocumentMetadata(documentReferenceId);
}

export async function getDocumentContent(
  session: PractitionerSession,
  documentReferenceId: string,
): Promise<DocumentContentResult | null> {
  if (!canRetrieveDocuments(session.role)) return null;
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
