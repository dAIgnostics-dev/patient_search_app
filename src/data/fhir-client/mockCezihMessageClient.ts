import type { FhirCondition, FhirEncounter, FhirMessageBundle } from '../../fhir/types';
import {
  CEZIH_CANCEL_ENCOUNTER_EVENT,
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_CASE_RESPONSE_EVENT,
  CEZIH_CLOSE_ENCOUNTER_EVENT,
  CEZIH_CREATE_CASE_EVENT,
  CEZIH_CREATE_CASE_RECURRENCE_EVENT,
  CEZIH_CREATE_ENCOUNTER_EVENT,
  CEZIH_DELETE_CASE_EVENT,
  CEZIH_EHE_MESSAGE_TYPES,
  CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM,
  CEZIH_LOCAL_VISIT_ID_SYSTEM,
  CEZIH_REMISSION_CASE_EVENT,
  CEZIH_RELAPSE_CASE_EVENT,
  CEZIH_RESOLVE_CASE_EVENT,
  CEZIH_REOPEN_ENCOUNTER_EVENT,
  CEZIH_SLUCAJ_SYSTEM,
  CEZIH_UPDATE_ENCOUNTER_EVENT,
  CEZIH_VISIT_SYSTEM,
  FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
} from '../../fhir/types';
import { findIdentifier } from '../../mappers/fhir-utils';
import {
  appendMockCondition,
  appendMockEncounter,
  findMockConditionByCaseId,
  findMockEncounterByVisitId,
  getMockEncounters,
  mockConditionIdExists,
  mockEncounterIdExists,
  updateMockConditionByCaseId,
  updateMockEncounterByVisitId,
} from './mockCezihClient';
import type { CezihMessageClient } from './cezihMessageClient';

const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

function newUuid(): string {
  return crypto.randomUUID();
}

function generateVisitId(): string {
  const suffix = Math.random().toString(36).slice(2, 14);
  return `cl${suffix}`;
}

function generateEncounterId(): string {
  return `mock-enc-${newUuid()}`;
}

function generateConditionId(): string {
  return `mock-cond-${newUuid()}`;
}

function generateCaseId(): string {
  return newUuid();
}

async function generateUniqueVisitId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const visitId = generateVisitId();
    if (!(await findMockEncounterByVisitId(visitId))) return visitId;
  }
  return `cl${newUuid().replace(/-/g, '').slice(0, 12)}`;
}

async function generateUniqueEncounterId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const encounterId = generateEncounterId();
    if (!(await mockEncounterIdExists(encounterId))) return encounterId;
  }
  return `mock-enc-${Date.now()}-${newUuid()}`;
}

async function generateUniqueConditionId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const conditionId = generateConditionId();
    if (!(await mockConditionIdExists(conditionId))) return conditionId;
  }
  return `mock-cond-${Date.now()}-${newUuid()}`;
}

async function generateUniqueCaseId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const caseId = generateCaseId();
    if (!(await findMockConditionByCaseId(caseId))) return caseId;
  }
  return `${Date.now()}-${newUuid()}`;
}

function findRequestEncounter(bundle: FhirMessageBundle): FhirEncounter | null {
  const resource = bundle.entry.find((entry) => entry.resource.resourceType === 'Encounter')
    ?.resource;
  return resource?.resourceType === 'Encounter' ? resource : null;
}

function findRequestCondition(bundle: FhirMessageBundle): FhirCondition | null {
  const resource = bundle.entry.find((entry) => entry.resource.resourceType === 'Condition')
    ?.resource;
  return resource?.resourceType === 'Condition' ? resource : null;
}

function findMessageHeader(bundle: FhirMessageBundle) {
  const resource = bundle.entry.find((entry) => entry.resource.resourceType === 'MessageHeader')
    ?.resource;
  return resource?.resourceType === 'MessageHeader' ? resource : null;
}

function getVisitId(encounter: FhirEncounter): string | null {
  return findIdentifier(encounter.identifier, CEZIH_VISIT_SYSTEM) ?? null;
}

function getConditionEncounterVisitId(condition: FhirCondition): string | null {
  return condition.encounter?.identifier?.system === CEZIH_VISIT_SYSTEM
    ? condition.encounter.identifier.value ?? null
    : null;
}

function getCaseId(condition: FhirCondition): string | null {
  return (
    findIdentifier(condition.identifier, CEZIH_CASE_IDENTIFIER_SYSTEM) ??
    findIdentifier(condition.identifier, CEZIH_SLUCAJ_SYSTEM) ??
    null
  );
}

function noteHasAnnotationCode(condition: FhirCondition, code: string): boolean {
  return (
    condition.note?.some((note) =>
      note.extension?.some(
        (extension) =>
          extension.url.includes('hr-annotation-type') &&
          extension.valueCoding?.system === 'http://fhir.cezih.hr/specifikacije/CodeSystem/annotation-type' &&
          extension.valueCoding.code === code &&
          Boolean(note.text?.trim()),
      ),
    ) ?? false
  );
}

function encounterReferencesCase(encounter: FhirEncounter, caseId: string): boolean {
  return (
    encounter.diagnosis?.some(
      (diagnosis) => diagnosis.condition?.identifier?.value === caseId,
    ) ?? false
  );
}

