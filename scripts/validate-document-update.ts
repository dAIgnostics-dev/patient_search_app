import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../src/fhir/types.ts';
import { MockMhdClient } from '../src/data/mhd-client/mockMhdClient.ts';
import { BaseDocumentExchangeRepository } from '../src/data/repositories/document-exchange/baseDocumentExchangeRepository.ts';
import { createDocumentManagementService } from '../src/data/services/documentManagementService.ts';
import { findMockDocumentReferenceById } from '../src/data/fhir-client/mockCezihClient.ts';
import { buildMinimalTestDocumentBundle } from '../src/data/mhd-client/mockMhdClient.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repository = new BaseDocumentExchangeRepository(new MockMhdClient());
const service = createDocumentManagementService(repository);

const patientMbo = '180223069';
const encounterVisitId = 'cl8zeaoc9qu1w';
const bundleId = `doc-bundle-update-${Date.now()}`;
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

const updateResult = await service.updateDocument(context, {
  replacesDocumentReferenceId: submitResult.documentReferenceId,
  patientMbo,
  encounterVisitId,
  practitionerHzjzId: '1234567',
  organizationHzzoCode: '1234567',
  typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  anamnesisText: 'Ažurirana anamneza u novoj verziji dokumenta.',
  outcomeCode: '1',
});

assert(updateResult.outcome === 'success', 'updateDocument must succeed');
if (updateResult.outcome !== 'success') throw new Error('update failed');
assert(
  updateResult.documentReferenceId !== submitResult.documentReferenceId,
  'new version must have a new document reference id',
);

const newReference = await findMockDocumentReferenceById(updateResult.documentReferenceId);
assert(newReference?.relatesTo?.[0]?.code === 'replaces', 'new version must relateTo replaces');

const searchBoth = await repository.searchDocuments({
  patientMbo,
  encounterVisitId,
  typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
});
assert(
  searchBoth.some((item) => item.id === submitResult.documentReferenceId),
  'search must still find original document',
);
assert(
  searchBoth.some((item) => item.id === updateResult.documentReferenceId),
  'search must find new version',
);

console.log('validate-document-update: ok');
