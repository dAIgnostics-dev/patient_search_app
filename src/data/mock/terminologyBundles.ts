import terminologyStore from '../../../mock-data/terminology/index.json';
import type { FhirCodeSystem, FhirValueSet } from '../../fhir/terminologyTypes';

type TerminologyMockStore = {
  CodeSystem?: FhirCodeSystem[];
  ValueSet?: FhirValueSet[];
};

const store = terminologyStore as TerminologyMockStore;

export const TERMINOLOGY_MOCK_CODE_SYSTEMS = store.CodeSystem ?? [];
export const TERMINOLOGY_MOCK_VALUE_SETS = store.ValueSet ?? [];
