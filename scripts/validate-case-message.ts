import { buildCreateCaseMessage } from '../src/data/case-management/buildCreateCaseMessage.ts';
import { buildCreateCaseRecurrenceMessage } from '../src/data/case-management/buildCreateCaseRecurrenceMessage.ts';
import { buildDeleteCaseMessage } from '../src/data/case-management/buildDeleteCaseMessage.ts';
import { buildRemissionCaseMessage } from '../src/data/case-management/buildRemissionCaseMessage.ts';
import { buildRelapseCaseMessage } from '../src/data/case-management/buildRelapseCaseMessage.ts';
import { buildResolveCaseMessage } from '../src/data/case-management/buildResolveCaseMessage.ts';
import { buildUpdateCaseMessage } from '../src/data/case-management/buildUpdateCaseMessage.ts';
import { parseCaseManagementResponse } from '../src/data/case-management/parseCaseManagementResponse.ts';
import { buildCreateEncounterMessage } from '../src/data/encounter-management/buildCreateEncounterMessage.ts';
import { parseEncounterManagementResponse } from '../src/data/encounter-management/parseEncounterManagementResponse.ts';
import {
  appendMockCondition,
  appendMockEncounter,
  MockCezihFhirClient,
} from '../src/data/fhir-client/mockCezihClient.ts';
import { MockCezihMessageClient } from '../src/data/fhir-client/mockCezihMessageClient.ts';
import { CezihAppRepository } from '../src/data/repositories/cezihAppRepository.ts';
import {
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_CASE_RESPONSE_EVENT,
  CEZIH_CREATE_CASE_EVENT,
  CEZIH_CREATE_CASE_RECURRENCE_EVENT,
  CEZIH_DELETE_CASE_EVENT,
  CEZIH_EHE_MESSAGE_TYPES,
  CEZIH_HZJZ_SYSTEM,
  CEZIH_ICD10_HR_SYSTEM,
  CEZIH_MBO_SYSTEM,
  CEZIH_REMISSION_CASE_EVENT,
  CEZIH_RELAPSE_CASE_EVENT,
  CEZIH_RESOLVE_CASE_EVENT,
  CEZIH_VISIT_SYSTEM,
  FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
  FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
} from '../src/fhir/types.ts';

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
const mockClient = new MockCezihMessageClient();
const appRepository = new CezihAppRepository(new MockCezihFhirClient());

const createEncounterRequest = buildCreateEncounterMessage(
  {
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    organizationHzzoCode: '1234',
    periodStart: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    classCode: '2',
    classDisplay: 'Ambulantno',
  },
  context,
);

const createEncounterResponse = await mockClient.postMessage(createEncounterRequest);
const createEncounterParsed = parseEncounterManagementResponse(
  createEncounterRequest.id,
  createEncounterResponse,
);
assert(createEncounterParsed.outcome === 'success', 'mock create encounter must succeed');
if (createEncounterParsed.outcome !== 'success') throw new Error('encounter create failed');

const createCaseRequest = buildCreateCaseMessage(
  {
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    encounterVisitId: createEncounterParsed.visitId,
    onsetDate: new Date().toISOString().slice(0, 10),
    diagnosisCode: 'R51',
    diagnosisDisplay: 'Glavobolja',
    diagnosisText: 'Glavobolja',
    verificationStatus: 'unconfirmed',
    localIdentifier: 'local-case-validation',
    note: 'Validacijski slučaj glavobolje.',
  },
  context,
);

assert(messageEventCode(createCaseRequest) === CEZIH_CREATE_CASE_EVENT, 'case create event must be 2.1');
assert(createCaseRequest.entry.length === 2, 'case create bundle must have 2 entries');
assert(
  createCaseRequest.entry[0].resource.resourceType === 'MessageHeader' &&
    createCaseRequest.entry[0].resource.eventCoding?.system === CEZIH_EHE_MESSAGE_TYPES,
  'case create first entry must be MessageHeader with CEZIH event system',
);
const conditionRequestEntry = createCaseRequest.entry[1].resource;
assert(conditionRequestEntry.resourceType === 'Condition', 'case create second entry must be Condition');
assert(!conditionRequestEntry.clinicalStatus, 'case create request must not include clinicalStatus');
assert(!conditionRequestEntry.recordedDate, 'case create request must not include recordedDate');
assert(
  !conditionRequestEntry.identifier?.some((identifier) => identifier.system === CEZIH_CASE_IDENTIFIER_SYSTEM),
  'case create request must not include service case identifier',
);

