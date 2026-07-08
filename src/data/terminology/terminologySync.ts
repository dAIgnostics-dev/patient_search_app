import type { TerminologyProvider, TerminologySyncResult } from './types';
import type { TerminologyCache } from './terminologyCache';

export interface TerminologySyncOptions {
  lastUpdatedAfter?: string;
}

export async function syncCodeSystems(
  provider: TerminologyProvider,
  cache: TerminologyCache,
  options: TerminologySyncOptions = {},
): Promise<TerminologySyncResult> {
  const cachedSyncTime = cache.getLastSyncTimestamp();
  const lastUpdatedAfter = options.lastUpdatedAfter ?? cachedSyncTime ?? undefined;

  const codeSystems = await provider.queryCodeSystems({ lastUpdatedAfter });
  const cachedAt = new Date().toISOString();

  let updated = 0;
  for (const codeSystem of codeSystems) {
    const url = codeSystem.url?.trim();
    if (!url) continue;
    cache.setCodeSystem({
      url,
      version: codeSystem.version,
      lastUpdated: codeSystem.meta?.lastUpdated,
      cachedAt,
      codeSystem,
    });
    updated += 1;
  }

  cache.setLastSyncTimestamp(cachedAt);

  return {
    fetched: codeSystems.length,
    updated,
    cachedAt,
  };
}
