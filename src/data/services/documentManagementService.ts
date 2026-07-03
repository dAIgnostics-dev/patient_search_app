import {
  CEZIH_DOCUMENT_SECTION_PRILOZI,
  CEZIH_DOCUMENT_SECTION_SYSTEM,
  type FhirClinicalDocumentBundle,
  type FhirComposition,
  type FhirDocumentReference,
} from '../../fhir/types';
import { mapClinicalDocumentBundle } from '../../mappers/mapClinicalDocumentBundle';
import { mapFhirDocumentReference } from '../../mappers/mapFhirDocumentReference';
import { buildSubmitDocumentRequest } from '../document-management/buildSubmitDocumentRequest';
import { extractDocumentEditDefaults } from '../document-management/extractDocumentEditDefaults';
import type { DocumentEditDefaults } from '../document-management/extractDocumentEditDefaults';
import { parseDocumentExchangeResponse } from '../document-management/parseDocumentExchangeResponse';
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
} from '../document-management/types';
import { validateCancelDocumentInput } from '../document-management/validateCancelDocumentInput';
import { validateSubmitDocumentInput } from '../document-management/validateSubmitDocumentInput';
import { validateUpdateDocumentInput } from '../document-management/validateUpdateDocumentInput';
import { getLomNotificationClient } from '../lom-notification/lomNotificationClientFactory';
import type { LomNotificationClient } from '../lom-notification/lomNotificationClient';
import { appendMockBinary, findMockDocumentReferenceById, getMockBinaryById } from '../fhir-client/mockCezihClient';
import type { DocumentExchangeRepository } from '../repositories/document-exchange/documentExchangeRepository';
import type { ClinicianContext } from './types';

function mapValidationIssues(
  issues: Array<{ field: string; message: string }>,
): SubmitDocumentResult {
  return {
    outcome: 'error',
    issues: issues.map((issue) => ({
      severity: 'error',
      code: 'invalid',
      diagnostics: `${issue.field}: ${issue.message}`,
    })),
  };
}

function resolvePractitionerHzjzId(
  context: ClinicianContext,
  inputHzjzId: string | undefined,
): string | null {
  return inputHzjzId?.trim() || context.hzjzId?.trim() || null;
}

