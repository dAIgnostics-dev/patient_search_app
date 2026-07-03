import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../src/fhir/types.ts';
import { buildSubmitDocumentRequest } from '../src/data/document-management/buildSubmitDocumentRequest.ts';
import { MockMhdClient } from '../src/data/mhd-client/mockMhdClient.ts';
import { BaseDocumentExchangeRepository } from '../src/data/repositories/document-exchange/baseDocumentExchangeRepository.ts';
import { createDocumentManagementService } from '../src/data/services/documentManagementService.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repository = new BaseDocumentExchangeRepository(new MockMhdClient());
const service = createDocumentManagementService(repository);

const patientMbo = '180223069';
const encounterVisitId = 'cl8zeaoc9qu1w';
const practitionerHzjzId = '1234567';
const organizationHzzoCode = '1234567';
const attachmentBase64 = Buffer.from('test-pdf').toString('base64');

const { bundle, binaryId } = buildSubmitDocumentRequest(
  {
    patientMbo,
    encounterVisitId,
    practitionerHzjzId,
    organizationHzzoCode,
    typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
    anamnesisText: 'Anamneza za validaciju slanja dokumenta.',
    outcomeCode: '1',
    outcomeDisplay: 'Pregled završen uspješno',
    caseId: 'case-001',
    caseIcd10Code: 'J06.9',
    caseDisplay: 'Akutna infekcija gornjih dišnih puteva',
    attachment: {
      fileName: 'nalaz.pdf',
      contentType: 'application/pdf',
      base64Data: attachmentBase64,
    },
  },
  { practitionerName: 'Dr. Test', organizationName: 'Test ustanova' },
);

assert(bundle.type === 'document', 'bundle must be document type');
assert(
  bundle.entry.some(
    (entry) =>
      entry.resource.resourceType === 'Composition' &&
      entry.resource.type?.coding?.[0]?.code === CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  ),
  'bundle must contain Composition type 011',
);
assert(
  bundle.entry.some((entry) => entry.resource.resourceType === 'Encounter'),
  'bundle must contain Encounter',
);
assert(
  bundle.entry.some(
    (entry) =>
      entry.resource.resourceType === 'Condition' &&
      entry.resource.identifier?.[0]?.value === 'case-001',
  ),
  'bundle must contain optional case Condition',
);
assert(binaryId, 'attachment must produce binary id');

const submitResult = await service.submitDocument(
  {
    clinicianId: 'pract-003',
    hzjzId: practitionerHzjzId,
    username: 'test',
    firstName: 'Test',
    lastName: 'Doctor',
    auditSessionId: 'audit-1',
    role: 'clinician',
    organizationId: null,
  },
  {
    patientMbo,
    encounterVisitId,
    practitionerHzjzId,
    organizationHzzoCode,
    typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
    anamnesisText: 'Anamneza za validaciju slanja dokumenta.',
    outcomeCode: '1',
    attachment: {
      fileName: 'nalaz.pdf',
      contentType: 'application/pdf',
      base64Data: attachmentBase64,
    },
  },
);

assert(submitResult.outcome === 'success', 'submitDocument must succeed');
if (submitResult.outcome !== 'success') throw new Error('submit failed');

assert(submitResult.summary.typeCode === CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA, 'summary type 011');
assert(submitResult.summary.encounterVisitId === encounterVisitId, 'summary encounter must match');
assert((submitResult.summary.attachmentCount ?? 0) >= 1, 'summary must report attachment');

const content = await service.getDocumentContent(submitResult.documentReferenceId);
assert(content?.base64Data === attachmentBase64, 'getDocumentContent must return attachment data');

const searchResults = await repository.searchDocuments({
  patientMbo,
  encounterVisitId,
  typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
});
assert(
  searchResults.some((item) => item.id === submitResult.documentReferenceId),
  'search must find submitted document',
);

console.log('validate-document-submit: ok');