const createCaseResponse = await mockClient.postMessage(createCaseRequest);
const createCaseParsed = parseCaseManagementResponse(createCaseRequest.id, createCaseResponse);
assert(createCaseParsed.outcome === 'success', 'mock create case must succeed');
if (createCaseParsed.outcome !== 'success') throw new Error('case create failed');
assert(createCaseParsed.caseId, 'created case must have service case identifier');
assert(createCaseParsed.condition.clinicalStatus === 'active', 'created case must be active');
assert(createCaseParsed.condition.verificationStatus === 'unconfirmed', 'verification status must persist');
assert(createCaseParsed.condition.recordedDate, 'created case must have recordedDate');
assert(createCaseParsed.condition.recorderHzjzId === '1234567', 'created case must have recorder');
assert(
  createCaseParsed.condition.encounterVisitId === createEncounterParsed.visitId,
  'created case must reference encounter visit ID',
);

const chartAfterCreate = await appRepository.getPatientDetailById('1442');
assert(chartAfterCreate, 'mock CEZIH chart must be readable after case create');
assert(
  chartAfterCreate.conditions.some(
    (condition) =>
      condition.caseId === createCaseParsed.caseId &&
      condition.icd10Code === 'R51' &&
      condition.clinicalStatus === 'active',
  ),
  'created case must be persisted in mock CEZIH chart read path',
);

const previousResolvedCaseId = `resolved-case-${crypto.randomUUID()}`;
await appendMockCondition({
  resourceType: 'Condition',
  id: `mock-cond-${crypto.randomUUID()}`,
  identifier: [{ system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: previousResolvedCaseId }],
  clinicalStatus: {
    coding: [{ system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM, code: 'resolved' }],
  },
  verificationStatus: {
    coding: [{ system: FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM, code: 'confirmed' }],
  },
  code: {
    coding: [
      {
        system: CEZIH_ICD10_HR_SYSTEM,
        code: 'R51',
        display: 'Glavobolja',
      },
    ],
    text: 'Glavobolja',
  },
  subject: {
    type: 'Patient',
    identifier: { system: CEZIH_MBO_SYSTEM, value: '180223069' },
  },
  onsetDateTime: '2021-12-05',
  abatementDateTime: '2022-01-10',
  recordedDate: '2022-01-10',
  recorder: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
  asserter: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
});

const createCaseRecurrenceRequest = buildCreateCaseRecurrenceMessage(
  {
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    encounterVisitId: createEncounterParsed.visitId,
    previousCaseId: previousResolvedCaseId,
    onsetDate: new Date().toISOString().slice(0, 10),
    diagnosisCode: 'R51',
    diagnosisDisplay: 'Glavobolja',
    diagnosisText: 'Glavobolja',
    verificationStatus: 'unconfirmed',
    localIdentifier: 'local-case-recurrence-validation',
    note: 'Validacijski ponovljeni slučaj glavobolje.',
  },
  context,
);

assert(
  messageEventCode(createCaseRecurrenceRequest) === CEZIH_CREATE_CASE_RECURRENCE_EVENT,
  'case recurrence create event must be 2.2',
);
const recurrenceConditionRequestEntry = createCaseRecurrenceRequest.entry[1].resource;
assert(
  recurrenceConditionRequestEntry.resourceType === 'Condition',
  'case recurrence create second entry must be Condition',
);
assert(
  !recurrenceConditionRequestEntry.identifier?.some(
    (identifier) => identifier.system === CEZIH_CASE_IDENTIFIER_SYSTEM,
  ),
  'case recurrence create request must not include service case identifier',
);

const createCaseRecurrenceResponse = await mockClient.postMessage(createCaseRecurrenceRequest);
const createCaseRecurrenceParsed = parseCaseManagementResponse(
  createCaseRecurrenceRequest.id,
  createCaseRecurrenceResponse,
);
assert(
  createCaseRecurrenceParsed.outcome === 'success',
  'mock create case recurrence must succeed',
);
if (createCaseRecurrenceParsed.outcome !== 'success') {
  throw new Error('case recurrence create failed');
}
assert(createCaseRecurrenceParsed.caseId, 'created recurring case must have service case identifier');
assert(
  createCaseRecurrenceParsed.caseId !== previousResolvedCaseId,
  'created recurring case must receive a new case identifier',
);
assert(
  createCaseRecurrenceParsed.condition.clinicalStatus === 'active',
  'created recurring case must be active',
);
assert(
  createCaseRecurrenceParsed.condition.recordedDate,
  'created recurring case must have recordedDate',
);
assert(
  createCaseRecurrenceParsed.condition.recorderHzjzId === '1234567',
  'created recurring case must have recorder',
);

const chartAfterRecurrence = await appRepository.getPatientDetailById('1442');
assert(chartAfterRecurrence, 'mock CEZIH chart must be readable after case recurrence create');
assert(
  chartAfterRecurrence.conditions.some(
    (condition) =>
      condition.caseId === createCaseRecurrenceParsed.caseId &&
      condition.icd10Code === 'R51' &&
      condition.clinicalStatus === 'active',
  ),
  'created recurring case must be persisted in mock CEZIH chart read path',
);

