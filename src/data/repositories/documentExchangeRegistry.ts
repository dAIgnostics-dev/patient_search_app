import { resolveCezihMhdUrl } from '../../config/runtime';
import { getMhdClient } from '../mhd-client/mhdClientFactory';
import type { DocumentExchangeRepository } from './document-exchange/documentExchangeRepository';
import {
  CezihDocumentExchangeRepository,
  MockDocumentExchangeRepository,
} from './document-exchange/baseDocumentExchangeRepository';

let cachedRepository: DocumentExchangeRepository | null = null;

export function getDocumentExchangeRepository(): DocumentExchangeRepository {
  if (cachedRepository) return cachedRepository;

  const mhdUrl = resolveCezihMhdUrl();
  cachedRepository = mhdUrl
    ? new CezihDocumentExchangeRepository(getMhdClient())
    : new MockDocumentExchangeRepository();
  return cachedRepository;
}

/** Reset cached repository (useful in tests). */
export function resetDocumentExchangeRepository(): void {
  cachedRepository = null;
}
