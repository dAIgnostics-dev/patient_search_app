import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: expected to find "${needle}"`);
  }
}

const patientChartService = read('src/data/services/patientChartService.ts');
const myPatientsService = read('src/data/services/myPatientsService.ts');
const patientSearchService = read('src/data/services/patientSearchService.ts');
const chartAssembler = read('src/data/services/stitching/patientChartAssembler.ts');
const encounterManagementService = read('src/data/services/encounterManagementService.ts');
const caseManagementService = read('src/data/services/caseManagementService.ts');
const cezihAppRepository = read('src/data/repositories/cezihAppRepository.ts');
const mockCezihAppRepository = read('src/data/repositories/mockCezihAppRepository.ts');
const buildCreateEncounterMessage = read(
  'src/data/encounter-management/buildCreateEncounterMessage.ts',
);
const buildUpdateEncounterMessage = read(
  'src/data/encounter-management/buildUpdateEncounterMessage.ts',
);
const buildCloseEncounterMessage = read(
  'src/data/encounter-management/buildCloseEncounterMessage.ts',
);
const buildCancelEncounterMessage = read(
  'src/data/encounter-management/buildCancelEncounterMessage.ts',
);
const buildReopenEncounterMessage = read(
  'src/data/encounter-management/buildReopenEncounterMessage.ts',
);
const buildCreateCaseMessage = read('src/data/case-management/buildCreateCaseMessage.ts');
const buildCreateCaseRecurrenceMessage = read(
  'src/data/case-management/buildCreateCaseRecurrenceMessage.ts',
);
const buildDeleteCaseMessage = read('src/data/case-management/buildDeleteCaseMessage.ts');
const buildUpdateCaseMessage = read('src/data/case-management/buildUpdateCaseMessage.ts');
const buildRemissionCaseMessage = read('src/data/case-management/buildRemissionCaseMessage.ts');
const buildRelapseCaseMessage = read('src/data/case-management/buildRelapseCaseMessage.ts');
const buildResolveCaseMessage = read('src/data/case-management/buildResolveCaseMessage.ts');
const cezihMockStore = read('mock-data/cezih-fhir-store.json');
const parsedCezihMockStore = JSON.parse(cezihMockStore);
const parseEncounterManagementResponse = read(
  'src/data/encounter-management/parseEncounterManagementResponse.ts',
);
const parseCaseManagementResponse = read('src/data/case-management/parseCaseManagementResponse.ts');

function assertNoDuplicateValues(values, label) {
  const duplicates = values.filter((value, index) => value && values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${label}: ${[...new Set(duplicates)].join(', ')}`);
  }
}

function encounterVisitId(encounter) {
  return encounter.identifier?.find(
    (identifier) =>
      identifier.system ===
      'http://fhir.cezih.hr/specifikacije/identifikatori/identifikator-posjete',
  )?.value;
}

