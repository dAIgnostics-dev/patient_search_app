import type { DocumentSummary } from '../../../domain/models';
import type { FhirClinicalDocumentBundle } from '../../../fhir/types';
import { mapClinicalDocumentBundle } from '../../../mappers/mapClinicalDocumentBundle';
import { mapFhirDocumentReference } from '../../../mappers/mapFhirDocumentReference';
import type { MhdClient } from '../../mhd-client/mhdClient';
import { MhdClientError } from '../../mhd-client/mhdClientError';
import { MockMhdClient } from '../../mhd-client/mockMhdClient';
import type { SubmitDocumentResponse } from '../../mhd-client/types';
import { findMockDocumentReferenceById } from '../../fhir-client/mockCezihClient';
import type { DocumentExchangeRepository } from './documentExchangeRepository';
import type {
  CancelClinicalDocumentInput,
  ClinicalDocumentSearchQuery,
  DocumentExchangeResult,
  SubmitClinicalDocumentInput,
  UpdateClinicalDocumentInput,
} from './types';

function toDocumentSummary(resource: { id: string } & ReturnType<typeof mapFhirDocumentReference>): DocumentSummary {
  return {
    id: resource.id,
    fhirId: resource.fhirId,
    status: resource.status,
    typeDisplay: resource.typeDisplay,
    typeCode: resource.typeCode,
    category: resource.category,
    date: resource.date,
    description: resource.description,
    contentType: resource.contentType,
    documentId: resource.documentId,
    compositionStatus: resource.compositionStatus,
    title: resource.title,
    encounterVisitId: resource.encounterVisitId,
    caseId: resource.caseId,
    caseDisplay: resource.caseDisplay,
    authorHzjzId: resource.authorHzjzId,
    authorName: resource.authorName,
    organizationHzzoCode: resource.organizationHzzoCode,
    organizationName: resource.organizationName,
    healthcareServiceName: resource.healthcareServiceName,
    hasSignature: resource.hasSignature,
    attachmentCount: resource.attachmentCount,
    anamnesisPreview: resource.anamnesisPreview,
    outcomeDisplay: resource.outcomeDisplay,
  };
}

async function resolveSummaryAfterWrite(
  response: SubmitDocumentResponse,
  bundle: FhirClinicalDocumentBundle,
): Promise<DocumentSummary> {
  const fromStore = await findMockDocumentReferenceById(response.documentReferenceId);
  if (fromStore) {
    return toDocumentSummary({ id: fromStore.id, ...mapFhirDocumentReference(fromStore) });
  }
  const mapped = mapClinicalDocumentBundle(bundle, response.documentReferenceId);
  return toDocumentSummary({
    id: mapped.documentReference.id,
    ...mapFhirDocumentReference(mapped.documentReference),
  });
}

function mapMhdError(error: unknown): DocumentExchangeResult {
  if (error instanceof MhdClientError) {
    return { outcome: 'error', issues: error.issues };
  }
  return {
    outcome: 'error',
    issues: [
      {
        severity: 'fatal',
        code: 'exception',
        diagnostics: error instanceof Error ? error.message : 'Unknown MHD error.',
      },
    ],
  };
}

export class BaseDocumentExchangeRepository implements DocumentExchangeRepository {
  constructor(private readonly client: MhdClient) {}

  async submitDocument(input: SubmitClinicalDocumentInput): Promise<DocumentExchangeResult> {
    try {
      const response = await this.client.submitDocument({ bundle: input.bundle });
      const summary = await resolveSummaryAfterWrite(response, input.bundle);
      return {
        outcome: 'success',
        documentReferenceId: response.documentReferenceId,
        documentId: response.documentId,
        bundleId: response.bundleId,
        summary,
      };
    } catch (error) {
      return mapMhdError(error);
    }
  }

  async searchDocuments(query: ClinicalDocumentSearchQuery): Promise<DocumentSummary[]> {
    const response = await this.client.searchDocuments({
      patientMbo: query.patientMbo,
      typeCode: query.typeCode,
      encounterVisitId: query.encounterVisitId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      compositionStatus: query.compositionStatus,
    });
    return response.entries.map((entry) =>
      toDocumentSummary({ id: entry.id, ...mapFhirDocumentReference(entry) }),
    );
  }

  async retrieveDocument(documentReferenceId: string): Promise<FhirClinicalDocumentBundle | null> {
    try {
      const response = await this.client.retrieveDocument({ documentReferenceId });
      return response.bundle;
    } catch (error) {
      if (error instanceof MhdClientError && error.issues.some((issue) => issue.code === 'not-found')) {
        return null;
      }
      throw error;
    }
  }

  async updateDocument(input: UpdateClinicalDocumentInput): Promise<DocumentExchangeResult> {
    try {
      const response = await this.client.updateDocument({
        replacesDocumentReferenceId: input.replacesDocumentReferenceId,
        bundle: input.bundle,
      });
      const summary = await resolveSummaryAfterWrite(response, input.bundle);
      return {
        outcome: 'success',
        documentReferenceId: response.documentReferenceId,
        documentId: response.documentId,
        bundleId: response.bundleId,
        summary,
      };
    } catch (error) {
      return mapMhdError(error);
    }
  }

  async cancelDocument(input: CancelClinicalDocumentInput): Promise<DocumentExchangeResult> {
    try {
      const response = await this.client.cancelDocument({
        documentReferenceId: input.documentReferenceId,
        reason: input.reason,
      });
      const existing = await findMockDocumentReferenceById(response.documentReferenceId);
      const summary = existing
        ? toDocumentSummary({ id: existing.id, ...mapFhirDocumentReference(existing) })
        : toDocumentSummary({
            id: response.documentReferenceId,
            ...mapFhirDocumentReference({
              resourceType: 'DocumentReference',
              id: response.documentReferenceId,
              status: 'current',
              extension: [
                {
                  url: 'http://fhir.cezih.hr/specifikacije/StructureDefinition/hr-clinical-document-summary',
                  extension: [{ url: 'compositionStatus', valueCode: 'entered-in-error' }],
                },
              ],
            }),
          });
      return {
        outcome: 'success',
        documentReferenceId: response.documentReferenceId,
        documentId: summary.documentId ?? response.documentReferenceId,
        bundleId: summary.documentId ?? response.documentReferenceId,
        summary: { ...summary, compositionStatus: 'entered-in-error' },
      };
    } catch (error) {
      return mapMhdError(error);
    }
  }
}

export class MockDocumentExchangeRepository extends BaseDocumentExchangeRepository {
  constructor(client: MhdClient = new MockMhdClient()) {
    super(client);
  }
}

export class CezihDocumentExchangeRepository extends BaseDocumentExchangeRepository {
  constructor(client: MhdClient) {
    super(client);
  }
}
