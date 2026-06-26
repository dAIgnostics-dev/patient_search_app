import { buildCreateEncounterMessage } from '../src/data/encounter-management/buildCreateEncounterMessage.ts';
import { buildCloseEncounterMessage } from '../src/data/encounter-management/buildCloseEncounterMessage.ts';
import { buildCancelEncounterMessage } from '../src/data/encounter-management/buildCancelEncounterMessage.ts';
import { buildReopenEncounterMessage } from '../src/data/encounter-management/buildReopenEncounterMessage.ts';
import { buildUpdateEncounterMessage } from '../src/data/encounter-management/buildUpdateEncounterMessage.ts';
import { parseEncounterManagementResponse } from '../src/data/encounter-management/parseEncounterManagementResponse.ts';
import { MockCezihFhirClient } from '../src/data/fhir-client/mockCezihClient.ts';
import { MockCezihMessageClient } from '../src/data/fhir-client/mockCezihMessageClient.ts';
import { CezihAppRepository } from '../src/data/repositories/cezihAppRepository.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function messageEventCode(bundle: { entry: Array<{ resource: { resourceType: string } }> }): string | undefined {
  const header = bundle.entry[0]?.resource;
  return header.resourceType === 'MessageHeader' && 'eventCoding' in header
    ? (header.eventCoding as { code?: string } | undefined)?.code
    : undefined;
}

const context = { sourceEndpoint: 'urn:oid:1.2.3.4.5.6' };
const now = Date.now();
const encounterStart = new Date(now - 2 * 60 * 60 * 1000).toISOString();
const encounterUpdatedStart = new Date(now - 90 * 60 * 1000).toISOString();
const encounterEnd = new Date(now - 60 * 60 * 1000).toISOString();
const cleanEncounterStart = new Date(now - 45 * 60 * 1000).toISOString();
const cleanEncounterEnd = new Date(now - 30 * 60 * 1000).toISOString();

const createRequest = buildCreateEncounterMessage(
  {
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    periodStart: encounterStart,
    classCode: '9',
    classDisplay: 'Interna uputnica',
  },
  context,
);

assert(createRequest.type === 'message', 'create bundle type must be message');
assert(createRequest.entry.length === 2, 'create bundle must have 2 entries');
assert(
  createRequest.entry[0].resource.resourceType === 'MessageHeader',
  'create first entry must be MessageHeader',
);
assert(
  createRequest.entry[1].resource.resourceType === 'Encounter',
  'create second entry must be Encounter',
);
assert(
  createRequest.entry[1].resource.status === 'in-progress',
  'create Encounter status must be in-progress',
);

const mockClient = new MockCezihMessageClient();
const appRepository = new CezihAppRepository(new MockCezihFhirClient());

const myPatients = await appRepository.getPatientsForPractitioner({
  practitionerId: '1466',
  hzjzId: '1234567',
  firstName: 'Ana',
  lastName: 'Marković',
  username: 'ana.markovic',
  auditSessionId: 'validation-session',
});
assert(
  myPatients.some((patient) => patient.id === '1442'),
  'my patients must include mock CEZIH patient with existing practitioner encounter',
);

const createResponse = await mockClient.postMessage(createRequest);
const createParsed = parseEncounterManagementResponse(createRequest.id, createResponse);

assert(createParsed.outcome === 'success', 'mock create encounter must succeed');
if (createParsed.outcome !== 'success') throw new Error('create failed');

const chartAfterCreate = await appRepository.getPatientDetailById('1442');
assert(chartAfterCreate, 'mock CEZIH chart must be readable after create');
assert(
  chartAfterCreate.encounters.some(
    (encounter) =>
      encounter.visitId === createParsed.visitId && encounter.status === 'in-progress',
  ),
  'created encounter must be persisted in mock CEZIH chart read path',
);

const updateRequest = buildUpdateEncounterMessage(
  {
    visitId: createParsed.visitId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    periodStart: encounterUpdatedStart,
    classCode: '2',
    classDisplay: 'Ambulantno',
    additionalParticipants: [{ hzjzId: '7654321' }],
    priorityCode: 'R',
    diagnosisCaseIds: ['cl3lndh7u000009l6hhzya349'],
  },
  context,
);

assert(
  messageEventCode(updateRequest) === '1.2',
  'update event must be 1.2',
);
const updateEncounterEntry = updateRequest.entry[1].resource;
assert(
  updateEncounterEntry.resourceType === 'Encounter' &&
    updateEncounterEntry.identifier?.some((id) => id.value === createParsed.visitId),
  'update request must include visit identifier',
);

