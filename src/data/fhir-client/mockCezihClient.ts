import type { FhirBundle, FhirCondition, FhirEncounter, FhirResource } from '../../fhir/types';
import { CEZIH_MOCK_BUNDLES } from '../mock/cezihBundles';
import {
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_SLUCAJ_SYSTEM,
  CEZIH_VISIT_SYSTEM,
} from '../../fhir/types';
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
let initialized = false;

function canUseMockFileApi(): boolean {
  return typeof window !== 'undefined' && typeof fetch === 'function';
}

async function loadFileBackedMockStorage(): Promise<
  Partial<Record<FhirReadableResourceType, FhirResource[]>> | null
> {
  if (!canUseMockFileApi()) return null;
  try {
    const response = await fetch(MOCK_CEZIH_RESOURCES_URL);
    if (!response.ok) return null;
    return (await response.json()) as Partial<Record<FhirReadableResourceType, FhirResource[]>>;
  } catch {
    return null;
  }
}

async function persistMockStorage(): Promise<void> {
  if (!canUseMockFileApi()) return;

  const payload: Partial<Record<FhirReadableResourceType, FhirResource[]>> = {};
  for (const type of SUPPORTED_RESOURCE_TYPES) {
    payload[type] = mockStorage.get(type) ?? [];
  }

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
