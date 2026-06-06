import { API_BASE_URL } from '../config/runtime';
import type {
  FhirAllergyIntolerance,
  FhirBundle,
  FhirCondition,
  FhirDocumentReference,
  FhirEncounter,
  FhirMedicationRequest,
  FhirOperationOutcome,
  FhirOrganization,
  FhirPatient,
  FhirPractitioner,
  FhirProcedure,
  FhirServiceRequest,
} from '../fhir/types';

export type FhirResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Condition'
  | 'Practitioner'
  | 'Organization'
  | 'MedicationRequest'
  | 'AllergyIntolerance'
  | 'Procedure'
  | 'DocumentReference'
  | 'ServiceRequest';

export type FhirResourceByType = {
  Patient: FhirPatient;
  Encounter: FhirEncounter;
  Condition: FhirCondition;
  Practitioner: FhirPractitioner;
  Organization: FhirOrganization;
  MedicationRequest: FhirMedicationRequest;
  AllergyIntolerance: FhirAllergyIntolerance;
  Procedure: FhirProcedure;
  DocumentReference: FhirDocumentReference;
  ServiceRequest: FhirServiceRequest;
};

/** HealthLake max page size; use pagination for larger result sets. */
const FHIR_PAGE_COUNT = '100';

function toSearchParams(query?: Record<string, string | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  params.set('_count', FHIR_PAGE_COUNT);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (key === '_count' || !value?.trim()) continue;
      params.set(key, value.trim());
    }
  }
  return params;
}

/** Map HealthLake absolute `next` link to a path the Lambda proxy accepts. */
function pathFromFhirNextUrl(nextUrl: string): { path: string; params?: URLSearchParams } {
  const parsed = new URL(nextUrl);
  const afterR4 = parsed.pathname.split('/r4/')[1];
  if (!afterR4) {
    throw new Error(`Cannot parse FHIR next link: ${nextUrl}`);
  }
  const path = afterR4.startsWith('/') ? afterR4 : `/${afterR4}`;
  const params = parsed.search ? new URLSearchParams(parsed.search) : undefined;
  return { path, params };
}

async function request<T>(path: string, params?: URLSearchParams): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    url.search = params.toString();
  }

  const response = await fetch(url.toString());
  const payload = (await response.json()) as T | FhirOperationOutcome;

  if (!response.ok) {
    const outcome = payload as FhirOperationOutcome;
    const msg = outcome.issue?.[0]?.diagnostics ?? `FHIR request failed (${response.status})`;
    throw new Error(msg);
  }

  return payload as T;
}

export class HealthLakeClient {
  async read<T extends FhirResourceType>(
    resourceType: T,
    id: string,
  ): Promise<FhirResourceByType[T] | null> {
    try {
      return await request<FhirResourceByType[T]>(
        `/${resourceType}/${encodeURIComponent(id)}`,
      );
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('not found')) {
        return null;
      }
      throw err;
    }
  }

  async search<T extends FhirResourceType>(
    resourceType: T,
    query?: Record<string, string | undefined>,
  ): Promise<FhirBundle<FhirResourceByType[T]>> {
    const params = toSearchParams(query);
    return request<FhirBundle<FhirResourceByType[T]>>(`/${resourceType}`, params);
  }

  /** Fetch every page of a FHIR search (HealthLake defaults to ~10 per page without this). */
  async searchAll<T extends FhirResourceType>(
    resourceType: T,
    query?: Record<string, string | undefined>,
  ): Promise<FhirResourceByType[T][]> {
    const resources: FhirResourceByType[T][] = [];
    let path = `/${resourceType}`;
    let params: URLSearchParams | undefined = toSearchParams(query);

    for (;;) {
      const bundle = await request<FhirBundle<FhirResourceByType[T]>>(path, params);
      for (const entry of bundle.entry ?? []) {
        if (entry.resource) resources.push(entry.resource);
      }

      const nextUrl = bundle.link?.find((link) => link.relation === 'next')?.url;
      if (!nextUrl) break;

      const next = pathFromFhirNextUrl(nextUrl);
      path = next.path;
      params = next.params;
    }

    return resources;
  }
}

export const healthLakeClient = new HealthLakeClient();
