import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../src/fhir/types.ts';
import { MockMhdClient } from '../src/data/mhd-client/mockMhdClient.ts';
import { BaseDocumentExchangeRepository } from '../src/data/repositories/document-exchange/baseDocumentExchangeRepository.ts';
import { createDocumentManagementService } from '../src/data/services/documentManagementService.ts';
import { buildMinimalTestDocumentBundle } from '../src/data/mhd-client/mockMhdClient.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repository = new BaseDocumentExchangeRepository(new MockMhdClient());
const service = createDocumentManagementService(repository);

const patientMbo = '180223069';
const encounterVisitId = 'cl8zeaoc9qu1w';
const bundleId = `doc-bundle-search-${Date.now()}`;
const documentOid = `urn:oid:2.16.840.1.113883.2.7.50.2.1.${Date.now()}`;

const bundle = buildMinimalTestDocumentBundle(
  bundleId,
  documentOid,
  patientMbo,
  encounterVisitId,
);

const submitResult = await repository.submitDocument({ bundle });
assert(submitResult.outcome === 'success', 'submit must succeed');
if (submitResult.outcome !== 'success') throw new Error('submit failed');

const byStatus = await repository.searchDocuments({
  patientMbo,
  compositionStatus: 'final',
});
assert(
  byStatus.some((item) => item.id === submitResult.documentReferenceId),
  'status filter must match final documents',
);

const searchResults = await service.searchDocuments(
  { clinicianId: 'x', hzjzId: '1234567', role: 'clinician', organizationId: null },
  { patientMbo, typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA, encounterVisitId },
);
assert(
  searchResults.some((item) => item.id === submitResult.documentReferenceId),
  'service searchDocuments must find document',
);

const metadata = await service.getDocumentMetadata(submitResult.documentReferenceId);
assert(metadata, 'getDocumentMetadata must return data');
assert(metadata!.entryCount > 0, 'metadata must include entry count');
assert(metadata!.sectionCount > 0, 'metadata must include section count');

const retrieved = await repository.retrieveDocument(submitResult.documentReferenceId);
assert(retrieved, 'retrieveDocument must return bundle');

const attachmentBase64 = Buffer.from('search-attachment').toString('base64');
const attachmentSubmit = await service.submitDocument(
  {
    clinicianId: 'pract-003',
    hzjzId: '1234567',
    username: 'test',
    role: 'clinician',
    organizationId: null,
  },
  {
    patientMbo,
    encounterVisitId,
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234567',
    typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
    anamnesisText: 'Dokument s prilogom za validaciju preuzimanja.',
    outcomeCode: '1',
    attachment: {
      fileName: 'prilog.pdf',
      contentType: 'application/pdf',
      base64Data: attachmentBase64,
    },
  },
);
assert(attachmentSubmit.outcome === 'success', 'attachment submit must succeed');
if (attachmentSubmit.outcome !== 'success') throw new Error('attachment submit failed');

const content = await service.getDocumentContent(attachmentSubmit.documentReferenceId);
assert(content?.base64Data === attachmentBase64, 'getDocumentContent must return attachment data');

console.log('validate-document-search: ok');
