import type {
  FhirClinicalDocumentBundle,
  FhirComposition,
  FhirDocumentReference,
  FhirExtension,
} from '../../fhir/types';
import {
  CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL,
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
  CEZIH_DOCUMENT_TYPE_SYSTEM,
} from '../../fhir/types';
import {
  appendMockDocumentBundle,
  appendMockDocumentReference,
  findMockDocumentBundleByDocumentId,
  findMockDocumentBundleByReferenceId,
  findMockDocumentReferenceById,
  searchMockDocumentReferences,
  updateMockDocumentBundle,
  updateMockDocumentReference,
} from '../fhir-client/mockCezihClient';
import {
  mapClinicalDocumentBundle,
  readClinicalDocumentSummaryExtension,
} from '../../mappers/mapClinicalDocumentBundle';
import type { MhdClient } from './mhdClient';
import { MhdClientError } from './mhdClientError';
import type {
  CancelDocumentRequest,
  CancelDocumentResponse,
  MhdOperationIssue,
  RetrieveDocumentRequest,
  RetrieveDocumentResponse,
  SearchDocumentsRequest,
  SearchDocumentsResponse,
  SubmitDocumentRequest,
  SubmitDocumentResponse,
  UpdateDocumentRequest,
} from './types';

function issue(
  code: string,
  diagnostics: string,
  severity: MhdOperationIssue['severity'] = 'error',
): MhdOperationIssue {
  return { severity, code, diagnostics };
}

function fail(code: string, diagnostics: string): never {
  throw new MhdClientError([issue(code, diagnostics)]);
}

function getComposition(bundle: FhirClinicalDocumentBundle): FhirComposition {
  const composition = bundle.entry?.find(
    (entry) => entry.resource.resourceType === 'Composition',
  )?.resource as FhirComposition | undefined;
  if (!composition) {
    fail('invalid', 'Document bundle must contain a Composition resource.');
  }
  return composition;
}

function validateSubmitBundle(bundle: FhirClinicalDocumentBundle): void {
  if (bundle.type !== 'document') {
    fail('invalid', 'Bundle type must be "document".');
  }
  const composition = getComposition(bundle);
  if (!composition.encounter) {
    fail('invalid', 'Composition.encounter is required.');
  }
  const typeCode = composition.type?.coding?.find(
    (coding) => coding.system === CEZIH_DOCUMENT_TYPE_SYSTEM,
  )?.code;
  if (!typeCode) {
    fail('invalid', 'Composition.type must include CEZIH document-type coding.');
  }
}

function ensureBundleId(bundle: FhirClinicalDocumentBundle): FhirClinicalDocumentBundle {
  if (bundle.id?.trim()) return bundle;
  return { ...bundle, id: `doc-bundle-${crypto.randomUUID()}` };
}

function ensureDocumentIdentifier(bundle: FhirClinicalDocumentBundle): FhirClinicalDocumentBundle {
  if (bundle.identifier?.value) return bundle;
  return {
    ...bundle,
    identifier: {
      system: 'urn:ietf:rfc:3986',
      value: `urn:oid:2.16.840.1.113883.2.7.50.2.1.${Date.now()}`,
    },
  };
}

function withCompositionStatus(
  documentReference: FhirDocumentReference,
  compositionStatus: string,
): FhirDocumentReference {
  const root = documentReference.extension?.find(
    (ext) => ext.url === CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL,
  );
  const nested: FhirExtension[] = [
    ...(root?.extension?.filter((ext) => ext.url !== 'compositionStatus') ?? []),
    { url: 'compositionStatus', valueCode: compositionStatus },
  ];
  const otherExtensions =
    documentReference.extension?.filter(
      (ext) => ext.url !== CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL,
    ) ?? [];
  return {
    ...documentReference,
    extension: [...otherExtensions, { url: CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL, extension: nested }],
  };
}

async function persistMappedBundle(
  bundle: FhirClinicalDocumentBundle,
  summaryId?: string,
  relatesTo?: { replacesDocumentReferenceId: string },
): Promise<SubmitDocumentResponse> {
  const normalizedBundle = ensureDocumentIdentifier(ensureBundleId(bundle));
  const { summary, documentReference } = mapClinicalDocumentBundle(normalizedBundle, summaryId);
  const enrichedReference: FhirDocumentReference = relatesTo
    ? {
        ...documentReference,
        relatesTo: [
          {
            code: 'replaces',
            target: { reference: `DocumentReference/${relatesTo.replacesDocumentReferenceId}` },
          },
        ],
      }
    : documentReference;

  await appendMockDocumentBundle(normalizedBundle);
  await appendMockDocumentReference(enrichedReference);

  return {
    bundleId: normalizedBundle.id,
    documentId: summary.documentId ?? normalizedBundle.identifier?.value ?? normalizedBundle.id,
    documentReferenceId: enrichedReference.id,
  };
}

export class MockMhdClient implements MhdClient {
  async submitDocument(request: SubmitDocumentRequest): Promise<SubmitDocumentResponse> {
    validateSubmitBundle(request.bundle);
    return persistMappedBundle(request.bundle);
  }

  async searchDocuments(request: SearchDocumentsRequest): Promise<SearchDocumentsResponse> {
    const entries = await searchMockDocumentReferences({
      patientMbo: request.patientMbo,
      typeCode: request.typeCode,
      encounterVisitId: request.encounterVisitId,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      compositionStatus: request.compositionStatus,
    });
    return { total: entries.length, entries };
  }

