import mockStore from '../../../mock-data/cezih-fhir-store.json';
import type { FhirResource } from '../../fhir/types';
import type { FhirReadableResourceType } from '../fhir-client/types';

export const CEZIH_MOCK_BUNDLES =
  mockStore as Partial<Record<FhirReadableResourceType, FhirResource[]>>;
