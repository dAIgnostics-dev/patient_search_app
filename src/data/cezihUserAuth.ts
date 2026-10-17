import { CEZIH_USER_AUTH_BASE, type CezihUserAuthAction, type CezihUserAuthStatus } from '../config/cezihUserAuth';
import { cezihFetch } from './fhir-client/cezihFetch';

export async function cezihUserAuth(action: CezihUserAuthAction = 'status', body?: Record<string, unknown>): Promise<CezihUserAuthStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await cezihFetch(CEZIH_USER_AUTH_BASE + action, {
      method: action === 'status' ? 'GET' : 'POST', credentials: 'same-origin', signal: controller.signal,
      headers: { Accept: 'application/json', ...(action !== 'status' ? { 'X-CEZIH-User-Action': '1' } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (![200, 401, 403, 501].includes(response.status)) throw new Error('CEZIH user session request failed.');
    const status = await response.json() as CezihUserAuthStatus;
    if (!status || !['live', 'simulation'].includes(status.mode) ||
      !['signed-out', 'pending', 'authenticated', 'expired', 'cancelled', 'card-unavailable', 'denied', 'not-configured'].includes(status.state) ||
      (status.user !== null && (!status.user || typeof status.user.subject !== 'string' || typeof status.user.displayName !== 'string' ||
        !Array.isArray(status.user.roles) || !status.user.roles.every((role) => typeof role === 'string'))) ||
      (status.expiresAt !== null && !Number.isFinite(Date.parse(status.expiresAt))) ||
      (status.challenge !== null && !/^[a-f0-9]{64}$/.test(status.challenge)) ||
      (status.check !== null && !['allowed', 'denied', 'requires-login'].includes(status.check))) {
      throw new Error('Invalid CEZIH user session status.');
    }
    return status;
  } finally { clearTimeout(timeout); }
}
