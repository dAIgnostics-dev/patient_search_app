import { resolveLomNotificationUrl } from '../../config/cezihDocumentPolicy';
import type { LomNotificationClient } from './lomNotificationClient';
import { MockLomNotificationClient } from './mockLomNotificationClient';
import type { LomDocumentSubmittedEvent } from './types';

class HttpLomNotificationClient implements LomNotificationClient {
  constructor(private readonly baseUrl: string) {}

  async notifyDocumentSubmitted(event: LomDocumentSubmittedEvent): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      throw new Error(`LOM notification failed (${response.status}).`);
    }
  }
}

let cachedClient: LomNotificationClient | null = null;

export function getLomNotificationClient(): LomNotificationClient {
  if (cachedClient) return cachedClient;

  const url = resolveLomNotificationUrl();
  cachedClient = url ? new HttpLomNotificationClient(url) : new MockLomNotificationClient();
  return cachedClient;
}

export function resetLomNotificationClient(): void {
  cachedClient = null;
}