assertIncludes(patientChartService, 'getPatientChart(', 'PatientChartService.getPatientChart');
assertIncludes(patientChartService, 'getAppRepository()', 'patient chart repository routing');
assertIncludes(patientChartService, 'assemblePatientChart', 'chart assembler usage');
assertIncludes(myPatientsService, 'getMyPatients(', 'MyPatientsService.getMyPatients');
assertIncludes(myPatientsService, 'findPatientByMbo(', 'MyPatientsService.findPatientByMbo');
assertIncludes(myPatientsService, 'getAppRepository()', 'my patients repository routing');
assertIncludes(
  patientSearchService,
  'findPatientsByName(',
  'PatientSearchService.findPatientsByName',
);
assertIncludes(patientSearchService, 'getAppRepository()', 'patient search repository routing');
assertIncludes(
  cezihAppRepository,
  'constructor(private readonly client: FhirClient)',
  'CEZIH app repository FHIR client injection',
);
assertIncludes(
  mockCezihAppRepository,
  'extends CezihAppRepository',
  'mock CEZIH app repository shares CEZIH implementation',
);
assertIncludes(
  cezihMockStore,
  'visit-009',
  'expanded mock CEZIH encounter fixture',
);
assertIncludes(
  cezihAppRepository,
  'referencedPractitioner',
  'my patients resolves practitioner reference to HZJZ',
);
assertIncludes(chartAssembler, 'timeline', 'timeline stitching support');
assertIncludes(
  encounterManagementService,
  'createEncounter(',
  'EncounterManagementService.createEncounter',
);
assertIncludes(
  buildCreateEncounterMessage,
  'buildCreateEncounterMessage',
  'buildCreateEncounterMessage export',
);
assertIncludes(
  encounterManagementService,
  'updateEncounter(',
  'EncounterManagementService.updateEncounter',
);
assertIncludes(
  buildUpdateEncounterMessage,
  'buildUpdateEncounterMessage',
  'buildUpdateEncounterMessage export',
);
assertIncludes(
  encounterManagementService,
  'closeEncounter(',
  'EncounterManagementService.closeEncounter',
);
assertIncludes(
  buildCloseEncounterMessage,
  'buildCloseEncounterMessage',
  'buildCloseEncounterMessage export',
);
assertIncludes(
  encounterManagementService,
  'cancelEncounter(',
  'EncounterManagementService.cancelEncounter',
);
assertIncludes(
  buildCancelEncounterMessage,
  'buildCancelEncounterMessage',
  'buildCancelEncounterMessage export',
);
assertIncludes(
  encounterManagementService,
  'reopenEncounter(',
  'EncounterManagementService.reopenEncounter',
);
assertIncludes(
  buildReopenEncounterMessage,
  'buildReopenEncounterMessage',
  'buildReopenEncounterMessage export',
);
assertIncludes(
  parseEncounterManagementResponse,
  'parseEncounterManagementResponse',
  'parseEncounterManagementResponse export',
);
assertIncludes(caseManagementService, 'createCase(', 'CaseManagementService.createCase');
assertIncludes(
  caseManagementService,
  'createCaseRecurrence(',
  'CaseManagementService.createCaseRecurrence',
);
assertIncludes(
  caseManagementService,
  'updateCase(',
  'CaseManagementService.updateCase',
);
assertIncludes(
  caseManagementService,
  'deleteCase(',
  'CaseManagementService.deleteCase',
);
assertIncludes(
  caseManagementService,
  'relapseCase(',
  'CaseManagementService.relapseCase',
);
assertIncludes(
  caseManagementService,
  'remissionCase(',
  'CaseManagementService.remissionCase',
);
assertIncludes(
  caseManagementService,
  'resolveCase(',
  'CaseManagementService.resolveCase',
);
assertIncludes(
  buildCreateCaseMessage,
  'buildCreateCaseMessage',
  'buildCreateCaseMessage export',
);
assertIncludes(
  buildCreateCaseRecurrenceMessage,
  'buildCreateCaseRecurrenceMessage',
  'buildCreateCaseRecurrenceMessage export',
);
assertIncludes(
  buildDeleteCaseMessage,
  'buildDeleteCaseMessage',
  'buildDeleteCaseMessage export',
);
assertIncludes(
  buildUpdateCaseMessage,
  'buildUpdateCaseMessage',
  'buildUpdateCaseMessage export',
);
assertIncludes(
  buildRelapseCaseMessage,
  'buildRelapseCaseMessage',
  'buildRelapseCaseMessage export',
);
assertIncludes(
  buildRemissionCaseMessage,
  'buildRemissionCaseMessage',
  'buildRemissionCaseMessage export',
);
assertIncludes(
  buildResolveCaseMessage,
  'buildResolveCaseMessage',
  'buildResolveCaseMessage export',
);
assertIncludes(
  parseCaseManagementResponse,
  'parseCaseManagementResponse',
  'parseCaseManagementResponse export',
);
assertNoDuplicateValues(
  (parsedCezihMockStore.Encounter ?? []).map((encounter) => encounter.id),
  'mock CEZIH encounter ids',
);
assertNoDuplicateValues(
  (parsedCezihMockStore.Encounter ?? []).map(encounterVisitId),
  'mock CEZIH encounter visit identifiers',
);

console.log('Service layer validation passed.');
