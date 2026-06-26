import { resolveCezihMessageUrl } from '../../config/runtime';
import type { CezihMessageClient } from './cezihMessageClient';
import { CezihHttpMessageClient } from './cezihHttpMessageClient';
import { MockCezihMessageClient } from './mockCezihMessageClient';

let cachedClient: CezihMessageClient | null = null;

export function getCezihMessageClient(): CezihMessageClient {
  if (cachedClient) return cachedClient;

  const messageUrl = resolveCezihMessageUrl();
  cachedClient = messageUrl ? new CezihHttpMessageClient(messageUrl) : new MockCezihMessageClient();
  return cachedClient;
}

/** Reset cached client (useful in tests). */
export function resetCezihMessageClient(): void {
  cachedClient = null;
}
