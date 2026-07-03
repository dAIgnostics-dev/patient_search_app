import type { LomNotificationClient } from './lomNotificationClient';
import type { LomDocumentSubmittedEvent } from './types';

const LOM_NOTIFICATIONS_URL = '/api/lom-notifications';

export class MockLomNotificationClient implements LomNotificationClient {
  static capturedEvents: LomDocumentSubmittedEvent[] = [];

  async notifyDocumentSubmitted(event: LomDocumentSubmittedEvent): Promise<void> {
    MockLomNotificationClient.capturedEvents.push(event);

    if (typeof fetch === 'undefined') return;

    try {
      await fetch(LOM_NOTIFICATIONS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
    } catch {
      // Dev middleware may be unavailable outside Vite.
    }
  }

  static reset(): void {
    MockLomNotificationClient.capturedEvents = [];
  }
}