const updateCaseRequest = buildUpdateCaseMessage(
  {
    caseId: createCaseRecurrenceParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    clinicalStatus: 'active',
    localIdentifier: 'local-case-updated-validation',
    verificationStatus: 'confirmed',
    diagnosisCode: 'C00',
    diagnosisDisplay: 'Zloćudna novotvorina usne',
    diagnosisText: 'Neoplasma malignum labii',
    onsetDate: '2024-04-01',
    note: 'Ažurirana validacijska napomena o slučaju.',
  },
  context,
);

assert(messageEventCode(updateCaseRequest) === CEZIH_CASE_RESPONSE_EVENT, 'case update event must be 2.6');
assert(updateCaseRequest.entry.length === 2, 'case update bundle must have 2 entries');
const updateConditionRequestEntry = updateCaseRequest.entry[1].resource;
assert(updateConditionRequestEntry.resourceType === 'Condition', 'case update second entry must be Condition');
assert(
  updateConditionRequestEntry.identifier?.some((identifier) => identifier.value === createCaseRecurrenceParsed.caseId),
  'case update request must include service case identifier',
);
assert(
  updateConditionRequestEntry.clinicalStatus?.coding?.[0]?.code === 'active',
  'case update request must include current clinicalStatus',
);
assert(
  updateConditionRequestEntry.verificationStatus?.coding?.[0]?.code === 'confirmed',
  'case update request must include verificationStatus',
);
assert(updateConditionRequestEntry.code?.coding?.[0]?.code === 'C00', 'case update request must include diagnosis code');
assert(updateConditionRequestEntry.onsetDateTime === '2024-04-01', 'case update request must include onsetDateTime');
assert(!updateConditionRequestEntry.recordedDate, 'case update request must not include recordedDate');
assert(!updateConditionRequestEntry.recorder, 'case update request must not include recorder');

const updateCaseResponse = await mockClient.postMessage(updateCaseRequest);
const updateCaseParsed = parseCaseManagementResponse(updateCaseRequest.id, updateCaseResponse);
assert(updateCaseParsed.outcome === 'success', 'mock update case must succeed');
if (updateCaseParsed.outcome !== 'success') throw new Error('case update failed');
assert(updateCaseParsed.caseId === createCaseRecurrenceParsed.caseId, 'updated case must preserve case identifier');
assert(updateCaseParsed.condition.clinicalStatus === 'active', 'updated case must preserve clinical status');
assert(updateCaseParsed.condition.verificationStatus === 'confirmed', 'updated case must update verification status');
assert(updateCaseParsed.condition.icd10Code === 'C00', 'updated case must update diagnosis code');
assert(updateCaseParsed.condition.onsetDate === '2024-04-01', 'updated case must update onset date');
assert(updateCaseParsed.condition.note === 'Ažurirana validacijska napomena o slučaju.', 'updated case must update note');

const chartAfterUpdate = await appRepository.getPatientDetailById('1442');
assert(chartAfterUpdate, 'mock CEZIH chart must be readable after case update');
assert(
  chartAfterUpdate.conditions.some(
    (condition) =>
      condition.caseId === createCaseRecurrenceParsed.caseId &&
      condition.icd10Code === 'C00' &&
      condition.verificationStatus === 'confirmed' &&
      condition.onsetDate === '2024-04-01' &&
      condition.clinicalStatus === 'active',
  ),
  'updated case must be persisted in mock CEZIH chart read path',
);

const remissionFromActiveRequest = buildRemissionCaseMessage(
  {
    caseId: createCaseRecurrenceParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
  },
  context,
);

assert(
  messageEventCode(remissionFromActiveRequest) === CEZIH_REMISSION_CASE_EVENT,
  'case remission event must be 2.3',
);
assert(remissionFromActiveRequest.entry.length === 2, 'case remission bundle must have 2 entries');
const remissionConditionRequestEntry = remissionFromActiveRequest.entry[1].resource;
assert(
  remissionConditionRequestEntry.resourceType === 'Condition',
  'case remission second entry must be Condition',
);
assert(
  remissionConditionRequestEntry.identifier?.[0]?.value === createCaseRecurrenceParsed.caseId,
  'remission request must include service case identifier',
);
assert(!remissionConditionRequestEntry.clinicalStatus, 'case remission request must not include clinicalStatus');
assert(!remissionConditionRequestEntry.verificationStatus, 'case remission request must not include verificationStatus');
assert(!remissionConditionRequestEntry.code, 'case remission request must not include diagnosis code');
assert(!remissionConditionRequestEntry.encounter, 'case remission request must not include encounter');
assert(!remissionConditionRequestEntry.note, 'case remission request must not include note');

const remissionFromActiveResponse = await mockClient.postMessage(remissionFromActiveRequest);
const remissionFromActiveParsed = parseCaseManagementResponse(
  remissionFromActiveRequest.id,
  remissionFromActiveResponse,
);
assert(remissionFromActiveParsed.outcome === 'success', 'mock remission from active case must succeed');
if (remissionFromActiveParsed.outcome !== 'success') {
  throw new Error('case remission from active failed');
}
assert(
  remissionFromActiveParsed.caseId === createCaseRecurrenceParsed.caseId,
  'remission case must preserve case identifier',
);
assert(
  remissionFromActiveParsed.condition.clinicalStatus === 'remission',
  'remission case must have remission clinical status',
);

