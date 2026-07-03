import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../src/fhir/types.ts';
import { MockMhdClient, buildMinimalTestDocumentBundle } from '../src/data/mhd-client/mockMhdClient.ts';
import { BaseDocumentExchangeRepository } from '../src/data/repositories/document-exchange/baseDocumentExchangeRepository.ts';
import { createDocumentManagementService } from '../src/data/services/documentManagementService.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repository = new BaseDocumentExchangeRepository(new MockMhdClient());
const service = createDocumentManagementService(repository);

const patientMbo = '180223069';
const encounterVisitId = 'cl8zeaoc9qu1w';
const bundleId = `doc-bundle-cancel-${Date.now()}`;
const documentOid = `urn:oid:2.16.840.1.113883.2.7.50.2.1.${Date.now()}`;

const bundle = buildMinimalTestDocumentBundle(bundleId, documentOid, patientMbo, encounterVisitId);
const submitResult = await repository.submitDocument({ bundle });
assert(submitResult.outcome === 'success', 'submit must succeed');
if (submitResult.outcome !== 'success') throw new Error('submit failed');

const context = {
  clinicianId: 'pract-003',
  hzjzId: '1234567',
  username: 'test',
  role: 'clinician' as const,
  organizationId: null,
};

const cancelResult = await service.cancelDocument(context, {
  documentReferenceId: submitResult.documentReferenceId,
  patientMbo,
  practitionerHzjzId: '1234567',
  reason: 'Dokument poslan pogreškom.',
});

assert(cancelResult.outcome === 'success', 'cancelDocument must succeed');
if (cancelResult.outcome !== 'success') throw new Error('cancel failed');
assert(
  cancelResult.summary.compositionStatus === 'entered-in-error',
  'cancelled document must have entered-in-error status',
);

const cancelledSearch = await repository.searchDocuments({
  patientMbo,
  encounterVisitId,
  compositionStatus: 'entered-in-error',
});
assert(
  cancelledSearch.some((item) => item.id === submitResult.documentReferenceId),
  'cancelled document must appear in entered-in-error search',
);

const finalSearch = await repository.searchDocuments({
  patientMbo,
  encounterVisitId,
  typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  compositionStatus: 'final',
});
assert(
  !finalSearch.some((item) => item.id === submitResult.documentReferenceId),
  'cancelled document must not appear in final search',
);

console.log('validate-document-cancel: ok');
