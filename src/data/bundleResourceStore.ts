import { CEZIH_BUNDLE_MANIFEST, type BundleResourceType } from '../config/cezihBundleManifest';
import { isBundleScopeEnabled } from '../config/bundleScope';
import type {
  FhirAllergyIntolerance,
  FhirCondition,
  FhirDocumentReference,
  FhirEncounter,
  FhirMedicationRequest,
  FhirOrganization,
  FhirPatient,
  FhirPractitioner,
  FhirProcedure,
  FhirServiceRequest,
} from '../fhir/types';
import { healthLakeClient, type FhirResourceType } from './HealthLakeClient';

type BundleCache = {
  Patient?: FhirPatient[];
  Encounter?: FhirEncounter[];
  Condition?: FhirCondition[];
  Practitioner?: FhirPractitioner[];
  Organization?: FhirOrganization[];
  MedicationRequest?: FhirMedicationRequest[];
  AllergyIntolerance?: FhirAllergyIntolerance[];
  Procedure?: FhirProcedure[];
  DocumentReference?: FhirDocumentReference[];
  ServiceRequest?: FhirServiceRequest[];
};

const cache: BundleCache = {};

async function loadByManifestIds<T extends FhirResourceType>(
  resourceType: T,
  ids: readonly string[],
): Promise<Array<NonNullable<Awaited<ReturnType<typeof healthLakeClient.read<T>>>>>> {
  if (ids.length === 0) return [];

  try {
    const fromSearch = await healthLakeClient.searchAll(resourceType, {
      _id: ids.join(','),
    });
    if (fromSearch.length > 0) {
      const allowed = new Set(ids);
      return fromSearch.filter((r) => allowed.has(r.id)) as Array<
        NonNullable<Awaited<ReturnType<typeof healthLakeClient.read<T>>>>
      >;
    }
  } catch {
    // HealthLake may reject multi-_id; fall back to per-id reads.
  }

  const reads = await Promise.all(ids.map((id) => healthLakeClient.read(resourceType, id)));
  return reads.filter((r) => r != null) as Array<
    NonNullable<Awaited<ReturnType<typeof healthLakeClient.read<T>>>>
  >;
}

export function bundleScopeActive(): boolean {
  return isBundleScopeEnabled();
}

export function isBundleResourceId(resourceType: FhirResourceType, id: string): boolean {
  if (!isBundleScopeEnabled()) return true;
  const key = resourceType as BundleResourceType;
  const ids = CEZIH_BUNDLE_MANIFEST[key] as readonly string[] | undefined;
  return ids?.includes(id) ?? false;
}

export async function getBundlePatients(): Promise<FhirPatient[]> {
  if (!cache.Patient) {
    cache.Patient = await loadByManifestIds('Patient', CEZIH_BUNDLE_MANIFEST.Patient);
  }
  return cache.Patient;
}

export async function getBundleEncounters(): Promise<FhirEncounter[]> {
  if (!cache.Encounter) {
    cache.Encounter = await loadByManifestIds('Encounter', CEZIH_BUNDLE_MANIFEST.Encounter);
  }
  return cache.Encounter;
}

export async function getBundleConditions(): Promise<FhirCondition[]> {
  if (!cache.Condition) {
    cache.Condition = await loadByManifestIds('Condition', CEZIH_BUNDLE_MANIFEST.Condition);
  }
  return cache.Condition;
}

export async function getBundlePractitioners(): Promise<FhirPractitioner[]> {
  if (!cache.Practitioner) {
    cache.Practitioner = await loadByManifestIds(
      'Practitioner',
      CEZIH_BUNDLE_MANIFEST.Practitioner,
    );
  }
  return cache.Practitioner;
}

export async function getBundleOrganizations(): Promise<FhirOrganization[]> {
  if (!cache.Organization) {
    cache.Organization = await loadByManifestIds(
      'Organization',
      CEZIH_BUNDLE_MANIFEST.Organization,
    );
  }
  return cache.Organization;
}

export async function getBundleMedicationRequests(): Promise<FhirMedicationRequest[]> {
  if (!cache.MedicationRequest) {
    cache.MedicationRequest = await loadByManifestIds(
      'MedicationRequest',
      CEZIH_BUNDLE_MANIFEST.MedicationRequest,
    );
  }
  return cache.MedicationRequest;
}

export async function getBundleAllergyIntolerances(): Promise<FhirAllergyIntolerance[]> {
  if (!cache.AllergyIntolerance) {
    cache.AllergyIntolerance = await loadByManifestIds(
      'AllergyIntolerance',
      CEZIH_BUNDLE_MANIFEST.AllergyIntolerance,
    );
  }
  return cache.AllergyIntolerance;
}

export async function getBundleProcedures(): Promise<FhirProcedure[]> {
  if (!cache.Procedure) {
    cache.Procedure = await loadByManifestIds('Procedure', CEZIH_BUNDLE_MANIFEST.Procedure);
  }
  return cache.Procedure;
}

export async function getBundleDocumentReferences(): Promise<FhirDocumentReference[]> {
  if (!cache.DocumentReference) {
    cache.DocumentReference = await loadByManifestIds(
      'DocumentReference',
      CEZIH_BUNDLE_MANIFEST.DocumentReference,
    );
  }
  return cache.DocumentReference;
}

export async function getBundleServiceRequests(): Promise<FhirServiceRequest[]> {
  if (!cache.ServiceRequest) {
    cache.ServiceRequest = await loadByManifestIds(
      'ServiceRequest',
      CEZIH_BUNDLE_MANIFEST.ServiceRequest,
    );
  }
  return cache.ServiceRequest;
}

/** One parallel fetch of all manifest resource types (cached afterward). */
export async function preloadBundle(): Promise<void> {
  if (!isBundleScopeEnabled()) return;
  await Promise.all([
    getBundlePatients(),
    getBundleEncounters(),
    getBundleConditions(),
    getBundlePractitioners(),
    getBundleOrganizations(),
    getBundleMedicationRequests(),
    getBundleAllergyIntolerances(),
    getBundleProcedures(),
    getBundleDocumentReferences(),
    getBundleServiceRequests(),
  ]);
}
