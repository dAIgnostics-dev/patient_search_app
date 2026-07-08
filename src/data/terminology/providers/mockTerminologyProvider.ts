import { CezihTerminologyProvider } from './cezihTerminologyProvider';

/**
 * Mock provider currently reuses repository-backed lookup.
 * In local dev this resolves to Mock CEZIH client when CEZIH base URL is not configured.
 */
export class MockTerminologyProvider extends CezihTerminologyProvider {}
