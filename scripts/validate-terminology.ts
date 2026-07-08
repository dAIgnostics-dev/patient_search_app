import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import type { FhirCodeSystem } from '../src/fhir/terminologyTypes';
import { parseCodeSystemConcepts } from '../src/data/terminology/parseCodeSystemConcepts';
import { buildConceptTree, toFlatSelectableOptions } from '../src/data/terminology/buildConceptTree';
import { StaticTerminologyProvider } from '../src/data/terminology/providers/staticTerminologyProvider';
import { TerminologyCache } from '../src/data/terminology/terminologyCache';
import { syncCodeSystems } from '../src/data/terminology/terminologySync';
import type { TerminologyProvider } from '../src/data/terminology/types';
import {
  CEZIH_ICD10_HR_SYSTEM,
} from '../src/fhir/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');

class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

function installMemoryLocalStorage(): void {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

class StaticProviderAdapter implements TerminologyProvider {
  private readonly provider = new StaticTerminologyProvider();

  getCodeSystem = this.provider.getCodeSystem.bind(this.provider);
  queryCodeSystems = this.provider.queryCodeSystems.bind(this.provider);
  getValueSet = this.provider.getValueSet.bind(this.provider);
  queryValueSets = this.provider.queryValueSets.bind(this.provider);
}

async function main(): Promise<void> {
  installMemoryLocalStorage();

  const stadijPath = join(root, 'mock-data/terminology/stadij-bolesti.json');
  const stadij = await readJson<FhirCodeSystem>(stadijPath);
  const parsed = parseCodeSystemConcepts(stadij);
  const tree = buildConceptTree(parsed);
  const options = toFlatSelectableOptions(tree, stadij.url ?? 'stadij');

  const parent = parsed.find((item) => item.code === '1');
  const child = parsed.find((item) => item.code === '2');
  assert(parent, 'Expected parent concept code 1');
  assert(child, 'Expected child concept code 2');
  assert.equal(parent.notSelectable, true, 'Parent must be not selectable');
  assert.equal(child.parentId, '1', 'Child must reference parent-id=1');
  assert.equal(options.length, 1, 'Only one selectable concept expected');
  assert.equal(options[0].code, '2', 'Selectable concept should be code 2');

  const staticProvider = new StaticTerminologyProvider();
  const staticIcd = await staticProvider.getCodeSystem({ url: CEZIH_ICD10_HR_SYSTEM });
  assert(staticIcd?.concept && staticIcd.concept.length >= 7, 'Static ICD10 should expose 7 concepts');

  const cache = new TerminologyCache();
  cache.setCodeSystem({
    url: CEZIH_ICD10_HR_SYSTEM,
    codeSystem: staticIcd!,
    cachedAt: new Date().toISOString(),
    version: staticIcd?.version,
    lastUpdated: staticIcd?.meta?.lastUpdated,
  });
  const cached = cache.getCodeSystem(CEZIH_ICD10_HR_SYSTEM);
  assert(cached?.codeSystem.url === CEZIH_ICD10_HR_SYSTEM, 'Cache round-trip should return same URL');

  const syncResult = await syncCodeSystems(new StaticProviderAdapter(), cache, {
    lastUpdatedAfter: '2022-11-01',
  });
  assert(syncResult.fetched > 0, 'Sync should fetch at least one CodeSystem');
  assert(syncResult.updated > 0, 'Sync should update at least one CodeSystem');

  console.log('Terminology validation passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