const chartAfterRemission = await appRepository.getPatientDetailById('1442');
assert(chartAfterRemission, 'mock CEZIH chart must be readable after case remission');
assert(
  chartAfterRemission.conditions.some(
    (condition) =>
      condition.caseId === createCaseRecurrenceParsed.caseId &&
      condition.icd10Code === 'C00' &&
      condition.clinicalStatus === 'remission',
  ),
  'remission case must be persisted in mock CEZIH chart read path',
);

const updateRemissionAbatementDate = '2024-05-15';
const updateRemissionAbatementRequest = buildUpdateCaseMessage(
  {
    caseId: createCaseRecurrenceParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    clinicalStatus: 'remission',
    verificationStatus: 'confirmed',
    diagnosisCode: 'C00',
    diagnosisDisplay: 'Zloćudna novotvorina usne',
    diagnosisText: 'Neoplasma malignum labii',
    onsetDate: '2024-04-01',
    abatementDate: updateRemissionAbatementDate,
  },
  context,
);
const updateRemissionAbatementResponse = await mockClient.postMessage(updateRemissionAbatementRequest);
const updateRemissionAbatementParsed = parseCaseManagementResponse(
  updateRemissionAbatementRequest.id,
  updateRemissionAbatementResponse,
);
assert(
  updateRemissionAbatementParsed.outcome === 'success',
  'mock update case abatement date for remission case must succeed',
);
if (updateRemissionAbatementParsed.outcome !== 'success') {
  throw new Error('case update abatement date failed');
}
assert(
  updateRemissionAbatementParsed.condition.abatementDate === updateRemissionAbatementDate,
  'updated remission case must persist abatement date',
);

const remissionCaseId = `remission-case-${crypto.randomUUID()}`;
await appendMockCondition({
  resourceType: 'Condition',
  id: `mock-cond-${crypto.randomUUID()}`,
  identifier: [{ system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: remissionCaseId }],
  clinicalStatus: {
    coding: [{ system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM, code: 'remission' }],
  },
  verificationStatus: {
    coding: [{ system: FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM, code: 'confirmed' }],
  },
  code: {
    coding: [
      {
        system: CEZIH_ICD10_HR_SYSTEM,
        code: 'R51',
        display: 'Glavobolja',
      },
    ],
    text: 'Glavobolja',
  },
  subject: {
    type: 'Patient',
    identifier: { system: CEZIH_MBO_SYSTEM, value: '180223069' },
  },
  onsetDateTime: '2023-02-15',
  recordedDate: '2023-02-15',
  recorder: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
  asserter: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
});

const relapseCaseRequest = buildRelapseCaseMessage(
  {
    caseId: remissionCaseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
  },
  context,
);

assert(messageEventCode(relapseCaseRequest) === CEZIH_RELAPSE_CASE_EVENT, 'case relapse event must be 2.5');
assert(relapseCaseRequest.entry.length === 2, 'case relapse bundle must have 2 entries');
const relapseConditionRequestEntry = relapseCaseRequest.entry[1].resource;
assert(relapseConditionRequestEntry.resourceType === 'Condition', 'case relapse second entry must be Condition');
assert(relapseConditionRequestEntry.identifier?.[0]?.value === remissionCaseId, 'relapse request must include service case identifier');
assert(!relapseConditionRequestEntry.clinicalStatus, 'case relapse request must not include clinicalStatus');
assert(!relapseConditionRequestEntry.verificationStatus, 'case relapse request must not include verificationStatus');
assert(!relapseConditionRequestEntry.code, 'case relapse request must not include diagnosis code');
assert(!relapseConditionRequestEntry.encounter, 'case relapse request must not include encounter');
assert(!relapseConditionRequestEntry.note, 'case relapse request must not include note');

const relapseCaseResponse = await mockClient.postMessage(relapseCaseRequest);
const relapseCaseParsed = parseCaseManagementResponse(relapseCaseRequest.id, relapseCaseResponse);
assert(relapseCaseParsed.outcome === 'success', 'mock relapse case must succeed');
if (relapseCaseParsed.outcome !== 'success') throw new Error('case relapse failed');
assert(relapseCaseParsed.caseId === remissionCaseId, 'relapsed case must preserve case identifier');
assert(relapseCaseParsed.condition.clinicalStatus === 'relapse', 'relapsed case must have relapse clinical status');

const chartAfterRelapse = await appRepository.getPatientDetailById('1442');
assert(chartAfterRelapse, 'mock CEZIH chart must be readable after case relapse');
assert(
  chartAfterRelapse.conditions.some(
    (condition) =>
      condition.caseId === remissionCaseId &&
      condition.icd10Code === 'R51' &&
      condition.clinicalStatus === 'relapse',
  ),
  'relapsed case must be persisted in mock CEZIH chart read path',
);

