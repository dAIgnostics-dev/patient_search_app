import { resolveCezihMessageUrl } from '../../config/runtime';
import type { CezihMessageClient } from './cezihMessageClient';
import { CezihHttpMessageClient } from './cezihHttpMessageClient';
import { MockCezihMessageClient } from './mockCezihMessageClient';

const cachedClients = new Map<'case' | 'encounter', CezihMessageClient>();

export function getCezihMessageClient(kind: 'case' | 'encounter' = 'encounter'): CezihMessageClient {
  const cachedClient = cachedClients.get(kind);
  if (cachedClient) return cachedClient;

  const messageUrl = resolveCezihMessageUrl(kind);
  const client = messageUrl ? new CezihHttpMessageClient(messageUrl) : new MockCezihMessageClient();
  cachedClients.set(kind, client);
  return client;
}

/** Reset cached client (useful in tests). */
export function resetCezihMessageClient(): void {
  cachedClients.clear();
}
