/**
 * When enabled, HealthLake reads are limited to CEZIH_BUNDLE_MANIFEST ids
 * (fast demo against a datastore that also has older test data).
 *
 * Set VITE_BUNDLE_SCOPE=false to search the full datastore (slower).
 */
export function isBundleScopeEnabled(): boolean {
  const raw = (import.meta.env.VITE_BUNDLE_SCOPE as string | undefined)?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') return false;
  return true;
}