const relapseWithoutCaseIdRequest = buildRelapseCaseMessage(
  {
    caseId: '',
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
  },
  context,
);
const relapseWithoutCaseIdResponse = await mockClient.postMessage(relapseWithoutCaseIdRequest);
const relapseWithoutCaseIdParsed = parseCaseManagementResponse(
  relapseWithoutCaseIdRequest.id,
  relapseWithoutCaseIdResponse,
);
assert(
  relapseWithoutCaseIdParsed.outcome === 'error',
  'case relapse without case ID must fail',
);

const relapseWithoutSubjectRequest = buildRelapseCaseMessage(
  {
    caseId: remissionCaseId,
    patientMbo: '',
    practitionerHzjzId: '1234567',
  },
  context,
);
const relapseWithoutSubjectResponse = await mockClient.postMessage(relapseWithoutSubjectRequest);
const relapseWithoutSubjectParsed = parseCaseManagementResponse(
  relapseWithoutSubjectRequest.id,
  relapseWithoutSubjectResponse,
);
assert(
  relapseWithoutSubjectParsed.outcome === 'error',
  'case relapse without subject MBO must fail',
);

const relapseActiveCaseRequest = buildRelapseCaseMessage(
  {
    caseId: createCaseParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
  },
  context,
);
const relapseActiveCaseResponse = await mockClient.postMessage(relapseActiveCaseRequest);
const relapseActiveCaseParsed = parseCaseManagementResponse(
  relapseActiveCaseRequest.id,
  relapseActiveCaseResponse,
);
assert(
  relapseActiveCaseParsed.outcome === 'error',
  'case relapse from non-remission status must fail',
);

const remissionFromRelapseRequest = buildRemissionCaseMessage(
  {
    caseId: remissionCaseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
  },
  context,
);
const remissionFromRelapseResponse = await mockClient.postMessage(remissionFromRelapseRequest);
const remissionFromRelapseParsed = parseCaseManagementResponse(
  remissionFromRelapseRequest.id,
  remissionFromRelapseResponse,
);
assert(
  remissionFromRelapseParsed.outcome === 'success',
  'mock remission from relapse case must succeed',
);
if (remissionFromRelapseParsed.outcome !== 'success') {
  throw new Error('case remission from relapse failed');
}
assert(
  remissionFromRelapseParsed.condition.clinicalStatus === 'remission',
  'remission from relapse must have remission clinical status',
);

const remissionWithoutCaseIdRequest = buildRemissionCaseMessage(
  {
    caseId: '',
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
  },
  context,
);
const remissionWithoutCaseIdResponse = await mockClient.postMessage(remissionWithoutCaseIdRequest);
const remissionWithoutCaseIdParsed = parseCaseManagementResponse(
  remissionWithoutCaseIdRequest.id,
  remissionWithoutCaseIdResponse,
);
assert(
  remissionWithoutCaseIdParsed.outcome === 'error',
  'case remission without case ID must fail',
);

const remissionWithoutSubjectRequest = buildRemissionCaseMessage(
  {
    caseId: remissionCaseId,
    patientMbo: '',
    practitionerHzjzId: '1234567',
  },
  context,
);
const remissionWithoutSubjectResponse = await mockClient.postMessage(remissionWithoutSubjectRequest);
const remissionWithoutSubjectParsed = parseCaseManagementResponse(
  remissionWithoutSubjectRequest.id,
  remissionWithoutSubjectResponse,
);
assert(
  remissionWithoutSubjectParsed.outcome === 'error',
  'case remission without subject MBO must fail',
);

const remissionResolvedCaseRequest = buildRemissionCaseMessage(
  {
    caseId: previousResolvedCaseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
  },
  context,
);
const remissionResolvedCaseResponse = await mockClient.postMessage(remissionResolvedCaseRequest);
const remissionResolvedCaseParsed = parseCaseManagementResponse(
  remissionResolvedCaseRequest.id,
  remissionResolvedCaseResponse,
);
assert(
  remissionResolvedCaseParsed.outcome === 'error',
  'case remission from non-active/non-relapse status must fail',
);

const updateWithoutCaseIdRequest = buildUpdateCaseMessage(
  {
    caseId: '',
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
  },
  context,
);
const updateWithoutCaseIdResponse = await mockClient.postMessage(updateWithoutCaseIdRequest);
const updateWithoutCaseIdParsed = parseCaseManagementResponse(
  updateWithoutCaseIdRequest.id,
  updateWithoutCaseIdResponse,
);
assert(updateWithoutCaseIdParsed.outcome === 'error', 'case update without case ID must fail');