function conditionClinicalStatusCode(condition: FhirCondition): string {
  return (condition.clinicalStatus?.coding?.[0]?.code ?? '').toLowerCase();
}

function participantHzjzIds(encounter: FhirEncounter): string[] {
  return (
    encounter.participant
      ?.map((participant) => participant.individual?.identifier?.value)
      .filter((value): value is string => Boolean(value)) ?? []
  );
}

function hasActiveLinkedEncounterData(encounter: FhirEncounter): boolean {
  return Boolean(encounter.diagnosis?.length);
}

function getReopenWindowReferenceTime(encounter: FhirEncounter): string | null {
  return encounter.period?.end ?? encounter.period?.start ?? null;
}

function isWithinReopenWindow(encounter: FhirEncounter): boolean {
  const referenceTime = getReopenWindowReferenceTime(encounter);
  if (!referenceTime) return false;
  const referenceMs = Date.parse(referenceTime);
  if (Number.isNaN(referenceMs)) return false;
  return Date.now() - referenceMs <= REOPEN_WINDOW_MS;
}

function validateCommonEncounterFields(
  encounter: FhirEncounter,
  headerAuthorHzjz: string | undefined,
): string | null {
  if (encounter.status !== 'in-progress') return 'Encounter status must be in-progress.';
  if (!encounter.class?.code) return 'Encounter class is required.';
  if (!encounter.subject?.identifier?.value) return 'Encounter subject (patient MBO) is required.';
  if (!encounter.participant?.length) return 'Encounter participant is required.';
  if (!encounter.period?.start) return 'Encounter period.start is required.';
  if (!encounter.serviceProvider?.identifier?.value) {
    return 'Encounter serviceProvider is required.';
  }

  if (headerAuthorHzjz) {
    const participantHzjzIds =
      encounter.participant
        ?.map((p) => p.individual?.identifier?.value)
        .filter((value): value is string => Boolean(value)) ?? [];
    if (!participantHzjzIds.includes(headerAuthorHzjz)) {
      return 'Encounter participants must include MessageHeader author.';
    }
  }

  return null;
}

function validateCreateRequest(bundle: FhirMessageBundle): string | null {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Create encounter message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_CREATE_ENCOUNTER_EVENT
  ) {
    return 'MessageHeader event must be create encounter (1.1).';
  }

  const encounter = findRequestEncounter(bundle);
  if (!encounter) return 'Encounter entry is required.';

  const hasServiceVisitId = Boolean(getVisitId(encounter));
  if (hasServiceVisitId) {
    return 'Create encounter must not include service visit identifier.';
  }

  return validateCommonEncounterFields(encounter, header.author?.identifier?.value);
}

async function validateCreateCaseRequest(
  bundle: FhirMessageBundle,
  options: { eventCode: string; label: string },
): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return `${options.label} message must contain exactly 2 entries.`;

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== options.eventCode
  ) {
    return `MessageHeader event must be ${options.label} (${options.eventCode}).`;
  }

  const condition = findRequestCondition(bundle);
  if (!condition) return 'Condition entry is required.';

  const hasServiceCaseId = condition.identifier?.some(
    (id) => id.system === CEZIH_CASE_IDENTIFIER_SYSTEM || id.system === CEZIH_SLUCAJ_SYSTEM,
  );
  if (hasServiceCaseId) {
    return 'Create case must not include service case identifier.';
  }
  if (condition.clinicalStatus) {
    return 'Create case must not include clinicalStatus.';
  }
  if (!condition.verificationStatus?.coding?.[0]?.code) {
    return 'Condition verificationStatus is required.';
  }
  if (!condition.code?.coding?.[0]?.code) {
    return 'Condition diagnosis code is required.';
  }
  if (!condition.subject?.identifier?.value) {
    return 'Condition subject (patient MBO) is required.';
  }
  if (!condition.onsetDateTime) {
    return 'Condition onsetDateTime is required.';
  }
  if (condition.abatementDateTime) {
    return 'Create case must not include abatementDateTime.';
  }
  if (condition.recordedDate) {
    return 'Create case must not include recordedDate.';
  }
  if (condition.recorder) {
    return 'Create case must not include recorder.';
  }
  if (!condition.asserter?.identifier?.value) {
    return 'Condition asserter is required.';
  }

  const headerAuthorHzjz = header.author?.identifier?.value;
  if (headerAuthorHzjz && condition.asserter.identifier.value !== headerAuthorHzjz) {
    return 'Condition asserter must match MessageHeader author.';
  }

  const encounterVisitId = getConditionEncounterVisitId(condition);
  if (!encounterVisitId) return 'Condition encounter visit identifier is required.';

  const existingEncounter = await findMockEncounterByVisitId(encounterVisitId);
  if (!existingEncounter) {
    return `Encounter with visit identifier ${encounterVisitId} was not found.`;
  }
  if ((existingEncounter.status ?? '').toLowerCase() !== 'in-progress') {
    return 'Case can be created only for an in-progress encounter.';
  }
  if (existingEncounter.subject?.identifier?.value !== condition.subject.identifier.value) {
    return 'Condition subject must match encounter patient.';
  }
  if (headerAuthorHzjz && !participantHzjzIds(existingEncounter).includes(headerAuthorHzjz)) {
    return 'Case can be created only for an encounter of the MessageHeader author.';
  }

  return null;
}

