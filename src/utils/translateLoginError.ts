import type { TranslationKey } from '../i18n/translations';

const SERVER_ERROR_KEYS: Record<string, TranslationKey> = {
  'Invalid username or password.': 'login.invalidCredentials',
  'Username and password are required.': 'login.credentialsRequired',
  'Invalid request body.': 'login.invalidRequest',
  'Login failed': 'login.failed',
  card_not_present: 'cardLogin.errors.cardNotPresent',
  identity_not_available: 'cardLogin.errors.identityNotAvailable',
  bridge_unavailable: 'cardLogin.errors.bridgeUnavailable',
  card_login_failed: 'cardLogin.errors.failed',
  card_identity_mismatch: 'cardLogin.errors.identityMismatch',
  'Name is required.': 'cardLogin.errors.nameRequired',
  'Card is not mapped to a practitioner account.': 'cardLogin.errors.unmappedCard',
};

export type LoginErrorDisplay =
  | { kind: 'key'; key: TranslationKey }
  | { kind: 'raw'; message: string };

export function parseLoginError(err: unknown): LoginErrorDisplay {
  const message = err instanceof Error ? err.message.trim() : '';
  const key = SERVER_ERROR_KEYS[message];
  if (key) return { kind: 'key', key };
  if (message) return { kind: 'raw', message };
  return { kind: 'key', key: 'cardLogin.errors.failed' };
}
