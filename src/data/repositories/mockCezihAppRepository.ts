import type { FhirClient } from '../fhir-client/types';
import { CezihAppRepository } from './cezihAppRepository';

/**
 * Mock CEZIH repository uses the same app-level contract as CEZIH, backed by
 * the local in-memory FHIR client. Replacing the client switches it to real CEZIH.
 */
export class MockCezihAppRepository extends CezihAppRepository {
  constructor(client: FhirClient) {
    super(client);
  }
}
