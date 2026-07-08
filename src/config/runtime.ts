import outputs from '../../amplify_outputs.json';

type AmplifyOutputs = {
  custom?: {
    healthlakeApiUrl?: string;
    authApiUrl?: string;
    auditApiUrl?: string;
  };
};

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveFromOutputs(key: keyof NonNullable<AmplifyOutputs['custom']>): string | null {
  const value = (outputs as AmplifyOutputs).custom?.[key]?.trim();
  return value ? trimTrailingSlash(value) : null;
}

/**
 * FHIR proxy base URL.
 * 1. VITE_API_BASE_URL — explicit override
 * 2. amplify_outputs.json — after `npm run sandbox` in this project
 * 3. http://localhost:8787 — local mock fallback
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  const fromOutputs = resolveFromOutputs('healthlakeApiUrl');
  if (fromOutputs) return fromOutputs;

  return 'http://localhost:8787';
}

/**
 * Auth proxy base URL.
 * 1. VITE_AUTH_API_URL — explicit override
 * 2. amplify_outputs.json — deployed auth-proxy Function URL
 * 3. null — use Vite dev middleware at /api/auth/*
 */
export function resolveAuthApiBaseUrl(): string | null {
  const fromEnv = (import.meta.env.VITE_AUTH_API_URL as string | undefined)?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  return resolveFromOutputs('authApiUrl');
}

/**
 * Audit proxy base URL.
 * 1. VITE_AUDIT_API_URL — explicit override
 * 2. amplify_outputs.json — deployed audit-proxy Function URL
 * 3. null — use Vite dev middleware at /api/audit/*
 */
export function resolveAuditApiBaseUrl(): string | null {
  const fromEnv = (import.meta.env.VITE_AUDIT_API_URL as string | undefined)?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);

  return resolveFromOutputs('auditApiUrl');
}

export function resolveAuthLoginUrl(): string {
  const base = resolveAuthApiBaseUrl();
  return base ? `${base}/login` : '/api/auth/login';
}

export function resolveAuditAccessUrl(): string {
  const base = resolveAuditApiBaseUrl();
  return base ? `${base}/access` : '/api/audit/access';
}

export const API_BASE_URL = resolveApiBaseUrl();

/**
 * CEZIH FHIR base URL placeholder.
 * When unset, CEZIH repositories can fall back to mock providers.
 */
export function resolveCezihApiBaseUrl(): string | null {
  const fromEnv = (import.meta.env.VITE_CEZIH_API_BASE_URL as string | undefined)?.trim();
  return fromEnv ? trimTrailingSlash(fromEnv) : null;
}

/** CEZIH FHIR message endpoint for encounter management (POST). */
export function resolveCezihMessageUrl(): string | null {
  const fromEnv = (import.meta.env.VITE_CEZIH_MESSAGE_URL as string | undefined)?.trim();
  return fromEnv ? trimTrailingSlash(fromEnv) : null;
}

/** CEZIH MHD endpoint for clinical document exchange (ITI-65/67/68). */
export function resolveCezihMhdUrl(): string | null {
  const fromEnv = (import.meta.env.VITE_CEZIH_MHD_URL as string | undefined)?.trim();
  return fromEnv ? trimTrailingSlash(fromEnv) : null;
}

/** MessageHeader.source.endpoint for outbound CEZIH messages. */
export function resolveCezihSourceEndpoint(): string {
  const fromEnv = (import.meta.env.VITE_CEZIH_SOURCE_ENDPOINT as string | undefined)?.trim();
  return fromEnv || 'urn:oid:1.2.3.4.5.6';
}

/** Default HZZO organization code for POC encounter forms. */
export function resolveCezihDefaultOrgHzzo(): string {
  const fromEnv = (import.meta.env.VITE_CEZIH_DEFAULT_ORG_HZZO as string | undefined)?.trim();
  return fromEnv || '1234';
}

export type TerminologyProviderMode = 'cezih' | 'mock' | 'static';

export function resolveTerminologyProviderMode(): TerminologyProviderMode {
  const fromEnv = (import.meta.env.VITE_TERMINOLOGY_PROVIDER as string | undefined)?.trim().toLowerCase();
  if (fromEnv === 'cezih' || fromEnv === 'mock' || fromEnv === 'static') {
    return fromEnv;
  }
  return resolveCezihApiBaseUrl() ? 'cezih' : 'mock';
}

export {
  resolveDocumentEditWindowMs,
  resolveLomNotificationUrl,
} from './cezihDocumentPolicy';
