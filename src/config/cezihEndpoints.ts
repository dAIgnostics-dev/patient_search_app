import endpoints from './cezihCertEndpoints.json';

export const CEZIH_CERT_ENDPOINTS = endpoints;

export function resolveCezihMode(): 'mock' | 'cert-offline' | 'cert-live' {
  const value = import.meta.env?.VITE_CEZIH_MODE ??
    (typeof process !== 'undefined' ? process.env.VITE_CEZIH_MODE : undefined);
  if (value && value !== 'mock' && value !== 'cert-offline' && value !== 'cert-live') {
    throw new Error('VITE_CEZIH_MODE must be mock, cert-offline or cert-live.');
  }
  return value === 'cert-offline' || value === 'cert-live' ? value : 'mock';
}

export function getCezihEndpoint(id: string) {
  const endpoint = CEZIH_CERT_ENDPOINTS.find((item) => item.id === id);
  if (!endpoint) throw new Error(`CEZIH endpoint is not listed: ${id}`);
  return endpoint;
}

export function cezihProxyUrl(id: string): string {
  getCezihEndpoint(id);
  return `/api/cezih/${id}`;
}

export function resolveCezihResourceUrl(resourceType: string, operation = 'search'): string {
  return cezihProxyUrl(`${resourceType}.${operation}`);
}

export function cezihNextPageUrl(id: string, next: string): string {
  const expected = new URL(getCezihEndpoint(id).url);
  const url = new URL(next, expected);
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password || url.hash) {
    throw new Error('CEZIH pagination link points outside the configured endpoint.');
  }
  return `${cezihProxyUrl(id)}${url.search}`;
}
