export const CEZIH_AUTH_STATUS_URL = '/api/cezih/auth.status';
export const CEZIH_AUTH_CHECK_URL = '/api/cezih/auth.check';
export const CEZIH_APPLICATION_ENDPOINTS = ['CodeSystem.search', 'ValueSet.search', 'notification.pull'];

export const CEZIH_AUTH_ERROR_CODES = ['unconfigured', 'invalid_client', 'invalid_scope',
  'unauthorized_client', 'unsupported_grant_type', 'oauth_rejected', 'invalid_response',
  'unavailable', 'upstream_unauthorized'] as const;
export type CezihAuthErrorCode = typeof CEZIH_AUTH_ERROR_CODES[number];

export interface CezihAuthStatus {
  state: 'unconfigured' | 'ready' | 'fetching' | 'valid' | 'expired' | 'manual' | 'error';
  authMethod: 'client_secret_basic' | 'client_secret_post';
  expiresAt: string | null;
  errorCode: CezihAuthErrorCode | null;
  applicationEndpoints: string[];
}