async function validateDeleteCaseRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Delete case message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_DELETE_CASE_EVENT
  ) {
    return 'MessageHeader event must be delete case (2.7).';
  }

  const condition = findRequestCondition(bundle);
  if (!condition) return 'Condition entry is required.';

  const caseId = getCaseId(condition);
  if (!caseId) return 'Delete case requires service case identifier.';
  const hasLocalIdentifier = condition.identifier?.some(
    (id) => id.system === 'http://fhir.cezih.hr/specifikacije/identifikatori/lokalni-identifikator-slucaja',
  );
  if (hasLocalIdentifier) return 'Delete case must not include local case identifier.';
  if (!condition.subject?.identifier?.value) {
    return 'Condition subject (patient MBO) is required.';
  }
  if (condition.clinicalStatus) return 'Delete case must not include clinicalStatus.';
  if (condition.verificationStatus) return 'Delete case must not include verificationStatus.';
  if (condition.code) return 'Delete case must not include code.';
  if (condition.encounter) return 'Delete case must not include encounter.';
  if (condition.onsetDateTime) return 'Delete case must not include onsetDateTime.';
  if (condition.abatementDateTime) return 'Delete case must not include abatementDateTime.';
  if (condition.recordedDate) return 'Delete case must not include recordedDate.';
  if (condition.recorder) return 'Delete case must not include recorder.';
  if (condition.asserter) return 'Delete case must not include asserter.';
  if (!noteHasAnnotationCode(condition, '1')) {
    return 'Delete case requires deletion reason note.';
  }

  const existing = await findMockConditionByCaseId(caseId);
  if (!existing) return `Case with identifier ${caseId} was not found.`;
  if ((existing.clinicalStatus?.coding?.[0]?.code ?? '').toLowerCase() === 'deleted') {
    return 'Case is already deleted.';
  }
  if (existing.subject?.identifier?.value !== condition.subject.identifier.value) {
    return 'Delete case subject must match existing case patient.';
  }
  const encounters = await getMockEncounters();
  if (encounters.some((encounter) => encounterReferencesCase(encounter, caseId))) {
    return 'Case with active linked encounter data cannot be deleted.';
  }

  return null;
}

async function validateRelapseCaseRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Relapse case message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_RELAPSE_CASE_EVENT
  ) {
    return 'MessageHeader event must be relapse case (2.5).';
  }

  const condition = findRequestCondition(bundle);
  if (!condition) return 'Condition entry is required.';

  const caseId = getCaseId(condition);
  if (!caseId) return 'Relapse case requires service case identifier.';
  const hasLocalIdentifier = condition.identifier?.some(
    (id) => id.system === 'http://fhir.cezih.hr/specifikacije/identifikatori/lokalni-identifikator-slucaja',
  );
  if (hasLocalIdentifier) return 'Relapse case must not include local case identifier.';
  if (!condition.subject?.identifier?.value) {
    return 'Condition subject (patient MBO) is required.';
  }
  if (condition.clinicalStatus) return 'Relapse case must not include clinicalStatus.';
  if (condition.verificationStatus) return 'Relapse case must not include verificationStatus.';
  if ((condition as { category?: unknown }).category) return 'Relapse case must not include category.';
  if ((condition as { severity?: unknown }).severity) return 'Relapse case must not include severity.';
  if (condition.code) return 'Relapse case must not include code.';
  if ((condition as { bodySite?: unknown }).bodySite) return 'Relapse case must not include bodySite.';
  if (condition.encounter) return 'Relapse case must not include encounter.';
  if (condition.onsetDateTime) return 'Relapse case must not include onsetDateTime.';
  if (condition.abatementDateTime) return 'Relapse case must not include abatementDateTime.';
  if (condition.recordedDate) return 'Relapse case must not include recordedDate.';
  if (condition.recorder) return 'Relapse case must not include recorder.';
  if (condition.asserter) return 'Relapse case must not include asserter.';
  if (condition.note?.length) return 'Relapse case must not include note.';

  const existing = await findMockConditionByCaseId(caseId);
  if (!existing) return `Case with identifier ${caseId} was not found.`;
  if (existing.subject?.identifier?.value !== condition.subject.identifier.value) {
    return 'Relapse case subject must match existing case patient.';
  }
  const currentStatus = conditionClinicalStatusCode(existing);
  if (currentStatus === 'deleted') return 'Deleted case cannot be changed to relapse.';
  if (currentStatus !== 'remission') return 'Only remission cases can be changed to relapse.';

  return null;
}

