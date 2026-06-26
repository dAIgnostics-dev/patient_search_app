import type { FhirBundle, FhirResource } from '../../fhir/types';
import type { FhirClient, FhirReadableResourceType, FhirSearchParams } from './types';

function buildUrl(baseUrl: string, resourceType: FhirReadableResourceType, id?: string): URL {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const path = id
    ? `/fhir/${resourceType}/${encodeURIComponent(id)}`
    : `/fhir/${resourceType}`;
  return new URL(path, `${normalizedBase}/`);
}

export class CezihFhirClient implements FhirClient {
  constructor(private readonly baseUrl: string) {}

  async read<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    id: string,
  ): Promise<TResource | null> {
    const response = await fetch(buildUrl(this.baseUrl, resourceType, id));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`CEZIH read failed (${response.status})`);
    return (await response.json()) as TResource;
  }

  async search<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<FhirBundle<TResource>> {
    const url = buildUrl(this.baseUrl, resourceType);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value?.trim()) url.searchParams.set(key, value.trim());
      }
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`CEZIH search failed (${response.status})`);
    return (await response.json()) as FhirBundle<TResource>;
  }

  async searchAll<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<TResource[]> {
    const bundle = await this.search<TResource>(resourceType, params);
    return (bundle.entry ?? []).map((entry) => entry.resource);
  }
}
