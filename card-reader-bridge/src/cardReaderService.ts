import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { probePkcs11Status, readPkcs11Identity } from './pkcs11Client.js';
import type { BridgeMode, CardIdentity, CardReaderStatus } from './types.js';

export interface CardReaderService {
  getStatus(): Promise<CardReaderStatus>;
  readIdentity(): Promise<CardIdentity | null>;
  mockInsert(cardId: string): void;
  mockRemove(): void;
}

interface MockCardRecord {
  cardId: string;
  givenName?: string;
  familyName?: string;
  oib?: string;
  practitionerId?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');
const mockIdentitiesPath = join(rootDir, 'mock-data', 'card-identities.json');

class MockCardReaderService implements CardReaderService {
  private readerConnected = true;
  private cardPresent = false;
  private readerName = 'Mock Card Reader';
  private cards: MockCardRecord[] = [];
  private activeCardId: string | null = null;

  async init(): Promise<void> {
    const raw = await readFile(mockIdentitiesPath, 'utf8');
    this.cards = JSON.parse(raw) as MockCardRecord[];
  }

  async getStatus(): Promise<CardReaderStatus> {
    return {
      readerConnected: this.readerConnected,
      cardPresent: this.cardPresent,
      readerName: this.readerName,
      bridgeAvailable: true,
      mode: 'mock',
    };
  }

  async readIdentity(): Promise<CardIdentity | null> {
    if (!this.cardPresent || !this.activeCardId) return null;
    const card = this.cards.find((item) => item.cardId === this.activeCardId);
    if (!card) return null;
    return {
      cardId: card.cardId,
      givenName: card.givenName,
      familyName: card.familyName,
      oib: card.oib,
    };
  }

  mockInsert(_cardId: string): void {
    this.cardPresent = true;
    this.activeCardId = _cardId;
  }

  mockRemove(): void {
    this.cardPresent = false;
    this.activeCardId = null;
  }
}

class Pkcs11CardReaderService implements CardReaderService {
  async getStatus(): Promise<CardReaderStatus> {
    return probePkcs11Status();
  }

  async readIdentity(): Promise<CardIdentity | null> {
    return readPkcs11Identity();
  }

  mockInsert(): void {
    throw new Error('mockInsert is only available in mock mode');
  }

  mockRemove(): void {
    throw new Error('mockRemove is only available in mock mode');
  }
}

export function resolveBridgeMode(): BridgeMode {
  const fromEnv = process.env.CARD_READER_MODE?.trim().toLowerCase();
  if (fromEnv === 'mock') return 'mock';
  return 'pkcs11';
}

export async function createCardReaderService(
  mode: BridgeMode = resolveBridgeMode(),
): Promise<CardReaderService> {
  if (mode === 'mock') {
    const service = new MockCardReaderService();
    await service.init();
    return service;
  }
  return new Pkcs11CardReaderService();
}