const updateResponse = await mockClient.postMessage(updateRequest);
const updateParsed = parseEncounterManagementResponse(updateRequest.id, updateResponse);

assert(updateParsed.outcome === 'success', 'mock update encounter must succeed');
if (updateParsed.outcome === 'success') {
  assert(updateParsed.encounter.classCode === '2', 'updated class code must be applied');
  assert(updateParsed.visitId === createParsed.visitId, 'visit id must remain unchanged');
}

const chartAfterUpdate = await appRepository.getPatientDetailById('1442');
assert(chartAfterUpdate, 'mock CEZIH chart must be readable after update');
assert(
  chartAfterUpdate.encounters.some(
    (encounter) =>
      encounter.visitId === createParsed.visitId &&
      encounter.status === 'in-progress' &&
      encounter.classCode === '2',
  ),
  'updated encounter must be persisted in mock CEZIH chart read path',
);

const closeRequest = buildCloseEncounterMessage(
  {
    visitId: createParsed.visitId,
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    periodStart: encounterUpdatedStart,
    periodEnd: encounterEnd,
    classCode: '2',
    classDisplay: 'Ambulantno',
    diagnosisCaseIds: ['cl3lndh7u000009l6hhzya349'],
  },
  context,
);

assert(
  messageEventCode(closeRequest) === '1.3',
  'close event must be 1.3',
);
const closeEncounterEntry = closeRequest.entry[1].resource;
assert(
  closeEncounterEntry.resourceType === 'Encounter' &&
    closeEncounterEntry.status === 'finished' &&
    closeEncounterEntry.period?.end === encounterEnd,
  'close request must have finished status and period.end',
);

const closeResponse = await mockClient.postMessage(closeRequest);
const closeParsed = parseEncounterManagementResponse(closeRequest.id, closeResponse);

assert(closeParsed.outcome === 'success', 'mock close encounter must succeed');
if (closeParsed.outcome === 'success') {
  assert(closeParsed.encounter.status === 'finished', 'closed encounter must be finished');
  assert(closeParsed.encounter.end === encounterEnd, 'closed encounter must have end time');
  assert(closeParsed.visitId === createParsed.visitId, 'visit id must remain unchanged after close');
}

const chartAfterClose = await appRepository.getPatientDetailById('1442');
assert(chartAfterClose, 'mock CEZIH chart must be readable after close');
assert(
  chartAfterClose.encounters.some(
    (encounter) =>
      encounter.visitId === createParsed.visitId &&
      encounter.status === 'finished' &&
      encounter.end === encounterEnd,
  ),
  'closed encounter must be persisted in mock CEZIH chart read path',
);

const reopenRequest = buildReopenEncounterMessage(
  {
    visitId: createParsed.visitId,
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    classCode: '2',
    classDisplay: 'Ambulantno',
  },
  context,
);

assert(
  messageEventCode(reopenRequest) === '1.5',
  'reopen event must be 1.5',
);
const reopenEncounterEntry = reopenRequest.entry[1].resource;
assert(
  reopenEncounterEntry.resourceType === 'Encounter' &&
    reopenEncounterEntry.status === 'in-progress' &&
    !reopenEncounterEntry.period,
  'reopen request must have in-progress status and no period',
);

const reopenResponse = await mockClient.postMessage(reopenRequest);
const reopenParsed = parseEncounterManagementResponse(reopenRequest.id, reopenResponse);

assert(reopenParsed.outcome === 'success', 'mock reopen encounter must succeed');
if (reopenParsed.outcome === 'success') {
  assert(reopenParsed.encounter.status === 'in-progress', 'reopened encounter must be in-progress');
  assert(!reopenParsed.encounter.end, 'reopened encounter must not have end time');
  assert(reopenParsed.visitId === createParsed.visitId, 'visit id must remain unchanged after reopen');
}

const chartAfterReopen = await appRepository.getPatientDetailById('1442');
assert(chartAfterReopen, 'mock CEZIH chart must be readable after reopen');
assert(
  chartAfterReopen.encounters.some(
    (encounter) =>
      encounter.visitId === createParsed.visitId &&
      encounter.status === 'in-progress' &&
      !encounter.end,
  ),
  'reopened encounter must be persisted in mock CEZIH chart read path',
);