async function validateRemissionCaseRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Remission case message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_REMISSION_CASE_EVENT
  ) {
    return 'MessageHeader event must be remission case (2.3).';
  }

  const condition = findRequestCondition(bundle);
  if (!condition) return 'Condition entry is required.';

  const caseId = getCaseId(condition);
  if (!caseId) return 'Remission case requires service case identifier.';
  const hasLocalIdentifier = condition.identifier?.some(
    (id) => id.system === 'http://fhir.cezih.hr/specifikacije/identifikatori/lokalni-identifikator-slucaja',
  );
  if (hasLocalIdentifier) return 'Remission case must not include local case identifier.';
  if (!condition.subject?.identifier?.value) {
    return 'Condition subject (patient MBO) is required.';
  }
  if (condition.clinicalStatus) return 'Remission case must not include clinicalStatus.';
  if (condition.verificationStatus) return 'Remission case must not include verificationStatus.';
  if ((condition as { category?: unknown }).category) return 'Remission case must not include category.';
  if ((condition as { severity?: unknown }).severity) return 'Remission case must not include severity.';
  if (condition.code) return 'Remission case must not include code.';
  if ((condition as { bodySite?: unknown }).bodySite) return 'Remission case must not include bodySite.';
  if (condition.encounter) return 'Remission case must not include encounter.';
  if (condition.onsetDateTime) return 'Remission case must not include onsetDateTime.';
  if (condition.abatementDateTime) return 'Remission case must not include abatementDateTime.';
  if (condition.recordedDate) return 'Remission case must not include recordedDate.';
  if (condition.recorder) return 'Remission case must not include recorder.';
  if (condition.asserter) return 'Remission case must not include asserter.';
  if (condition.note?.length) return 'Remission case must not include note.';

  const existing = await findMockConditionByCaseId(caseId);
  if (!existing) return `Case with identifier ${caseId} was not found.`;
  if (existing.subject?.identifier?.value !== condition.subject.identifier.value) {
    return 'Remission case subject must match existing case patient.';
  }
  const currentStatus = conditionClinicalStatusCode(existing);
  if (currentStatus === 'deleted') return 'Deleted case cannot be changed to remission.';
  if (currentStatus === 'resolved') return 'Resolved case cannot be changed to remission.';
  if (currentStatus !== 'active' && currentStatus !== 'relapse') {
    return 'Only active or relapse cases can be changed to remission.';
  }

  return null;
}

async function validateResolveCaseRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Resolve case message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_RESOLVE_CASE_EVENT
  ) {
    return 'MessageHeader event must be resolve case (2.4).';
  }

  const condition = findRequestCondition(bundle);
  if (!condition) return 'Condition entry is required.';

  const caseId = getCaseId(condition);
  if (!caseId) return 'Resolve case requires service case identifier.';
  const hasLocalIdentifier = condition.identifier?.some(
    (id) => id.system === 'http://fhir.cezih.hr/specifikacije/identifikatori/lokalni-identifikator-slucaja',
  );
  if (hasLocalIdentifier) return 'Resolve case must not include local case identifier.';
  if (conditionClinicalStatusCode(condition) !== 'resolved') {
    return 'Resolve case request must include clinicalStatus resolved.';
  }
  if (!condition.subject?.identifier?.value) {
    return 'Condition subject (patient MBO) is required.';
  }
  if (!condition.abatementDateTime) return 'Resolve case requires abatementDateTime.';
  if (condition.verificationStatus) return 'Resolve case must not include verificationStatus.';
  if ((condition as { category?: unknown }).category) return 'Resolve case must not include category.';
  if ((condition as { severity?: unknown }).severity) return 'Resolve case must not include severity.';
  if (condition.code) return 'Resolve case must not include code.';
  if ((condition as { bodySite?: unknown }).bodySite) return 'Resolve case must not include bodySite.';
  if (condition.encounter) return 'Resolve case must not include encounter.';
  if (condition.onsetDateTime) return 'Resolve case must not include onsetDateTime.';
  if (condition.recordedDate) return 'Resolve case must not include recordedDate.';
  if (condition.recorder) return 'Resolve case must not include recorder.';
  if (condition.asserter) return 'Resolve case must not include asserter.';
  if (condition.note?.length) return 'Resolve case must not include note.';

  const existing = await findMockConditionByCaseId(caseId);
  if (!existing) return `Case with identifier ${caseId} was not found.`;
  if (existing.subject?.identifier?.value !== condition.subject.identifier.value) {
    return 'Resolve case subject must match existing case patient.';
  }
  const currentStatus = conditionClinicalStatusCode(existing);
  if (currentStatus === 'deleted') return 'Deleted case cannot be resolved.';
  if (currentStatus === 'resolved') return 'Case is already resolved.';
  if (currentStatus !== 'active' && currentStatus !== 'relapse' && currentStatus !== 'remission') {
    return 'Only active, relapse, or remission cases can be resolved.';
  }

  return null;
}

async function validateUpdateCaseRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Update case message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_CASE_RESPONSE_EVENT
  ) {
    return 'MessageHeader event must be update case (2.6).';
  }

  const condition = findRequestCondition(bundle);
  if (!condition) return 'Condition entry is required.';

  const caseId = getCaseId(condition);
  if (!caseId) return 'Update case requires service case identifier.';
  if (!condition.subject?.identifier?.value) {
    return 'Condition subject (patient MBO) is required.';
  }
  const requestedStatus = conditionClinicalStatusCode(condition);
  if (!requestedStatus) {
    return 'Update case request must include current clinicalStatus.';
  }
  if ((condition as { category?: unknown }).category) return 'Update case must not include category.';
  if (condition.recordedDate) return 'Update case must not include recordedDate.';
  if (condition.recorder) return 'Update case must not include recorder.';

  const existing = await findMockConditionByCaseId(caseId);
  if (!existing) return `Case with identifier ${caseId} was not found.`;
  if (existing.subject?.identifier?.value !== condition.subject.identifier.value) {
    return 'Update case subject must match existing case patient.';
  }
  const currentStatus = conditionClinicalStatusCode(existing);
  if (currentStatus === 'deleted') return 'Deleted case cannot be updated.';
  if (requestedStatus !== currentStatus) {
    return 'Clinical status cannot be changed through case update.';
  }
  if (condition.abatementDateTime && currentStatus !== 'resolved' && currentStatus !== 'remission') {
    return 'Abatement date can be updated only for resolved or remission cases.';
  }
  if (condition.code && !condition.code.coding?.[0]?.code) {
    return 'Update case diagnosis code is invalid.';
  }

  return null;
}

