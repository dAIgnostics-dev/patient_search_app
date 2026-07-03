import { resolveCezihMhdUrl } from '../../config/runtime';
import type { FhirBundle, FhirClinicalDocumentBundle, FhirDocumentReference } from '../../fhir/types';
import type { MhdClient } from './mhdClient';
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

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * HTTP client for CEZIH MHD (HR::ITI-65/67/68).
 * Endpoint paths are stubs until the production MHD base URL contract is finalized.
 */
export class CezihMhdClient implements MhdClient {
  constructor(private readonly mhdUrl: string = resolveCezihMhdUrl()!) {}

  private async postBundle(bundle: FhirClinicalDocumentBundle): Promise<FhirClinicalDocumentBundle> {
    const response = await fetch(this.mhdUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
      },
      body: JSON.stringify(bundle),
    });
    const payload = (await response.json()) as FhirClinicalDocumentBundle;
    if (!response.ok) {
      throw new Error(`CEZIH MHD submit failed (${response.status})`);
    }
    return payload;
  }

  async submitDocument(request: SubmitDocumentRequest): Promise<SubmitDocumentResponse> {
    const bundle = await this.postBundle(request.bundle);
    const documentReferenceId = bundle.id;
    return {
      bundleId: bundle.id,
      documentId: bundle.identifier?.value ?? bundle.id,
      documentReferenceId,
    };
  }

  async searchDocuments(request: SearchDocumentsRequest): Promise<SearchDocumentsResponse> {
    const params = new URLSearchParams();
    if (request.patientMbo) {
      params.set('subject.identifier', request.patientMbo);
    }
    if (request.typeCode) params.set('type', request.typeCode);
    if (request.encounterVisitId) params.set('context', request.encounterVisitId);
    if (request.dateFrom) params.set('date', `ge${request.dateFrom}`);
    if (request.dateTo) params.append('date', `le${request.dateTo}`);

    const url = `${trimBase(this.mhdUrl)}/DocumentReference?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/fhir+json' },
    });
    const payload = (await response.json()) as FhirBundle<FhirDocumentReference>;
    if (!response.ok) {
      throw new Error(`CEZIH MHD search failed (${response.status})`);
    }
    const entries = payload.entry?.map((entry) => entry.resource) ?? [];
    return { total: payload.total ?? entries.length, entries };
  }

  async retrieveDocument(request: RetrieveDocumentRequest): Promise<RetrieveDocumentResponse> {
    const id = request.documentReferenceId ?? request.documentId;
    if (!id) throw new Error('documentReferenceId or documentId is required.');

    const url = `${trimBase(this.mhdUrl)}/Bundle/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/fhir+json' },
    });
    const payload = (await response.json()) as FhirClinicalDocumentBundle;
    if (!response.ok) {
      throw new Error(`CEZIH MHD retrieve failed (${response.status})`);
    }
    return { bundle: payload };
  }

  async updateDocument(request: UpdateDocumentRequest): Promise<SubmitDocumentResponse> {
    return this.submitDocument({ bundle: request.bundle });
  }

  async cancelDocument(request: CancelDocumentRequest): Promise<CancelDocumentResponse> {
    const reference = await this.retrieveDocument({
      documentReferenceId: request.documentReferenceId,
    });
    const compositionEntry = reference.bundle.entry?.find(
      (entry) => entry.resource.resourceType === 'Composition',
    );
    if (!compositionEntry || compositionEntry.resource.resourceType !== 'Composition') {
      throw new Error('Cancelled bundle is missing Composition.');
    }
    const cancelledBundle: FhirClinicalDocumentBundle = {
      ...reference.bundle,
      entry: reference.bundle.entry.map((entry) =>
        entry.resource.resourceType === 'Composition'
          ? {
              ...entry,
              resource: { ...entry.resource, status: 'entered-in-error' },
            }
          : entry,
      ),
    };
    await this.postBundle(cancelledBundle);
    return {
      documentReferenceId: request.documentReferenceId,
      compositionStatus: 'entered-in-error',
    };
  }
}
