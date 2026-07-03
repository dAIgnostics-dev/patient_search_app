import mockStore from '../../../mock-data/cezih-fhir-store.json';
import type { FhirBinary, FhirClinicalDocumentBundle, FhirResource } from '../../fhir/types';
import type { FhirReadableResourceType } from '../fhir-client/types';

export type CezihMockStorage = Partial<Record<FhirReadableResourceType, FhirResource[]>> & {
  DocumentBundle?: FhirClinicalDocumentBundle[];
  Binary?: FhirBinary[];
};

export const CEZIH_MOCK_STORAGE = mockStore as CezihMockStorage;

export const CEZIH_MOCK_BUNDLES =
  CEZIH_MOCK_STORAGE as Partial<Record<FhirReadableResourceType, FhirResource[]>>;