async function validateUpdateRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Update encounter message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_UPDATE_ENCOUNTER_EVENT
  ) {
    return 'MessageHeader event must be update encounter (1.2).';
  }

  const encounter = findRequestEncounter(bundle);
  if (!encounter) return 'Encounter entry is required.';

  const visitId = getVisitId(encounter);
  if (!visitId) return 'Update encounter requires service visit identifier.';

  const commonError = validateCommonEncounterFields(encounter, header.author?.identifier?.value);
  if (commonError) return commonError;

  if (!(await findMockEncounterByVisitId(visitId))) {
    return `Encounter with visit identifier ${visitId} was not found.`;
  }

  return null;
}

async function validateCloseRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Close encounter message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_CLOSE_ENCOUNTER_EVENT
  ) {
    return 'MessageHeader event must be close encounter (1.3).';
  }

  const encounter = findRequestEncounter(bundle);
  if (!encounter) return 'Encounter entry is required.';

  if (encounter.status !== 'finished') {
    return 'Close encounter request must have status finished.';
  }

  const visitId = getVisitId(encounter);
  if (!visitId) return 'Close encounter requires service visit identifier.';

  const hasLocalIdentifier = encounter.identifier?.some(
    (id) => id.system === CEZIH_LOCAL_VISIT_ID_SYSTEM,
  );
  if (hasLocalIdentifier) {
    return 'Close encounter must not include local visit identifier.';
  }

  if (!encounter.period?.start) return 'Encounter period.start is required.';
  if (!encounter.period?.end) return 'Encounter period.end is required.';
  if (!encounter.class?.code) return 'Encounter class is required.';
  if (!encounter.serviceProvider?.identifier?.value) {
    return 'Encounter serviceProvider is required.';
  }

  const existing = await findMockEncounterByVisitId(visitId);
  if (!existing) {
    return `Encounter with visit identifier ${visitId} was not found.`;
  }
  if (existing.status !== 'in-progress') {
    return 'Only in-progress encounters can be closed.';
  }

  return null;
}

async function validateCancelRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Cancel encounter message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_CANCEL_ENCOUNTER_EVENT
  ) {
    return 'MessageHeader event must be cancel encounter (1.4).';
  }

  const encounter = findRequestEncounter(bundle);
  if (!encounter) return 'Encounter entry is required.';

  if (encounter.status !== 'entered-in-error') {
    return 'Cancel encounter request must have status entered-in-error.';
  }

  const visitId = getVisitId(encounter);
  if (!visitId) return 'Cancel encounter requires service visit identifier.';

  const hasLocalIdentifier = encounter.identifier?.some(
    (id) => id.system === CEZIH_LOCAL_VISIT_ID_SYSTEM,
  );
  if (hasLocalIdentifier) {
    return 'Cancel encounter must not include local visit identifier.';
  }

  if (!encounter.period?.start) return 'Encounter period.start is required.';
  if (!encounter.period?.end) return 'Encounter period.end is required.';
  if (!encounter.class?.code) return 'Encounter class is required.';
  if (!encounter.serviceProvider?.identifier?.value) {
    return 'Encounter serviceProvider is required.';
  }

  const existing = await findMockEncounterByVisitId(visitId);
  if (!existing) {
    return `Encounter with visit identifier ${visitId} was not found.`;
  }
  if (existing.status === 'entered-in-error') {
    return 'Encounter is already cancelled.';
  }
  const existingStatus = (existing.status ?? '').toLowerCase();
  if (existingStatus !== 'in-progress' && existingStatus !== 'finished') {
    return 'Only in-progress or finished encounters can be cancelled.';
  }
  if (hasActiveLinkedEncounterData(existing) || hasActiveLinkedEncounterData(encounter)) {
    return 'Encounter with active linked clinical data cannot be cancelled.';
  }

  return null;
}

