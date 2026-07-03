import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../src/fhir/types.ts';
import { MockMhdClient, buildMinimalTestDocumentBundle } from '../src/data/mhd-client/mockMhdClient.ts';
import { BaseDocumentExchangeRepository } from '../src/data/repositories/document-exchange/baseDocumentExchangeRepository.ts';
import { findMockDocumentReferenceById } from '../src/data/fhir-client/mockCezihClient.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const client = new MockMhdClient();
const repository = new BaseDocumentExchangeRepository(client);

const bundleId = `doc-bundle-mhd-${Date.now()}`;
const documentOid = `urn:oid:2.16.840.1.113883.2.7.50.2.1.${Date.now()}`;
const patientMbo = '180223069';
const encounterVisitId = 'cl8zeaoc9qu1w';

const bundle = buildMinimalTestDocumentBundle(
  bundleId,
  documentOid,
  patientMbo,
  encounterVisitId,
);

const submitResult = await repository.submitDocument({ bundle });
assert(submitResult.outcome === 'success', 'submitDocument must succeed');
if (submitResult.outcome !== 'success') throw new Error('submit failed');

assert(submitResult.summary.typeCode === CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA, 'type must be 011');
assert(submitResult.summary.encounterVisitId === encounterVisitId, 'encounter visit must match');

const searchResults = await repository.searchDocuments({
  patientMbo,
  typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  encounterVisitId,
});
assert(
  searchResults.some((item) => item.id === submitResult.documentReferenceId),
  'searchDocuments must find submitted document',
);

const retrieved = await repository.retrieveDocument(submitResult.documentReferenceId);
assert(retrieved, 'retrieveDocument must return bundle');
assert(
  retrieved?.entry.some(
    (entry) =>
      entry.resource.resourceType === 'Composition' &&
      entry.resource.type?.coding?.[0]?.code === CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  ),
  'retrieved bundle must contain Composition type 011',
);

const updatedBundle = buildMinimalTestDocumentBundle(
  `${bundleId}-v2`,
  `${documentOid}.v2`,
  patientMbo,
  encounterVisitId,
);
const updateResult = await repository.updateDocument({
  replacesDocumentReferenceId: submitResult.documentReferenceId,
  bundle: updatedBundle,
});
assert(updateResult.outcome === 'success', 'updateDocument must succeed');
if (updateResult.outcome !== 'success') throw new Error('update failed');

const updatedReference = await findMockDocumentReferenceById(updateResult.documentReferenceId);
assert(updatedReference?.relatesTo?.[0]?.code === 'replaces', 'updated summary must relateTo replaces');

const cancelResult = await repository.cancelDocument({
  documentReferenceId: submitResult.documentReferenceId,
});
assert(cancelResult.outcome === 'success', 'cancelDocument must succeed');
if (cancelResult.outcome !== 'success') throw new Error('cancel failed');
assert(
  cancelResult.summary.compositionStatus === 'entered-in-error',
  'cancelled document must have entered-in-error status',
);

const directSearch = await client.searchDocuments({ patientMbo, encounterVisitId });
assert(directSearch.total >= 1, 'MhdClient searchDocuments must return results');

console.log('validate-document-exchange: ok');
