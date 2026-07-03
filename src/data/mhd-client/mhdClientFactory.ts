import { resolveCezihMhdUrl } from '../../config/runtime';
import type { MhdClient } from './mhdClient';
import { CezihMhdClient } from './cezihMhdClient';
import { MockMhdClient } from './mockMhdClient';

let cachedClient: MhdClient | null = null;

export function getMhdClient(): MhdClient {
  if (cachedClient) return cachedClient;

  const mhdUrl = resolveCezihMhdUrl();
  cachedClient = mhdUrl ? new CezihMhdClient(mhdUrl) : new MockMhdClient();
  return cachedClient;
}

/** Reset cached client (useful in tests). */
export function resetMhdClient(): void {
  cachedClient = null;
}