async function validateReopenRequest(bundle: FhirMessageBundle): Promise<string | null> {
  if (bundle.type !== 'message') return 'Bundle type must be message.';
  if (bundle.entry.length !== 2) return 'Reopen encounter message must contain exactly 2 entries.';

  const header = findMessageHeader(bundle);
  if (!header) return 'MessageHeader entry is required.';
  if (
    header.eventCoding?.system !== CEZIH_EHE_MESSAGE_TYPES ||
    header.eventCoding?.code !== CEZIH_REOPEN_ENCOUNTER_EVENT
  ) {
    return 'MessageHeader event must be reopen encounter (1.5).';
  }

  const encounter = findRequestEncounter(bundle);
  if (!encounter) return 'Encounter entry is required.';

  if (encounter.status !== 'in-progress') {
    return 'Reopen encounter request must have status in-progress.';
  }

  const visitId = getVisitId(encounter);
  if (!visitId) return 'Reopen encounter requires service visit identifier.';

  const hasLocalIdentifier = encounter.identifier?.some(
    (id) => id.system === CEZIH_LOCAL_VISIT_ID_SYSTEM,
  );
  if (hasLocalIdentifier) {
    return 'Reopen encounter must not include local visit identifier.';
  }

  if (!encounter.class?.code) return 'Encounter class is required.';
  if (!encounter.serviceProvider?.identifier?.value) {
    return 'Encounter serviceProvider is required.';
  }

  const existing = await findMockEncounterByVisitId(visitId);
  if (!existing) {
    return `Encounter with visit identifier ${visitId} was not found.`;
  }
  const existingStatus = (existing.status ?? '').toLowerCase();
  if (existingStatus !== 'finished' && existingStatus !== 'entered-in-error') {
    return 'Only finished or cancelled encounters can be reopened.';
  }
  if (!isWithinReopenWindow(existing)) {
    return 'Encounter can be reopened only within 24 hours of close or cancel.';
  }

  return null;
}

