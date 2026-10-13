/** CEZIH credentials and upstream transport belong on the server. */
export function cezihFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!url.startsWith('/api/cezih/') || url.includes('\\') || url.includes('#')) {
    throw new Error('Direct CEZIH network access is disabled; use the local CEZIH gateway.');
  }
  return fetch(url, { ...init, redirect: 'error' });
}
