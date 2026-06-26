import type { FhirMessageBundle } from '../../fhir/types';

export interface CezihMessageClient {
  postMessage(bundle: FhirMessageBundle): Promise<FhirMessageBundle>;
}
