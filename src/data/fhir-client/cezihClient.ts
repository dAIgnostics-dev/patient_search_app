import type { FhirBundle, FhirResource } from '../../fhir/types';
import { CEZIH_CERT_ENDPOINTS, cezihNextPageUrl, resolveCezihResourceUrl } from '../../config/cezihEndpoints';
import { cezihFetch } from './cezihFetch';
import type { FhirClient, FhirReadableResourceType, FhirSearchParams } from './types';

function buildUrl(baseUrl: string, resourceType: FhirReadableResourceType, id?: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  if (baseUrl === '/api/cezih') {
    return `${resolveCezihResourceUrl(resourceType, id ? 'read' : 'search')}${id ? `/${encodeURIComponent(id)}` : ''}`;
  }
  return `${normalizedBase}/${resourceType}${id ? `/${encodeURIComponent(id)}` : ''}`;
}

export class CezihFhirClient implements FhirClient {
  constructor(private readonly baseUrl: string) {}

  async read<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    id: string,
  ): Promise<TResource | null> {
    if (this.baseUrl === '/api/cezih' && !CEZIH_CERT_ENDPOINTS.some((item) => item.id === `${resourceType}.read`)) {
      const resources = await this.searchAll<TResource>(resourceType, { _id: id });
      return resources.find((item) => item.id === id) ?? null;
    }
    const response = await cezihFetch(buildUrl(this.baseUrl, resourceType, id));
    if (response.status === 404) return null;
    const payload = await response.json();
    if (!response.ok || payload.resourceType === 'OperationOutcome') {
      throw new Error(payload.issue?.[0]?.diagnostics ?? `CEZIH read failed (${response.status})`);
    }
    if (payload.resourceType !== resourceType || payload.id !== id) {
      throw new Error('CEZIH returned an unexpected resource.');
    }
    return payload as TResource;
  }

  private async fetchBundle<TResource extends FhirResource>(url: string): Promise<FhirBundle<TResource>> {
    const response = await cezihFetch(url, { headers: { Accept: 'application/fhir+json' } });
    const payload = await response.json();
    if (!response.ok || payload.resourceType === 'OperationOutcome') {
      throw new Error(payload.issue?.[0]?.diagnostics ?? `CEZIH search failed (${response.status})`);
    }
    if (payload.resourceType !== 'Bundle' || payload.type !== 'searchset') {
      throw new Error('CEZIH search did not return a searchset Bundle.');
    }
    return payload as FhirBundle<TResource>;
  }

  async search<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<FhirBundle<TResource>> {
    const query = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value?.trim()) query.set(key, value.trim());
      }
    }
    const suffix = query.size ? `?${query}` : '';
    return this.fetchBundle<TResource>(`${buildUrl(this.baseUrl, resourceType)}${suffix}`);
  }

  async searchAll<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<TResource[]> {
    let bundle = await this.search<TResource>(resourceType, params);
    const resources: TResource[] = [];
    const visited = new Set<string>();
    for (;;) {
      resources.push(...(bundle.entry ?? []).map((entry) => entry.resource));
      const next = bundle.link?.find((link) => link.relation === 'next')?.url;
      if (!next) return resources;
      const local = cezihNextPageUrl(`${resourceType}.search`, next);
      if (visited.has(local)) throw new Error('CEZIH pagination contains a cycle.');
      visited.add(local);
      bundle = await this.fetchBundle<TResource>(local);
    }
  }
}
