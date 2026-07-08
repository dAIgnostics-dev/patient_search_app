import { resolveTerminologyProviderMode } from '../../config/runtime';
import type { FhirCodeSystem, FhirValueSet } from '../../fhir/terminologyTypes';
import { buildConceptTree, getChildren, toFlatSelectableOptions } from '../terminology/buildConceptTree';
import { resolveCatalogSystem } from '../terminology/catalogRegistry';
import { parseCodeSystemConcepts } from '../terminology/parseCodeSystemConcepts';
import type { TerminologyCache } from '../terminology/terminologyCache';
import { TerminologyCache as LocalTerminologyCache } from '../terminology/terminologyCache';
import { CezihTerminologyProvider } from '../terminology/providers/cezihTerminologyProvider';
import { MockTerminologyProvider } from '../terminology/providers/mockTerminologyProvider';
import { StaticTerminologyProvider } from '../terminology/providers/staticTerminologyProvider';
import { syncCodeSystems } from '../terminology/terminologySync';
import type {
  TerminologyCatalogKey,
  TerminologyConcept,
  TerminologyOption,
  TerminologyProvider,
  TerminologySyncResult,
} from '../terminology/types';

function resolveProvider(): TerminologyProvider {
  const mode = resolveTerminologyProviderMode();
  if (mode === 'static') return new StaticTerminologyProvider();
  if (mode === 'cezih') return new CezihTerminologyProvider();
  return new MockTerminologyProvider();
}

function normalizeCode(code: string): string {
  return code.trim();
}

export class TerminologyService {
  constructor(
    private readonly provider: TerminologyProvider = resolveProvider(),
    private readonly cache: TerminologyCache = new LocalTerminologyCache(),
  ) {}

  async getCodeSystemByUrl(url: string): Promise<FhirCodeSystem | null> {
    const normalized = url.trim();
    if (!normalized) return null;

    const cached = this.cache.getCodeSystem(normalized);
    if (cached?.codeSystem) return cached.codeSystem;

    const codeSystem = await this.provider.getCodeSystem({ url: normalized });
    if (codeSystem && codeSystem.url) {
      this.cache.setCodeSystem({
        url: codeSystem.url,
        version: codeSystem.version,
        lastUpdated: codeSystem.meta?.lastUpdated,
        cachedAt: new Date().toISOString(),
        codeSystem,
      });
    }
    return codeSystem;
  }

  async getCodeSystemByKey(key: TerminologyCatalogKey): Promise<FhirCodeSystem | null> {
    return this.getCodeSystemByUrl(resolveCatalogSystem(key));
  }

  async getValueSetByUrl(url: string): Promise<FhirValueSet | null> {
    const normalized = url.trim();
    if (!normalized) return null;

    const cached = this.cache.getValueSet(normalized);
    if (cached?.valueSet) return cached.valueSet;

    const valueSet = await this.provider.getValueSet({ url: normalized });
    if (valueSet && valueSet.url) {
      this.cache.setValueSet({
        url: valueSet.url,
        version: valueSet.version,
        lastUpdated: valueSet.meta?.lastUpdated,
        cachedAt: new Date().toISOString(),
        valueSet,
      });
    }
    return valueSet;
  }

  async getConceptTree(url: string): Promise<TerminologyConcept[]> {
    const codeSystem = await this.getCodeSystemByUrl(url);
    const concepts = parseCodeSystemConcepts(codeSystem);
    return buildConceptTree(concepts);
  }

  async getFlatOptions(url: string): Promise<TerminologyOption[]> {
    const tree = await this.getConceptTree(url);
    return toFlatSelectableOptions(tree, url);
  }

  async validateCode(url: string, code: string): Promise<boolean> {
    const normalized = normalizeCode(code);
    if (!normalized) return false;
    const options = await this.getFlatOptions(url);
    return options.some((option) => option.code === normalized);
  }

  async resolveDisplay(url: string, code: string): Promise<string | null> {
    const normalized = normalizeCode(code);
    if (!normalized) return null;
    const options = await this.getFlatOptions(url);
    return options.find((option) => option.code === normalized)?.display ?? null;
  }

  async syncCatalogs(lastUpdatedAfter?: string): Promise<TerminologySyncResult> {
    return syncCodeSystems(this.provider, this.cache, { lastUpdatedAfter });
  }

  async getChildren(url: string, parentCode: string): Promise<TerminologyConcept[]> {
    const tree = await this.getConceptTree(url);
    return getChildren(tree, parentCode);
  }
}

let cachedService: TerminologyService | null = null;

export function getTerminologyService(): TerminologyService {
  if (!cachedService) {
    cachedService = new TerminologyService();
  }
  return cachedService;
}
