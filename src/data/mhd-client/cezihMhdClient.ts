import { resolveCezihMhdUrl } from '../../config/runtime';
import type { FhirBundle, FhirDocumentReference } from '../../fhir/types';
import type { MhdClient } from './mhdClient';
import { cezihProxyUrl, cezihNextPageUrl } from '../../config/cezihEndpoints';
import { cezihFetch } from '../fhir-client/cezihFetch';
import { mapFhirDocumentReference } from '../../mappers/mapFhirDocumentReference';
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

  async submitDocument(_request: SubmitDocumentRequest): Promise<SubmitDocumentResponse> {
    throw new Error('ITI-65 response mapping requires the CEZIH registration response contract.');
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

    const searchUrl = this.mhdUrl === cezihProxyUrl('document.submit')
      ? cezihProxyUrl('DocumentReference.search')
      : `${trimBase(this.mhdUrl)}/DocumentReference`;
    let url = `${searchUrl}?${params.toString()}`;
    const entries: FhirDocumentReference[] = [];
    const visited = new Set<string>();
    let total: number | undefined;
    while (url) {
      if (visited.has(url)) throw new Error('CEZIH MHD pagination contains a cycle.');
      visited.add(url);
      const response = await cezihFetch(url, { headers: { Accept: 'application/fhir+json' } });
      const payload = await response.json();
      if (!response.ok || payload.resourceType === 'OperationOutcome') {
        throw new Error(payload.issue?.[0]?.diagnostics ?? `CEZIH MHD search failed (${response.status})`);
      }
      if (payload.resourceType !== 'Bundle' || payload.type !== 'searchset') {
        throw new Error('CEZIH MHD search did not return a searchset Bundle.');
      }
      const bundle = payload as FhirBundle<FhirDocumentReference>;
      total ??= bundle.total;
      entries.push(...(bundle.entry ?? []).map((entry) => entry.resource));
      const next = bundle.link?.find((link) => link.relation === 'next')?.url;
      url = next ? cezihNextPageUrl('DocumentReference.search', next) : '';
    }
    if (request.compositionStatus) {
      const filtered = entries.filter((entry) => mapFhirDocumentReference(entry).compositionStatus === request.compositionStatus);
      return { total: filtered.length, entries: filtered };
    }
    return { total: total ?? entries.length, entries };
  }

  async retrieveDocument(request: RetrieveDocumentRequest): Promise<RetrieveDocumentResponse> {
    const id = request.documentReferenceId ?? request.documentId;
    if (!id) throw new Error('documentReferenceId or documentId is required.');

    throw new Error('ITI-68 query parameters and response format are missing; document retrieval is disabled.');
  }

  async updateDocument(request: UpdateDocumentRequest): Promise<SubmitDocumentResponse> {
    if (!request.replacesDocumentReferenceId.trim()) throw new Error('Replacement target is required.');
    throw new Error('ITI-65 replacement contract is missing; document update is disabled.');
  }

  async cancelDocument(request: CancelDocumentRequest): Promise<CancelDocumentResponse> {
    if (!request.documentReferenceId.trim()) throw new Error('Cancellation target is required.');
    throw new Error('ITI-65 cancellation contract is missing; document cancellation is disabled.');
  }
}
