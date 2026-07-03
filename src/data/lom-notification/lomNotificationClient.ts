import type { LomDocumentSubmittedEvent } from './types';

export interface LomNotificationClient {
  notifyDocumentSubmitted(event: LomDocumentSubmittedEvent): Promise<void>;
}