const updateWithoutSubjectRequest = buildUpdateCaseMessage(
  {
    caseId: createCaseParsed.caseId,
    patientMbo: '',
    practitionerHzjzId: '1234567',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
  },
  context,
);
const updateWithoutSubjectResponse = await mockClient.postMessage(updateWithoutSubjectRequest);
const updateWithoutSubjectParsed = parseCaseManagementResponse(
  updateWithoutSubjectRequest.id,
  updateWithoutSubjectResponse,
);
assert(updateWithoutSubjectParsed.outcome === 'error', 'case update without subject MBO must fail');

const updateClinicalStatusChangeRequest = buildUpdateCaseMessage(
  {
    caseId: createCaseParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    clinicalStatus: 'remission',
    verificationStatus: 'confirmed',
  },
  context,
);
const updateClinicalStatusChangeResponse = await mockClient.postMessage(updateClinicalStatusChangeRequest);
const updateClinicalStatusChangeParsed = parseCaseManagementResponse(
  updateClinicalStatusChangeRequest.id,
  updateClinicalStatusChangeResponse,
);
assert(
  updateClinicalStatusChangeParsed.outcome === 'error',
  'case update changing clinical status must fail',
);

const updateActiveAbatementRequest = buildUpdateCaseMessage(
  {
    caseId: createCaseParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    abatementDate: '2024-06-01',
  },
  context,
);
const updateActiveAbatementResponse = await mockClient.postMessage(updateActiveAbatementRequest);
const updateActiveAbatementParsed = parseCaseManagementResponse(
  updateActiveAbatementRequest.id,
  updateActiveAbatementResponse,
);
assert(
  updateActiveAbatementParsed.outcome === 'error',
  'case update abatement date on active case must fail',
);

const resolveCaseId = `resolve-case-${crypto.randomUUID()}`;
await appendMockCondition({
  resourceType: 'Condition',
  id: `mock-cond-${crypto.randomUUID()}`,
  identifier: [{ system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: resolveCaseId }],
  clinicalStatus: {
    coding: [{ system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM, code: 'active' }],
  },
  verificationStatus: {
    coding: [{ system: FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM, code: 'confirmed' }],
  },
  code: {
    coding: [
      {
        system: CEZIH_ICD10_HR_SYSTEM,
        code: 'R51',
        display: 'Glavobolja',
      },
    ],
    text: 'Glavobolja',
  },
  subject: {
    type: 'Patient',
    identifier: { system: CEZIH_MBO_SYSTEM, value: '180223069' },
  },
  onsetDateTime: '2024-03-20',
  recordedDate: '2024-03-20',
  recorder: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
  asserter: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
});

const resolveAbatementDate = new Date().toISOString().slice(0, 10);
const resolveCaseRequest = buildResolveCaseMessage(
  {
    caseId: resolveCaseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    abatementDate: resolveAbatementDate,
  },
  context,
);

assert(messageEventCode(resolveCaseRequest) === CEZIH_RESOLVE_CASE_EVENT, 'case resolve event must be 2.4');
assert(resolveCaseRequest.entry.length === 2, 'case resolve bundle must have 2 entries');
const resolveConditionRequestEntry = resolveCaseRequest.entry[1].resource;
assert(resolveConditionRequestEntry.resourceType === 'Condition', 'case resolve second entry must be Condition');
assert(resolveConditionRequestEntry.identifier?.[0]?.value === resolveCaseId, 'resolve request must include service case identifier');
assert(
  resolveConditionRequestEntry.clinicalStatus?.coding?.[0]?.code === 'resolved',
  'case resolve request must include resolved clinicalStatus',
);
assert(resolveConditionRequestEntry.abatementDateTime === resolveAbatementDate, 'case resolve request must include abatementDateTime');
assert(!resolveConditionRequestEntry.verificationStatus, 'case resolve request must not include verificationStatus');
assert(!resolveConditionRequestEntry.code, 'case resolve request must not include diagnosis code');
assert(!resolveConditionRequestEntry.encounter, 'case resolve request must not include encounter');
assert(!resolveConditionRequestEntry.onsetDateTime, 'case resolve request must not include onsetDateTime');
assert(!resolveConditionRequestEntry.recordedDate, 'case resolve request must not include recordedDate');
assert(!resolveConditionRequestEntry.recorder, 'case resolve request must not include recorder');
assert(!resolveConditionRequestEntry.asserter, 'case resolve request must not include asserter');
assert(!resolveConditionRequestEntry.note, 'case resolve request must not include note');

const resolveCaseResponse = await mockClient.postMessage(resolveCaseRequest);
const resolveCaseParsed = parseCaseManagementResponse(resolveCaseRequest.id, resolveCaseResponse);
assert(resolveCaseParsed.outcome === 'success', 'mock resolve case must succeed');
if (resolveCaseParsed.outcome !== 'success') throw new Error('case resolve failed');
assert(resolveCaseParsed.caseId === resolveCaseId, 'resolved case must preserve case identifier');
assert(resolveCaseParsed.condition.clinicalStatus === 'resolved', 'resolved case must have resolved clinical status');
assert(resolveCaseParsed.condition.abatementDate === resolveAbatementDate, 'resolved case must persist abatement date');

