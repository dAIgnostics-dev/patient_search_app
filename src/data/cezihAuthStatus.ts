import { CEZIH_AUTH_CHECK_URL, CEZIH_AUTH_STATUS_URL, CEZIH_AUTH_ERROR_CODES, type CezihAuthStatus } from '../config/cezihOAuth';
import { cezihFetch } from './fhir-client/cezihFetch';

export async function getCezihAuthStatus(check = false): Promise<CezihAuthStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await cezihFetch(check ? CEZIH_AUTH_CHECK_URL : CEZIH_AUTH_STATUS_URL, {
      method: check ? 'POST' : 'GET', credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('CEZIH authentication status is unavailable.');
    const status = await response.json() as CezihAuthStatus;
    if (!status || !['unconfigured', 'ready', 'fetching', 'valid', 'expired', 'manual', 'error'].includes(status.state) ||
      !['client_secret_basic', 'client_secret_post'].includes(status.authMethod) ||
      (status.errorCode !== null && !CEZIH_AUTH_ERROR_CODES.includes(status.errorCode)) ||
      !Array.isArray(status.applicationEndpoints) || !status.applicationEndpoints.every((id) => typeof id === 'string') ||
      (status.expiresAt !== null && (typeof status.expiresAt !== 'string' || !Number.isFinite(Date.parse(status.expiresAt))))) {
      throw new Error('Invalid CEZIH authentication status.');
    }
    return status;
  } finally { clearTimeout(timeout); }
}