  async retrieveDocument(request: RetrieveDocumentRequest): Promise<RetrieveDocumentResponse> {
    if (request.documentReferenceId) {
      const bundle = await findMockDocumentBundleByReferenceId(request.documentReferenceId);
      if (!bundle) fail('not-found', `Document bundle not found for reference ${request.documentReferenceId}.`);
      return { bundle };
    }
    if (request.documentId) {
      const bundle = await findMockDocumentBundleByDocumentId(request.documentId);
      if (!bundle) fail('not-found', `Document bundle not found for documentId ${request.documentId}.`);
      return { bundle };
    }
    fail('invalid', 'documentReferenceId or documentId is required.');
  }

  async updateDocument(request: UpdateDocumentRequest): Promise<SubmitDocumentResponse> {
    const existing = await findMockDocumentReferenceById(request.replacesDocumentReferenceId);
    if (!existing) {
      fail('not-found', `DocumentReference ${request.replacesDocumentReferenceId} not found.`);
    }
    validateSubmitBundle(request.bundle);
    const summaryId = `doc-${crypto.randomUUID().slice(0, 8)}`;
    return persistMappedBundle(request.bundle, summaryId, {
      replacesDocumentReferenceId: request.replacesDocumentReferenceId,
    });
  }

  async cancelDocument(request: CancelDocumentRequest): Promise<CancelDocumentResponse> {
    const reference = await findMockDocumentReferenceById(request.documentReferenceId);
    if (!reference) {
      fail('not-found', `DocumentReference ${request.documentReferenceId} not found.`);
    }

    const documentId = readClinicalDocumentSummaryExtension(reference.extension).documentId;
    const bundle = documentId ? await findMockDocumentBundleByDocumentId(documentId) : null;

    const cancelledReference = withCompositionStatus(reference, 'entered-in-error');
    await updateMockDocumentReference(request.documentReferenceId, cancelledReference);

    if (bundle) {
      const updatedEntries = bundle.entry.map((entry) => {
        if (entry.resource.resourceType !== 'Composition') return entry;
        return {
          ...entry,
          resource: {
            ...entry.resource,
            status: 'entered-in-error',
          },
        };
      });
      await updateMockDocumentBundle(bundle.id, { ...bundle, entry: updatedEntries });
    }

    return {
      documentReferenceId: request.documentReferenceId,
      compositionStatus: 'entered-in-error',
    };
  }
}

export function buildMinimalTestDocumentBundle(
  bundleId: string,
  documentOid: string,
  patientMbo: string,
  encounterVisitId: string,
): FhirClinicalDocumentBundle {
  return {
    resourceType: 'Bundle',
    id: bundleId,
    identifier: { system: 'urn:ietf:rfc:3986', value: documentOid },
    type: 'document',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${bundleId}-composition`,
        resource: {
          resourceType: 'Composition',
          status: 'final',
          type: {
            coding: [
              {
                system: CEZIH_DOCUMENT_TYPE_SYSTEM,
                code: '011',
                display: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
              },
            ],
          },
          subject: {
            identifier: { system: 'http://fhir.cezih.hr/specifikacije/identifikatori/MBO', value: patientMbo },
          },
          encounter: { reference: `urn:uuid:${bundleId}-encounter` },
          date: new Date().toISOString(),
          author: [
            {
              reference: `urn:uuid:${bundleId}-practitioner`,
              display: 'Ana Marković',
            },
            {
              reference: `urn:uuid:${bundleId}-organization`,
              display: 'Privatna ambulanta Zagreb',
            },
          ],
          title: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
          section: [
            {
              title: 'Medicinska informacija',
              code: {
                coding: [
                  {
                    system: 'http://fhir.cezih.hr/specifikacije/CodeSystem/document-section',
                    code: '18',
                    display: 'Medicinska informacija',
                  },
                ],
              },
              entry: [{ reference: `urn:uuid:${bundleId}-anamnesis` }],
            },
          ],
        },
      },
      {
        fullUrl: `urn:uuid:${bundleId}-encounter`,
        resource: {
          resourceType: 'Encounter',
          identifier: [
            {
              system: 'http://fhir.cezih.hr/specifikacije/identifikatori/identifikator-posjete',
              value: encounterVisitId,
            },
          ],
          status: 'finished',
        },
      },
      {
        fullUrl: `urn:uuid:${bundleId}-practitioner`,
        resource: {
          resourceType: 'Practitioner',
          identifier: [
            {
              system: 'http://fhir.cezih.hr/specifikacije/identifikatori/HZJZ-broj-zdravstvenog-djelatnika',
              value: '1234567',
            },
          ],
          name: [{ family: 'Marković', given: ['Ana'] }],
        },
      },
      {
        fullUrl: `urn:uuid:${bundleId}-organization`,
        resource: {
          resourceType: 'Organization',
          identifier: [
            {
              system: 'http://fhir.cezih.hr/specifikacije/identifikatori/HZZO-sifra-zdravstvene-organizacije',
              value: '1234',
            },
          ],
          name: 'Privatna ambulanta Zagreb',
        },
      },
      {
        fullUrl: `urn:uuid:${bundleId}-anamnesis`,
        resource: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [
              {
                system: 'http://fhir.cezih.hr/specifikacije/CodeSystem/observations',
                code: '15',
                display: 'Anamneza',
              },
            ],
          },
          valueString: 'Testna anamneza za MHD validaciju.',
        },
      },
    ],
  };
}