const chartAfterResolve = await appRepository.getPatientDetailById('1442');
assert(chartAfterResolve, 'mock CEZIH chart must be readable after case resolve');
assert(
  chartAfterResolve.conditions.some(
    (condition) =>
      condition.caseId === resolveCaseId &&
      condition.icd10Code === 'R51' &&
      condition.clinicalStatus === 'resolved' &&
      condition.abatementDate === resolveAbatementDate,
  ),
  'resolved case must be persisted in mock CEZIH chart read path',
);

const resolveWithoutCaseIdRequest = buildResolveCaseMessage(
  {
    caseId: '',
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    abatementDate: resolveAbatementDate,
  },
  context,
);
const resolveWithoutCaseIdResponse = await mockClient.postMessage(resolveWithoutCaseIdRequest);
const resolveWithoutCaseIdParsed = parseCaseManagementResponse(
  resolveWithoutCaseIdRequest.id,
  resolveWithoutCaseIdResponse,
);
assert(resolveWithoutCaseIdParsed.outcome === 'error', 'case resolve without case ID must fail');

const resolveWithoutSubjectRequest = buildResolveCaseMessage(
  {
    caseId: resolveCaseId,
    patientMbo: '',
    practitionerHzjzId: '1234567',
    abatementDate: resolveAbatementDate,
  },
  context,
);
const resolveWithoutSubjectResponse = await mockClient.postMessage(resolveWithoutSubjectRequest);
const resolveWithoutSubjectParsed = parseCaseManagementResponse(
  resolveWithoutSubjectRequest.id,
  resolveWithoutSubjectResponse,
);
assert(resolveWithoutSubjectParsed.outcome === 'error', 'case resolve without subject MBO must fail');

const resolveWithoutAbatementRequest = buildResolveCaseMessage(
  {
    caseId: resolveCaseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    abatementDate: '',
  },
  context,
);
const resolveWithoutAbatementResponse = await mockClient.postMessage(resolveWithoutAbatementRequest);
const resolveWithoutAbatementParsed = parseCaseManagementResponse(
  resolveWithoutAbatementRequest.id,
  resolveWithoutAbatementResponse,
);
assert(resolveWithoutAbatementParsed.outcome === 'error', 'case resolve without abatementDateTime must fail');

const resolveAlreadyResolvedRequest = buildResolveCaseMessage(
  {
    caseId: previousResolvedCaseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    abatementDate: resolveAbatementDate,
  },
  context,
);
const resolveAlreadyResolvedResponse = await mockClient.postMessage(resolveAlreadyResolvedRequest);
const resolveAlreadyResolvedParsed = parseCaseManagementResponse(
  resolveAlreadyResolvedRequest.id,
  resolveAlreadyResolvedResponse,
);
assert(resolveAlreadyResolvedParsed.outcome === 'error', 'case resolve for already resolved case must fail');

const deleteCaseRequest = buildDeleteCaseMessage(
  {
    caseId: createCaseParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    reason: 'Validacijsko brisanje slučaja evidentiranog pogreškom.',
    note: 'Opća napomena uz validacijsko brisanje.',
  },
  context,
);

assert(messageEventCode(deleteCaseRequest) === CEZIH_DELETE_CASE_EVENT, 'case delete event must be 2.7');
assert(deleteCaseRequest.entry.length === 2, 'case delete bundle must have 2 entries');
const deleteConditionRequestEntry = deleteCaseRequest.entry[1].resource;
assert(deleteConditionRequestEntry.resourceType === 'Condition', 'case delete second entry must be Condition');
assert(deleteConditionRequestEntry.identifier?.[0]?.value === createCaseParsed.caseId, 'delete request must include service case identifier');
assert(!deleteConditionRequestEntry.clinicalStatus, 'case delete request must not include clinicalStatus');
assert(!deleteConditionRequestEntry.verificationStatus, 'case delete request must not include verificationStatus');
assert(!deleteConditionRequestEntry.code, 'case delete request must not include diagnosis code');
assert(!deleteConditionRequestEntry.encounter, 'case delete request must not include encounter');

const deleteCaseResponse = await mockClient.postMessage(deleteCaseRequest);
const deleteCaseParsed = parseCaseManagementResponse(deleteCaseRequest.id, deleteCaseResponse);
assert(deleteCaseParsed.outcome === 'success', 'mock delete case must succeed');
if (deleteCaseParsed.outcome !== 'success') throw new Error('case delete failed');
assert(deleteCaseParsed.caseId === createCaseParsed.caseId, 'deleted case must preserve case identifier');
assert(deleteCaseParsed.condition.clinicalStatus === 'deleted', 'deleted case must have deleted clinical status');

const chartAfterDelete = await appRepository.getPatientDetailById('1442');
assert(chartAfterDelete, 'mock CEZIH chart must be readable after case delete');
assert(
  chartAfterDelete.conditions.some(
    (condition) =>
      condition.caseId === createCaseParsed.caseId &&
      condition.icd10Code === 'R51' &&
      condition.clinicalStatus === 'deleted',
  ),
  'deleted case must be persisted in mock CEZIH chart read path',
);

