import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../src/fhir/types.ts';
import { MockMhdClient } from '../src/data/mhd-client/mockMhdClient.ts';
import { BaseDocumentExchangeRepository } from '../src/data/repositories/document-exchange/baseDocumentExchangeRepository.ts';
import { createDocumentManagementService } from '../src/data/services/documentManagementService.ts';
import { MockLomNotificationClient } from '../src/data/lom-notification/mockLomNotificationClient.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

MockLomNotificationClient.reset();
const lomClient = new MockLomNotificationClient();
const repository = new BaseDocumentExchangeRepository(new MockMhdClient());
const service = createDocumentManagementService(repository, lomClient);

const patientMbo = '180223069';
const encounterVisitId = 'cl8zeaoc9qu1w';
const practitionerHzjzId = '1234567';

const submitResult = await service.submitDocument(
  {
    clinicianId: 'pract-003',
    hzjzId: practitionerHzjzId,
    username: 'test',
    role: 'clinician',
    organizationId: null,
  },
  {
    patientMbo,
    encounterVisitId,
    practitionerHzjzId,
    organizationHzzoCode: '1234567',
    typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
    anamnesisText: 'Anamneza za LOM validaciju.',
    outcomeCode: '1',
  },
);

assert(submitResult.outcome === 'success', 'submit must succeed');
if (submitResult.outcome !== 'success') throw new Error('submit failed');

assert(MockLomNotificationClient.capturedEvents.length === 1, 'LOM must receive one event');
const event = MockLomNotificationClient.capturedEvents[0];
assert(event.documentReferenceId === submitResult.documentReferenceId, 'LOM event documentReferenceId');
assert(event.patientMbo === patientMbo, 'LOM event patientMbo');
assert(event.typeCode === CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA, 'LOM event typeCode');
assert(event.practitionerHzjzId === practitionerHzjzId, 'LOM event practitionerHzjzId');
assert(typeof event.submittedAt === 'string', 'LOM event submittedAt');

console.log('validate-lom-notification: ok');
