import type { FhirCodeSystem, FhirValueSet } from '../../../fhir/terminologyTypes';
import type { TerminologyProvider, TerminologyQuery } from '../types';
import type { TerminologyRepository } from '../../repositories/terminology/terminologyRepository';
import { getTerminologyRepository } from '../../repositories/terminology/terminologyRepository';

export class CezihTerminologyProvider implements TerminologyProvider {
  constructor(private readonly repository: TerminologyRepository = getTerminologyRepository()) {}

  async getCodeSystem(query: TerminologyQuery): Promise<FhirCodeSystem | null> {
    if (query.id?.trim()) {
      return this.repository.readCodeSystem(query.id.trim());
    }
    if (query.url?.trim()) {
      const matches = await this.repository.searchCodeSystems({ url: query.url.trim() });
      return matches[0] ?? null;
    }
    return null;
  }

  async queryCodeSystems(
    query?: Pick<TerminologyQuery, 'url' | 'lastUpdatedAfter'>,
  ): Promise<FhirCodeSystem[]> {
    return this.repository.searchCodeSystems({
      url: query?.url,
      lastUpdatedAfter: query?.lastUpdatedAfter,
    });
  }

  async getValueSet(query: TerminologyQuery): Promise<FhirValueSet | null> {
    if (query.id?.trim()) {
      return this.repository.readValueSet(query.id.trim());
    }
    if (query.url?.trim()) {
      const matches = await this.repository.searchValueSets({ url: query.url.trim() });
      return matches[0] ?? null;
    }
    return null;
  }

  async queryValueSets(
    query?: Pick<TerminologyQuery, 'url' | 'lastUpdatedAfter'>,
  ): Promise<FhirValueSet[]> {
    return this.repository.searchValueSets({
      url: query?.url,
      lastUpdatedAfter: query?.lastUpdatedAfter,
    });
  }
}