const resolveDeletedCaseRequest = buildResolveCaseMessage(
  {
    caseId: createCaseParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    abatementDate: resolveAbatementDate,
  },
  context,
);
const resolveDeletedCaseResponse = await mockClient.postMessage(resolveDeletedCaseRequest);
const resolveDeletedCaseParsed = parseCaseManagementResponse(
  resolveDeletedCaseRequest.id,
  resolveDeletedCaseResponse,
);
assert(resolveDeletedCaseParsed.outcome === 'error', 'case resolve for deleted case must fail');

const updateDeletedCaseRequest = buildUpdateCaseMessage(
  {
    caseId: createCaseParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    clinicalStatus: 'deleted',
    verificationStatus: 'confirmed',
  },
  context,
);
const updateDeletedCaseResponse = await mockClient.postMessage(updateDeletedCaseRequest);
const updateDeletedCaseParsed = parseCaseManagementResponse(
  updateDeletedCaseRequest.id,
  updateDeletedCaseResponse,
);
assert(updateDeletedCaseParsed.outcome === 'error', 'case update for deleted case must fail');

const deleteWithoutReasonRequest = buildDeleteCaseMessage(
  {
    caseId: createCaseRecurrenceParsed.caseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    reason: '',
  },
  context,
);
const deleteWithoutReasonResponse = await mockClient.postMessage(deleteWithoutReasonRequest);
const deleteWithoutReasonParsed = parseCaseManagementResponse(
  deleteWithoutReasonRequest.id,
  deleteWithoutReasonResponse,
);
assert(
  deleteWithoutReasonParsed.outcome === 'error',
  'case delete without deletion reason must fail',
);

const linkedCaseId = `linked-case-${crypto.randomUUID()}`;
await appendMockCondition({
  resourceType: 'Condition',
  id: `mock-cond-${crypto.randomUUID()}`,
  identifier: [{ system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: linkedCaseId }],
  clinicalStatus: {
    coding: [{ system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM, code: 'active' }],
  },
  verificationStatus: {
    coding: [{ system: FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM, code: 'confirmed' }],
  },
  code: {
    coding: [
      {
        system: CEZIH_ICD10_HR_SYSTEM,
        code: 'R51',
        display: 'Glavobolja',
      },
    ],
    text: 'Glavobolja',
  },
  subject: {
    type: 'Patient',
    identifier: { system: CEZIH_MBO_SYSTEM, value: '180223069' },
  },
  onsetDateTime: new Date().toISOString().slice(0, 10),
  recordedDate: new Date().toISOString(),
  recorder: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
  asserter: {
    type: 'Practitioner',
    identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
  },
});
await appendMockEncounter({
  resourceType: 'Encounter',
  id: `mock-enc-linked-${crypto.randomUUID()}`,
  identifier: [
    {
      system: CEZIH_VISIT_SYSTEM,
      value: `visit-linked-${crypto.randomUUID()}`,
    },
  ],
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { type: 'Patient', identifier: { system: CEZIH_MBO_SYSTEM, value: '180223069' } },
  participant: [
    {
      individual: {
        type: 'Practitioner',
        identifier: { system: CEZIH_HZJZ_SYSTEM, value: '1234567' },
      },
    },
  ],
  period: { start: new Date().toISOString() },
  diagnosis: [
    {
      condition: {
        type: 'Condition',
        identifier: { system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: linkedCaseId },
      },
    },
  ],
});
const deleteLinkedCaseRequest = buildDeleteCaseMessage(
  {
    caseId: linkedCaseId,
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    reason: 'Pokušaj brisanja povezanog slučaja.',
  },
  context,
);
const deleteLinkedCaseResponse = await mockClient.postMessage(deleteLinkedCaseRequest);
const deleteLinkedCaseParsed = parseCaseManagementResponse(
  deleteLinkedCaseRequest.id,
  deleteLinkedCaseResponse,
);
assert(
  deleteLinkedCaseParsed.outcome === 'error',
  'case delete with Encounter.diagnosis reference must fail',
);

const invalidCaseRequest = buildCreateCaseMessage(
  {
    patientMbo: '180223069',
    practitionerHzjzId: '1234567',
    encounterVisitId: 'missing-visit-id',
    onsetDate: new Date().toISOString().slice(0, 10),
    diagnosisCode: 'R51',
    diagnosisDisplay: 'Glavobolja',
    verificationStatus: 'unconfirmed',
  },
  context,
);
const invalidCaseResponse = await mockClient.postMessage(invalidCaseRequest);
const invalidCaseParsed = parseCaseManagementResponse(invalidCaseRequest.id, invalidCaseResponse);
assert(
  invalidCaseParsed.outcome === 'error',
  'case create without existing open encounter must fail',
);

console.log('Case message validation passed.');
