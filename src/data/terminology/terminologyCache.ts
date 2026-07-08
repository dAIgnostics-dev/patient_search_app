import type { FhirCodeSystem, FhirValueSet } from '../../fhir/terminologyTypes';

const CACHE_PREFIX = 'terminology-cache:';
const LAST_SYNC_KEY = 'terminology-cache:last-sync';

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export interface CachedCodeSystemEntry {
  url: string;
  version?: string;
  lastUpdated?: string;
  cachedAt: string;
  codeSystem: FhirCodeSystem;
}

export interface CachedValueSetEntry {
  url: string;
  version?: string;
  lastUpdated?: string;
  cachedAt: string;
  valueSet: FhirValueSet;
}

export class TerminologyCache {
  getCodeSystem(url: string): CachedCodeSystemEntry | null {
    if (!canUseStorage()) return null;
    const raw = localStorage.getItem(`${CACHE_PREFIX}codesystem:${url}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedCodeSystemEntry;
    } catch {
      return null;
    }
  }

  setCodeSystem(entry: CachedCodeSystemEntry): void {
    if (!canUseStorage()) return;
    localStorage.setItem(`${CACHE_PREFIX}codesystem:${entry.url}`, JSON.stringify(entry));
  }

  getValueSet(url: string): CachedValueSetEntry | null {
    if (!canUseStorage()) return null;
    const raw = localStorage.getItem(`${CACHE_PREFIX}valueset:${url}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedValueSetEntry;
    } catch {
      return null;
    }
  }

  setValueSet(entry: CachedValueSetEntry): void {
    if (!canUseStorage()) return;
    localStorage.setItem(`${CACHE_PREFIX}valueset:${entry.url}`, JSON.stringify(entry));
  }

  getLastSyncTimestamp(): string | null {
    if (!canUseStorage()) return null;
    const value = localStorage.getItem(LAST_SYNC_KEY);
    return value?.trim() || null;
  }

  setLastSyncTimestamp(value: string): void {
    if (!canUseStorage()) return;
    localStorage.setItem(LAST_SYNC_KEY, value);
  }
}