const linkedCancelRequest = buildCancelEncounterMessage(
  {
    visitId: createParsed.visitId,
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    periodStart: encounterUpdatedStart,
    periodEnd: encounterEnd,
    classCode: '2',
    classDisplay: 'Ambulantno',
    diagnosisCaseIds: ['cl3lndh7u000009l6hhzya349'],
  },
  context,
);

assert(
  messageEventCode(linkedCancelRequest) === '1.4',
  'cancel event must be 1.4',
);
const linkedCancelEncounterEntry = linkedCancelRequest.entry[1].resource;
assert(
  linkedCancelEncounterEntry.resourceType === 'Encounter' &&
    linkedCancelEncounterEntry.status === 'entered-in-error' &&
    linkedCancelEncounterEntry.period?.end === encounterEnd,
  'cancel request must have entered-in-error status and period.end',
);

const linkedCancelResponse = await mockClient.postMessage(linkedCancelRequest);
const linkedCancelParsed = parseEncounterManagementResponse(
  linkedCancelRequest.id,
  linkedCancelResponse,
);

assert(
  linkedCancelParsed.outcome === 'error',
  'mock cancel encounter with linked case must fail',
);

const cleanCreateRequest = buildCreateEncounterMessage(
  {
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    periodStart: cleanEncounterStart,
    classCode: '9',
    classDisplay: 'Interna uputnica',
  },
  context,
);

const cleanCreateResponse = await mockClient.postMessage(cleanCreateRequest);
const cleanCreateParsed = parseEncounterManagementResponse(
  cleanCreateRequest.id,
  cleanCreateResponse,
);

assert(cleanCreateParsed.outcome === 'success', 'mock clean create encounter must succeed');
if (cleanCreateParsed.outcome !== 'success') throw new Error('clean create failed');
assert(
  cleanCreateParsed.encounter.id !== createParsed.encounter.id,
  'separate created encounters must have unique FHIR ids',
);
assert(
  cleanCreateParsed.visitId !== createParsed.visitId,
  'separate created encounters must have unique visit identifiers',
);

const cancelRequest = buildCancelEncounterMessage(
  {
    visitId: cleanCreateParsed.visitId,
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    periodStart: cleanEncounterStart,
    periodEnd: cleanEncounterEnd,
    classCode: '9',
    classDisplay: 'Interna uputnica',
  },
  context,
);

const cancelResponse = await mockClient.postMessage(cancelRequest);
const cancelParsed = parseEncounterManagementResponse(cancelRequest.id, cancelResponse);

assert(cancelParsed.outcome === 'success', 'mock cancel encounter must succeed');
if (cancelParsed.outcome === 'success') {
  assert(
    cancelParsed.encounter.status === 'entered-in-error',
    'cancelled encounter must be entered-in-error',
  );
  assert(
    cancelParsed.visitId === cleanCreateParsed.visitId,
    'visit id must remain unchanged after cancel',
  );
}

const chartAfterCancel = await appRepository.getPatientDetailById('1442');
assert(chartAfterCancel, 'mock CEZIH chart must be readable after cancel');
assert(
  chartAfterCancel.encounters.some(
    (encounter) =>
      encounter.visitId === cleanCreateParsed.visitId &&
      encounter.status === 'entered-in-error',
  ),
  'cancelled encounter must be persisted in mock CEZIH chart read path',
);

const reopenCancelledRequest = buildReopenEncounterMessage(
  {
    visitId: cleanCreateParsed.visitId,
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    classCode: '9',
    classDisplay: 'Interna uputnica',
  },
  context,
);

const reopenCancelledResponse = await mockClient.postMessage(reopenCancelledRequest);
const reopenCancelledParsed = parseEncounterManagementResponse(
  reopenCancelledRequest.id,
  reopenCancelledResponse,
);

assert(
  reopenCancelledParsed.outcome === 'success',
  'mock reopen cancelled encounter must succeed',
);
if (reopenCancelledParsed.outcome === 'success') {
  assert(
    reopenCancelledParsed.encounter.status === 'in-progress',
    'reopened cancelled encounter must be in-progress',
  );
}

const chartAfterReopenCancelled = await appRepository.getPatientDetailById('1442');
assert(chartAfterReopenCancelled, 'mock CEZIH chart must be readable after cancelled reopen');
assert(
  chartAfterReopenCancelled.encounters.some(
    (encounter) =>
      encounter.visitId === cleanCreateParsed.visitId &&
      encounter.status === 'in-progress' &&
      !encounter.end,
  ),
  'reopened cancelled encounter must be persisted in mock CEZIH chart read path',
);

console.log('Encounter message validation passed.');
