export type BridgeMode = 'mock' | 'pkcs11';

export interface CardReaderStatus {
  readerConnected: boolean;
  cardPresent: boolean;
  readerName?: string;
  bridgeAvailable: boolean;
  mode: BridgeMode;
  pkcs11Configured?: boolean;
}

export interface CardIdentity {
  cardId?: string;
  givenName?: string;
  familyName?: string;
  oib?: string;
  certificateSubject?: string;
}
