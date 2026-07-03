import type { FhirBundle, FhirBinary, FhirClinicalDocumentBundle, FhirCondition, FhirDocumentReference, FhirEncounter, FhirResource } from '../../fhir/types';
import { CEZIH_MOCK_BUNDLES, CEZIH_MOCK_STORAGE, type CezihMockStorage } from '../mock/cezihBundles';
import {
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_DOCUMENT_TYPE_SYSTEM,
  CEZIH_SLUCAJ_SYSTEM,
  CEZIH_VISIT_SYSTEM,
} from '../../fhir/types';
import { readClinicalDocumentSummaryExtension } from '../../mappers/mapClinicalDocumentBundle';
import type { FhirClient, FhirReadableResourceType, FhirSearchParams } from './types';

const SUPPORTED_RESOURCE_TYPES: FhirReadableResourceType[] = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Condition',
  'DocumentReference',
];

const MOCK_CEZIH_RESOURCES_URL = '/api/mock-cezih/resources';
const mockStorage = new Map<FhirReadableResourceType, FhirResource[]>();
let documentBundles: FhirClinicalDocumentBundle[] = [];
let binaryResources: FhirBinary[] = [];
let initialized = false;

function canUseMockFileApi(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

async function loadFileBackedMockStorage(): Promise<CezihMockStorage | null> {
  if (!canUseMockFileApi()) return null;
  try {
    const response = await fetch(MOCK_CEZIH_RESOURCES_URL);
    if (!response.ok) return null;
    return (await response.json()) as CezihMockStorage;
  } catch {
    return null;
  }
}

async function persistMockStorage(): Promise<void> {
  if (!canUseMockFileApi()) return;

  const payload = {
    ...Object.fromEntries(
      SUPPORTED_RESOURCE_TYPES.map((type) => [type, mockStorage.get(type) ?? []] as const),
    ),
    DocumentBundle: documentBundles,
    Binary: binaryResources,
  } as CezihMockStorage;

  try {
    await fetch(MOCK_CEZIH_RESOURCES_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // If the dev middleware is unavailable, keep the in-memory mock working.
  }
}

async function initMockStorage(): Promise<void> {
  if (initialized) return;
  const persisted = await loadFileBackedMockStorage();
  for (const type of SUPPORTED_RESOURCE_TYPES) {
    mockStorage.set(type, [...(persisted?.[type] ?? CEZIH_MOCK_BUNDLES[type] ?? [])]);
  }
  documentBundles = [...(persisted?.DocumentBundle ?? CEZIH_MOCK_STORAGE.DocumentBundle ?? [])];
  binaryResources = [...(persisted?.Binary ?? CEZIH_MOCK_STORAGE.Binary ?? [])];
  initialized = true;
}

export async function appendMockEncounter(encounter: FhirEncounter): Promise<void> {
  await initMockStorage();
  const list = mockStorage.get('Encounter') ?? [];
  mockStorage.set('Encounter', [...list, encounter]);
  await persistMockStorage();
}

export async function getMockEncounters(): Promise<FhirEncounter[]> {
  await initMockStorage();
  return (mockStorage.get('Encounter') ?? []) as FhirEncounter[];
}

export async function mockEncounterIdExists(id: string): Promise<boolean> {
  const encounters = await getMockEncounters();
  return encounters.some((encounter) => encounter.id === id);
}

export async function appendMockCondition(condition: FhirCondition): Promise<void> {
  await initMockStorage();
  const list = mockStorage.get('Condition') ?? [];
  mockStorage.set('Condition', [...list, condition]);
  await persistMockStorage();
}

export async function getMockConditions(): Promise<FhirCondition[]> {
  await initMockStorage();
  return (mockStorage.get('Condition') ?? []) as FhirCondition[];
}

export async function mockConditionIdExists(id: string): Promise<boolean> {
  const conditions = await getMockConditions();
  return conditions.some((condition) => condition.id === id);
}

export async function findMockConditionByCaseId(caseId: string): Promise<FhirCondition | null> {
  await initMockStorage();
  const list = (mockStorage.get('Condition') ?? []) as FhirCondition[];
  return (
    list.find((condition) =>
      condition.identifier?.some(
        (id) =>
          (id.system === CEZIH_CASE_IDENTIFIER_SYSTEM || id.system === CEZIH_SLUCAJ_SYSTEM) &&
          id.value === caseId,
      ),
    ) ?? null
  );
}

export async function updateMockConditionByCaseId(
  caseId: string,
  condition: FhirCondition,
): Promise<boolean> {
  await initMockStorage();
  const list = (mockStorage.get('Condition') ?? []) as FhirCondition[];
  const index = list.findIndex((item) =>
    item.identifier?.some(
      (id) =>
        (id.system === CEZIH_CASE_IDENTIFIER_SYSTEM || id.system === CEZIH_SLUCAJ_SYSTEM) &&
        id.value === caseId,
    ),
  );
  if (index < 0) return false;

  const updated = [...list];
  updated[index] = condition;
  mockStorage.set('Condition', updated);
  await persistMockStorage();
  return true;
}

export async function findMockEncounterByVisitId(visitId: string): Promise<FhirEncounter | null> {
  await initMockStorage();
  const list = (mockStorage.get('Encounter') ?? []) as FhirEncounter[];
  return (
    list.find((encounter) =>
      encounter.identifier?.some(
        (id) => id.system === CEZIH_VISIT_SYSTEM && id.value === visitId,
      ),
    ) ?? null
  );
}

export function updateMockEncounterByVisitId(
  visitId: string,
  encounter: FhirEncounter,
): Promise<boolean> {
  return updateMockEncounterByVisitIdInternal(visitId, encounter);
}

async function updateMockEncounterByVisitIdInternal(
  visitId: string,
  encounter: FhirEncounter,
): Promise<boolean> {
  await initMockStorage();
  const list = (mockStorage.get('Encounter') ?? []) as FhirEncounter[];
  const index = list.findIndex((item) =>
    item.identifier?.some((id) => id.system === CEZIH_VISIT_SYSTEM && id.value === visitId),
  );
  if (index < 0) return false;

  const updated = [...list];
  updated[index] = encounter;
  mockStorage.set('Encounter', updated);
  await persistMockStorage();
  return true;
}

export async function getMockDocumentBundles(): Promise<FhirClinicalDocumentBundle[]> {
  await initMockStorage();
  return [...documentBundles];
}

export async function getMockDocumentBundleById(id: string): Promise<FhirClinicalDocumentBundle | null> {
  await initMockStorage();
  return documentBundles.find((bundle) => bundle.id === id) ?? null;
}

export interface MockDocumentReferenceSearchFilter {
  patientMbo?: string;
  typeCode?: string;
  encounterVisitId?: string;
  dateFrom?: string;
  dateTo?: string;
  compositionStatus?: string;
}

function documentReferencePatientMbo(resource: FhirDocumentReference): string | null {
  return resource.subject?.identifier?.value ?? null;
}

function documentReferenceTypeCode(resource: FhirDocumentReference): string | null {
  return (
    resource.type?.coding?.find((coding) => coding.system === CEZIH_DOCUMENT_TYPE_SYSTEM)?.code ??
    resource.type?.coding?.[0]?.code ??
    null
  );
}

function documentReferenceVisitId(resource: FhirDocumentReference): string | null {
  const fromContext = resource.context?.encounter?.[0]?.identifier?.value ?? null;
  if (fromContext) return fromContext;
  const fromExtension = readClinicalDocumentSummaryExtension(resource.extension).encounterVisitId;
  return fromExtension ?? null;
}

function documentReferenceDocumentId(resource: FhirDocumentReference): string | null {
  return (
    readClinicalDocumentSummaryExtension(resource.extension).documentId ??
    resource.identifier?.[0]?.value ??
    null
  );
}

export async function getMockDocumentReferences(): Promise<FhirDocumentReference[]> {
  await initMockStorage();
  return [...((mockStorage.get('DocumentReference') ?? []) as FhirDocumentReference[])];
}

export async function findMockDocumentReferenceById(
  id: string,
): Promise<FhirDocumentReference | null> {
  const list = await getMockDocumentReferences();
  return list.find((resource) => resource.id === id) ?? null;
}

export async function findMockDocumentReferenceReplacing(
  documentReferenceId: string,
): Promise<FhirDocumentReference | null> {
  const list = await getMockDocumentReferences();
  const targetRef = `DocumentReference/${documentReferenceId}`;
  return (
    list.find((resource) =>
      resource.relatesTo?.some(
        (item) =>
          item.code === 'replaces' &&
          (item.target?.reference === targetRef || item.target?.reference === documentReferenceId),
      ),
    ) ?? null
  );
}

export async function appendMockDocumentBundle(bundle: FhirClinicalDocumentBundle): Promise<void> {
  await initMockStorage();
  documentBundles = [...documentBundles, bundle];
  await persistMockStorage();
}

export async function updateMockDocumentBundle(
  bundleId: string,
  bundle: FhirClinicalDocumentBundle,
): Promise<boolean> {
  await initMockStorage();
  const index = documentBundles.findIndex((item) => item.id === bundleId);
  if (index < 0) return false;
  const updated = [...documentBundles];
  updated[index] = bundle;
  documentBundles = updated;
  await persistMockStorage();
  return true;
}

export async function appendMockDocumentReference(
  resource: FhirDocumentReference,
): Promise<void> {
  await initMockStorage();
  const list = (mockStorage.get('DocumentReference') ?? []) as FhirDocumentReference[];
  mockStorage.set('DocumentReference', [...list, resource]);
  await persistMockStorage();
}

export async function updateMockDocumentReference(
  id: string,
  resource: FhirDocumentReference,
): Promise<boolean> {
  await initMockStorage();
  const list = (mockStorage.get('DocumentReference') ?? []) as FhirDocumentReference[];
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return false;
  const updated = [...list];
  updated[index] = resource;
  mockStorage.set('DocumentReference', updated);
  await persistMockStorage();
  return true;
}

export async function findMockDocumentBundleByDocumentId(
  documentId: string,
): Promise<FhirClinicalDocumentBundle | null> {
  await initMockStorage();
  return (
    documentBundles.find(
      (bundle) => bundle.identifier?.value === documentId || bundle.id === documentId,
    ) ?? null
  );
}

export async function findMockDocumentBundleByReferenceId(
  documentReferenceId: string,
): Promise<FhirClinicalDocumentBundle | null> {
  const reference = await findMockDocumentReferenceById(documentReferenceId);
  if (!reference) return null;
  const documentId = documentReferenceDocumentId(reference);
  if (!documentId) return null;
  return findMockDocumentBundleByDocumentId(documentId);
}

function documentReferenceCompositionStatus(resource: FhirDocumentReference): string | null {
  return readClinicalDocumentSummaryExtension(resource.extension).compositionStatus ?? null;
}

export async function appendMockBinary(binary: FhirBinary): Promise<void> {
  await initMockStorage();
  binaryResources = [...binaryResources, binary];
  await persistMockStorage();
}

export async function getMockBinaryById(id: string): Promise<FhirBinary | null> {
  await initMockStorage();
  return binaryResources.find((resource) => resource.id === id) ?? null;
}

export async function searchMockDocumentReferences(
  filter: MockDocumentReferenceSearchFilter = {},
): Promise<FhirDocumentReference[]> {
  const list = await getMockDocumentReferences();
  return list.filter((resource) => {
    if (filter.patientMbo && documentReferencePatientMbo(resource) !== filter.patientMbo) {
      return false;
    }
    if (filter.typeCode && documentReferenceTypeCode(resource) !== filter.typeCode) {
      return false;
    }
    if (filter.encounterVisitId && documentReferenceVisitId(resource) !== filter.encounterVisitId) {
      return false;
    }
    if (
      filter.compositionStatus &&
      documentReferenceCompositionStatus(resource) !== filter.compositionStatus
    ) {
      return false;
    }
    if (filter.dateFrom && resource.date && resource.date < filter.dateFrom) {
      return false;
    }
    if (filter.dateTo && resource.date && resource.date > filter.dateTo) {
      return false;
    }
    return true;
  });
}

function emptyBundle<TResource extends FhirResource>(): FhirBundle<TResource> {
  return { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] };
}

export class MockCezihFhirClient implements FhirClient {
  constructor() {}

  async read<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    id: string,
  ): Promise<TResource | null> {
    await initMockStorage();
    const list = mockStorage.get(resourceType) ?? [];
    const match = list.find((resource) => resource.id === id);
    return (match as TResource | undefined) ?? null;
  }

  async search<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<FhirBundle<TResource>> {
    const list = (await this.searchAll<TResource>(resourceType, params)) ?? [];
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: list.length,
      entry: list.map((resource) => ({ resource })),
    };
  }

  async searchAll<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<TResource[]> {
    await initMockStorage();
    const list = mockStorage.get(resourceType);
    if (!list) return [];
    if (!params || Object.keys(params).length === 0) return list as TResource[];

    const loweredNeedles = Object.values(params)
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.toLowerCase());

    return list.filter((resource) => {
      const haystack = JSON.stringify(resource).toLowerCase();
      return loweredNeedles.every((needle) => haystack.includes(needle));
    }) as TResource[];
  }
}

export function supportsMockCezih(resourceType: FhirReadableResourceType): boolean {
  return SUPPORTED_RESOURCE_TYPES.includes(resourceType);
}

export function mockBundleForUnsupported<TResource extends FhirResource>(): FhirBundle<TResource> {
  return emptyBundle<TResource>();
}