function practitionerDisplayName(context: ClinicianContext): string | undefined {
  const parts = [context.firstName, context.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : context.username ?? undefined;
}

function findComposition(bundle: FhirClinicalDocumentBundle): FhirComposition | null {
  for (const entry of bundle.entry) {
    if (entry.resource.resourceType === 'Composition') {
      return entry.resource;
    }
  }
  return null;
}

function entryByReference(
  bundle: FhirClinicalDocumentBundle,
  reference: string | undefined,
): FhirDocumentReference | null {
  if (!reference) return null;
  const match = bundle.entry.find((entry) => entry.fullUrl === reference);
  if (!match || match.resource.resourceType !== 'DocumentReference') return null;
  return match.resource;
}

function findAttachmentDocumentReference(
  bundle: FhirClinicalDocumentBundle,
): FhirDocumentReference | null {
  const composition = findComposition(bundle);
  const attachmentSection = composition?.section?.find(
    (section) =>
      section.code?.coding?.some(
        (coding) =>
          coding.system === CEZIH_DOCUMENT_SECTION_SYSTEM &&
          coding.code === CEZIH_DOCUMENT_SECTION_PRILOZI,
      ),
  );
  const ref = attachmentSection?.entry?.[0]?.reference;
  const fromSection = entryByReference(bundle, ref);
  if (fromSection) return fromSection;

  for (const entry of bundle.entry) {
    if (entry.resource.resourceType === 'DocumentReference') {
      return entry.resource;
    }
  }
  return null;
}

export class DocumentManagementService {
  constructor(
    private readonly repository: DocumentExchangeRepository,
    private readonly lomClient: LomNotificationClient = getLomNotificationClient(),
  ) {}
  async submitDocument(
    context: ClinicianContext,
    input: SubmitDocumentInput,
  ): Promise<SubmitDocumentResult> {
    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const validationIssues = await validateSubmitDocumentInput(
      { ...input, practitionerHzjzId },
      practitionerHzjzId,
    );
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const { bundle, binaryId } = buildSubmitDocumentRequest(
      { ...input, practitionerHzjzId },
      { practitionerName: practitionerDisplayName(context) },
    );

    if (binaryId && input.attachment) {
      await appendMockBinary({
        resourceType: 'Binary',
        id: binaryId,
        contentType: input.attachment.contentType,
        data: input.attachment.base64Data,
      });
    }

    try {
      const result = await this.repository.submitDocument({ bundle });
      const parsed = parseDocumentExchangeResponse(result);
      if (parsed.outcome === 'success') {
        void this.lomClient
          .notifyDocumentSubmitted({
            documentReferenceId: parsed.documentReferenceId,
            documentId: parsed.documentId,
            patientMbo: input.patientMbo.trim(),
            typeCode: input.typeCode,
            encounterVisitId: input.encounterVisitId,
            practitionerHzjzId,
            submittedAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }
      return parsed;
    } catch (err) {
      return {
        outcome: 'error',
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics:
              err instanceof Error ? err.message : 'Clinical document submission failed.',
          },
        ],
      };
    }
  }

  async updateDocument(
    context: ClinicianContext,
    input: UpdateDocumentInput,
  ): Promise<UpdateDocumentResult> {
    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const validationIssues = await validateUpdateDocumentInput(
      { ...input, practitionerHzjzId },
      practitionerHzjzId,
    );
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const { bundle, binaryId } = buildSubmitDocumentRequest(
      { ...input, practitionerHzjzId },
      { practitionerName: practitionerDisplayName(context) },
    );

    if (binaryId && input.attachment) {
      await appendMockBinary({
        resourceType: 'Binary',
        id: binaryId,
        contentType: input.attachment.contentType,
        data: input.attachment.base64Data,
      });
    }

    try {
      const result = await this.repository.updateDocument({
        replacesDocumentReferenceId: input.replacesDocumentReferenceId.trim(),
        bundle,
      });
      return parseDocumentExchangeResponse(result);
    } catch (err) {
      return {
        outcome: 'error',
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics:
              err instanceof Error ? err.message : 'Clinical document update failed.',
          },
        ],
      };
    }
  }

  async cancelDocument(
    context: ClinicianContext,
    input: CancelDocumentInput,
  ): Promise<CancelDocumentResult> {
    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const validationIssues = await validateCancelDocumentInput({
      ...input,
      practitionerHzjzId,
    });
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    try {
      const result = await this.repository.cancelDocument({
        documentReferenceId: input.documentReferenceId.trim(),
        reason: input.reason.trim(),
      });
      return parseDocumentExchangeResponse(result);
    } catch (err) {
      return {
        outcome: 'error',
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics:
              err instanceof Error ? err.message : 'Clinical document cancellation failed.',
          },
        ],
      };
    }
  }

  async searchDocuments(
    _context: ClinicianContext,
    query: DocumentSearchInput,
  ): Promise<import('../../domain/models').DocumentSummary[]> {
    return this.repository.searchDocuments(query);
  }

  async getDocumentEditDefaults(documentReferenceId: string): Promise<DocumentEditDefaults | null> {
    const bundle = await this.repository.retrieveDocument(documentReferenceId);
    if (!bundle) return null;
    return extractDocumentEditDefaults(bundle, documentReferenceId);
  }

  async getDocumentMetadata(documentReferenceId: string): Promise<DocumentMetadataResult | null> {
    const summaryResource = await findMockDocumentReferenceById(documentReferenceId);
    const bundle = await this.repository.retrieveDocument(documentReferenceId);
    if (!bundle) return null;

    const composition = findComposition(bundle);
    const sections =
      composition?.section?.map((section) => ({
        code: section.code?.coding?.[0]?.code ?? '',
        title: section.title ?? null,
        entryCount: section.entry?.length ?? 0,
      })) ?? [];

    const mappedSummary = summaryResource
      ? mapFhirDocumentReference(summaryResource)
      : mapFhirDocumentReference(
          mapClinicalDocumentBundle(bundle, documentReferenceId).documentReference,
        );

    const summaryId = summaryResource?.id ?? documentReferenceId;

    return {
      summary: {
        ...mappedSummary,
        id: summaryId,
        fhirId: mappedSummary.fhirId ?? summaryId,
      },
      bundleId: bundle.id,
      documentId: mappedSummary.documentId ?? bundle.identifier?.value ?? documentReferenceId,
      sectionCount: sections.length,
      entryCount: bundle.entry.length,
      sections,
    };
  }

  async getDocumentContent(documentReferenceId: string): Promise<DocumentContentResult | null> {
    const bundle = await this.repository.retrieveDocument(documentReferenceId);
    if (!bundle) return null;

    const documentReference = findAttachmentDocumentReference(bundle);
    const attachment = documentReference?.content?.[0]?.attachment;
    if (!attachment) return null;

    if (attachment.data?.trim()) {
      return {
        contentType: attachment.contentType ?? 'application/octet-stream',
        fileName: attachment.title ?? `document-${documentReferenceId}`,
        base64Data: attachment.data,
      };
    }

    const url = attachment.url ?? '';
    const binaryMatch = url.match(/^Binary\/(.+)$/);
    if (binaryMatch) {
      const binary = await getMockBinaryById(binaryMatch[1]);
      if (binary?.data) {
        return {
          contentType: binary.contentType ?? attachment.contentType ?? 'application/octet-stream',
          fileName: attachment.title ?? `document-${documentReferenceId}`,
          base64Data: binary.data,
        };
      }
    }

    return null;
  }
}

export function createDocumentManagementService(
  repository: DocumentExchangeRepository,
  lomClient?: LomNotificationClient,
): DocumentManagementService {
  return new DocumentManagementService(repository, lomClient);
}
