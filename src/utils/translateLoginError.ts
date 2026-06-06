import type { TranslationKey } from '../i18n/translations';

const SERVER_ERROR_KEYS: Record<string, TranslationKey> = {
  'Invalid username or password.': 'login.invalidCredentials',
  'Username and password are required.': 'login.credentialsRequired',
  'Invalid request body.': 'login.invalidRequest',
  'Login failed': 'login.failed',
};

export type LoginErrorDisplay =
  | { kind: 'key'; key: TranslationKey }
  | { kind: 'raw'; message: string };

export function parseLoginError(err: unknown): LoginErrorDisplay {
  const message = err instanceof Error ? err.message.trim() : '';
  const key = SERVER_ERROR_KEYS[message];
  if (key) return { kind: 'key', key };
  if (message) return { kind: 'raw', message };
  return { kind: 'key', key: 'login.failed' };
}