function buildErrorResponse(
  requestBundleId: string,
  eventCode: string,
  diagnostics: string,
): FhirMessageBundle {
  const outcomeId = newUuid();
  return {
    resourceType: 'Bundle',
    id: newUuid(),
    type: 'message',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${newUuid()}`,
        resource: {
          resourceType: 'MessageHeader',
          eventCoding: {
            system: CEZIH_EHE_MESSAGE_TYPES,
            code: eventCode,
          },
          source: { endpoint: 'urn:oid:1.2.3.4.5.1' },
          response: {
            identifier: requestBundleId,
            code: 'fatal-error',
            details: { reference: `urn:uuid:${outcomeId}` },
          },
          focus: [{ reference: `urn:uuid:${outcomeId}` }],
        },
      },
      {
        fullUrl: `urn:uuid:${outcomeId}`,
        resource: {
          resourceType: 'OperationOutcome',
          issue: [
            {
              severity: 'fatal',
              code: 'required',
              details: {
                coding: [{ system: 'http://ent.hr/fhir/CodeSystem/message-error-type', code: '1' }],
              },
              diagnostics,
            },
          ],
        },
      },
    ],
  };
}

function buildSuccessResponse(
  requestBundleId: string,
  eventCode: string,
  persisted: FhirEncounter | FhirCondition,
): FhirMessageBundle {
  const resourceId = persisted.id ?? `mock-${persisted.resourceType.toLowerCase()}-unknown`;
  const resourceUrl = `http://fhir.cezih.hr/fhir/${persisted.resourceType}/${resourceId}`;

  return {
    resourceType: 'Bundle',
    id: newUuid(),
    type: 'message',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${newUuid()}`,
        resource: {
          resourceType: 'MessageHeader',
          eventCoding: {
            system: CEZIH_EHE_MESSAGE_TYPES,
            code: eventCode,
          },
          source: { endpoint: 'urn:oid:1.2.3.4.5.1' },
          response: {
            identifier: requestBundleId,
            code: 'ok',
          },
          focus: [{ reference: resourceUrl }],
        },
      },
      {
        fullUrl: resourceUrl,
        resource: persisted,
      },
    ],
  };
}

async function handleCreate(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = validateCreateRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_CREATE_ENCOUNTER_EVENT, validationError);
  }

  const requestEncounter = findRequestEncounter(bundle)!;
  const encounterId = await generateUniqueEncounterId();
  const visitId = await generateUniqueVisitId();

  const persisted: FhirEncounter = {
    ...requestEncounter,
    id: encounterId,
    identifier: [
      ...(requestEncounter.identifier ?? []),
      { system: CEZIH_VISIT_SYSTEM, value: visitId },
    ],
  };

  await appendMockEncounter(persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CREATE_ENCOUNTER_EVENT, persisted);
}

async function handleCreateCase(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateCreateCaseRequest(bundle, {
    eventCode: CEZIH_CREATE_CASE_EVENT,
    label: 'create case',
  });
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_CREATE_CASE_EVENT, validationError);
  }

  const requestCondition = findRequestCondition(bundle)!;
  const conditionId = await generateUniqueConditionId();
  const caseId = await generateUniqueCaseId();
  const recordedDate = new Date().toISOString().slice(0, 10);
  const recorder = findMessageHeader(bundle)?.author ?? requestCondition.asserter;

  const persisted: FhirCondition = {
    ...requestCondition,
    id: conditionId,
    identifier: [
      ...(requestCondition.identifier ?? []).filter(
        (id) => id.system !== CEZIH_CASE_IDENTIFIER_SYSTEM && id.system !== CEZIH_SLUCAJ_SYSTEM,
      ),
      { system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: caseId },
    ],
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: 'active',
        },
      ],
    },
    recordedDate,
    recorder,
  };

  await appendMockCondition(persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, persisted);
}

async function handleCreateCaseRecurrence(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateCreateCaseRequest(bundle, {
    eventCode: CEZIH_CREATE_CASE_RECURRENCE_EVENT,
    label: 'create case recurrence',
  });
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_CREATE_CASE_RECURRENCE_EVENT, validationError);
  }

  const requestCondition = findRequestCondition(bundle)!;
  const conditionId = await generateUniqueConditionId();
  const caseId = await generateUniqueCaseId();
  const recordedDate = new Date().toISOString().slice(0, 10);
  const recorder = findMessageHeader(bundle)?.author ?? requestCondition.asserter;

  const persisted: FhirCondition = {
    ...requestCondition,
    id: conditionId,
    identifier: [
      ...(requestCondition.identifier ?? []).filter(
        (id) => id.system !== CEZIH_CASE_IDENTIFIER_SYSTEM && id.system !== CEZIH_SLUCAJ_SYSTEM,
      ),
      { system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: caseId },
    ],
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: 'active',
        },
      ],
    },
    recordedDate,
    recorder,
  };

  await appendMockCondition(persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, persisted);
}

async function handleDeleteCase(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateDeleteCaseRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_DELETE_CASE_EVENT, validationError);
  }

  const requestCondition = findRequestCondition(bundle)!;
  const caseId = getCaseId(requestCondition)!;
  const existing = (await findMockConditionByCaseId(caseId))!;
  const requestNotes = requestCondition.note ?? [];

  const persisted: FhirCondition = {
    ...existing,
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: 'deleted',
        },
      ],
    },
    note: [...(existing.note ?? []), ...requestNotes],
  };

  await updateMockConditionByCaseId(caseId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, persisted);
}

async function handleRelapseCase(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateRelapseCaseRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_RELAPSE_CASE_EVENT, validationError);
  }

  const requestCondition = findRequestCondition(bundle)!;
  const caseId = getCaseId(requestCondition)!;
  const existing = (await findMockConditionByCaseId(caseId))!;

  const persisted: FhirCondition = {
    ...existing,
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: 'relapse',
        },
      ],
    },
  };

  await updateMockConditionByCaseId(caseId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, persisted);
}

async function handleRemissionCase(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateRemissionCaseRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_REMISSION_CASE_EVENT, validationError);
  }

  const requestCondition = findRequestCondition(bundle)!;
  const caseId = getCaseId(requestCondition)!;
  const existing = (await findMockConditionByCaseId(caseId))!;

  const persisted: FhirCondition = {
    ...existing,
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: 'remission',
        },
      ],
    },
  };

  await updateMockConditionByCaseId(caseId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, persisted);
}

async function handleResolveCase(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateResolveCaseRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_RESOLVE_CASE_EVENT, validationError);
  }

  const requestCondition = findRequestCondition(bundle)!;
  const caseId = getCaseId(requestCondition)!;
  const existing = (await findMockConditionByCaseId(caseId))!;

  const persisted: FhirCondition = {
    ...existing,
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: 'resolved',
        },
      ],
    },
    abatementDateTime: requestCondition.abatementDateTime,
  };

  await updateMockConditionByCaseId(caseId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, persisted);
}

async function handleUpdateCase(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateUpdateCaseRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, validationError);
  }

  const requestCondition = findRequestCondition(bundle)!;
  const caseId = getCaseId(requestCondition)!;
  const existing = (await findMockConditionByCaseId(caseId))!;
  const requestLocalIdentifiers =
    requestCondition.identifier?.filter((id) => id.system === CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM) ?? [];
  const preservedIdentifiers =
    existing.identifier?.filter(
      (id) =>
        id.system !== CEZIH_CASE_IDENTIFIER_SYSTEM &&
        id.system !== CEZIH_SLUCAJ_SYSTEM &&
        id.system !== CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM,
    ) ?? [];
  const existingLocalIdentifiers =
    existing.identifier?.filter((id) => id.system === CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM) ?? [];

  const persisted: FhirCondition = {
    ...existing,
    identifier: [
      ...preservedIdentifiers,
      ...(requestLocalIdentifiers.length > 0 ? requestLocalIdentifiers : existingLocalIdentifiers),
      { system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: caseId },
    ],
    clinicalStatus: existing.clinicalStatus,
    verificationStatus: requestCondition.verificationStatus ?? existing.verificationStatus,
    code: requestCondition.code ?? existing.code,
    onsetDateTime: requestCondition.onsetDateTime ?? existing.onsetDateTime,
    abatementDateTime: requestCondition.abatementDateTime ?? existing.abatementDateTime,
    asserter: requestCondition.asserter ?? existing.asserter,
    note: requestCondition.note ?? existing.note,
    recordedDate: existing.recordedDate,
    recorder: existing.recorder,
  };

  await updateMockConditionByCaseId(caseId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CASE_RESPONSE_EVENT, persisted);
}

async function handleUpdate(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateUpdateRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_UPDATE_ENCOUNTER_EVENT, validationError);
  }

  const requestEncounter = findRequestEncounter(bundle)!;
  const visitId = getVisitId(requestEncounter)!;
  const existing = (await findMockEncounterByVisitId(visitId))!;

  const persisted: FhirEncounter = {
    ...requestEncounter,
    id: existing.id,
    identifier: [
      ...(requestEncounter.identifier ?? []).filter((id) => id.system !== CEZIH_VISIT_SYSTEM),
      { system: CEZIH_VISIT_SYSTEM, value: visitId },
    ],
  };

  await updateMockEncounterByVisitId(visitId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_UPDATE_ENCOUNTER_EVENT, persisted);
}

async function handleClose(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateCloseRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_CLOSE_ENCOUNTER_EVENT, validationError);
  }

  const requestEncounter = findRequestEncounter(bundle)!;
  const visitId = getVisitId(requestEncounter)!;
  const existing = (await findMockEncounterByVisitId(visitId))!;

  const persisted: FhirEncounter = {
    ...existing,
    status: 'finished',
    class: requestEncounter.class ?? existing.class,
    period: {
      start: requestEncounter.period?.start ?? existing.period?.start,
      end: requestEncounter.period?.end,
    },
    serviceProvider: requestEncounter.serviceProvider ?? existing.serviceProvider,
    diagnosis: requestEncounter.diagnosis ?? existing.diagnosis,
    identifier: [{ system: CEZIH_VISIT_SYSTEM, value: visitId }],
  };

  await updateMockEncounterByVisitId(visitId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CLOSE_ENCOUNTER_EVENT, persisted);
}

async function handleCancel(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateCancelRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_CANCEL_ENCOUNTER_EVENT, validationError);
  }

  const requestEncounter = findRequestEncounter(bundle)!;
  const visitId = getVisitId(requestEncounter)!;
  const existing = (await findMockEncounterByVisitId(visitId))!;

  const persisted: FhirEncounter = {
    ...existing,
    status: 'entered-in-error',
    class: requestEncounter.class ?? existing.class,
    period: {
      start: requestEncounter.period?.start ?? existing.period?.start,
      end: requestEncounter.period?.end ?? existing.period?.end,
    },
    serviceProvider: requestEncounter.serviceProvider ?? existing.serviceProvider,
    diagnosis: requestEncounter.diagnosis ?? existing.diagnosis,
    identifier: [{ system: CEZIH_VISIT_SYSTEM, value: visitId }],
  };

  await updateMockEncounterByVisitId(visitId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_CANCEL_ENCOUNTER_EVENT, persisted);
}

async function handleReopen(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
  const validationError = await validateReopenRequest(bundle);
  if (validationError) {
    return buildErrorResponse(bundle.id, CEZIH_REOPEN_ENCOUNTER_EVENT, validationError);
  }

  const requestEncounter = findRequestEncounter(bundle)!;
  const visitId = getVisitId(requestEncounter)!;
  const existing = (await findMockEncounterByVisitId(visitId))!;

  const persisted: FhirEncounter = {
    ...existing,
    status: 'in-progress',
    class: requestEncounter.class ?? existing.class,
    period: existing.period?.start ? { start: existing.period.start } : undefined,
    serviceProvider: requestEncounter.serviceProvider ?? existing.serviceProvider,
    identifier: [{ system: CEZIH_VISIT_SYSTEM, value: visitId }],
  };

  await updateMockEncounterByVisitId(visitId, persisted);
  return buildSuccessResponse(bundle.id, CEZIH_REOPEN_ENCOUNTER_EVENT, persisted);
}

export class MockCezihMessageClient implements CezihMessageClient {
  async postMessage(bundle: FhirMessageBundle): Promise<FhirMessageBundle> {
    const eventCode = findMessageHeader(bundle)?.eventCoding?.code;

    if (eventCode === CEZIH_CREATE_ENCOUNTER_EVENT) {
      return handleCreate(bundle);
    }
    if (eventCode === CEZIH_CREATE_CASE_EVENT) {
      return handleCreateCase(bundle);
    }
    if (eventCode === CEZIH_CREATE_CASE_RECURRENCE_EVENT) {
      return handleCreateCaseRecurrence(bundle);
    }
    if (eventCode === CEZIH_REMISSION_CASE_EVENT) {
      return handleRemissionCase(bundle);
    }
    if (eventCode === CEZIH_RESOLVE_CASE_EVENT) {
      return handleResolveCase(bundle);
    }
    if (eventCode === CEZIH_RELAPSE_CASE_EVENT) {
      return handleRelapseCase(bundle);
    }
    if (eventCode === CEZIH_DELETE_CASE_EVENT) {
      return handleDeleteCase(bundle);
    }
    if (eventCode === CEZIH_CASE_RESPONSE_EVENT) {
      return handleUpdateCase(bundle);
    }
    if (eventCode === CEZIH_UPDATE_ENCOUNTER_EVENT) {
      return handleUpdate(bundle);
    }
    if (eventCode === CEZIH_CLOSE_ENCOUNTER_EVENT) {
      return handleClose(bundle);
    }
    if (eventCode === CEZIH_CANCEL_ENCOUNTER_EVENT) {
      return handleCancel(bundle);
    }
    if (eventCode === CEZIH_REOPEN_ENCOUNTER_EVENT) {
      return handleReopen(bundle);
    }

    return buildErrorResponse(
      bundle.id,
      eventCode ?? 'unknown',
      'Unsupported message event for mock CEZIH client.',
    );
  }
}
