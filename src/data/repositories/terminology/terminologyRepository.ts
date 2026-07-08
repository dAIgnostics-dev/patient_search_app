import type { FhirCodeSystem, FhirValueSet } from '../../../fhir/terminologyTypes';
import { getFhirClientForResource } from '../registry';

function toLastUpdatedParam(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return `gt${normalized}`;
}

export class TerminologyRepository {
  async searchCodeSystems(params?: {
    lastUpdatedAfter?: string;
    url?: string;
  }): Promise<FhirCodeSystem[]> {
    const client = getFhirClientForResource('CodeSystem');
    return client.searchAll<FhirCodeSystem>('CodeSystem', {
      _lastUpdated: toLastUpdatedParam(params?.lastUpdatedAfter),
      url: params?.url?.trim() || undefined,
    });
  }

  async readCodeSystem(id: string): Promise<FhirCodeSystem | null> {
    const normalized = id.trim();
    if (!normalized) return null;
    const client = getFhirClientForResource('CodeSystem');
    return client.read<FhirCodeSystem>('CodeSystem', normalized);
  }

  async searchValueSets(params?: {
    lastUpdatedAfter?: string;
    url?: string;
  }): Promise<FhirValueSet[]> {
    const client = getFhirClientForResource('ValueSet');
    return client.searchAll<FhirValueSet>('ValueSet', {
      _lastUpdated: toLastUpdatedParam(params?.lastUpdatedAfter),
      url: params?.url?.trim() || undefined,
    });
  }

  async readValueSet(id: string): Promise<FhirValueSet | null> {
    const normalized = id.trim();
    if (!normalized) return null;
    const client = getFhirClientForResource('ValueSet');
    return client.read<FhirValueSet>('ValueSet', normalized);
  }
}

let cachedRepository: TerminologyRepository | null = null;

export function getTerminologyRepository(): TerminologyRepository {
  if (!cachedRepository) {
    cachedRepository = new TerminologyRepository();
  }
  return cachedRepository;
}
