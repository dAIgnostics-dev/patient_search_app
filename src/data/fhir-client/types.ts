import type { FhirBundle, FhirResource } from '../../fhir/types';

export type FhirSearchParams = Record<string, string | undefined>;

export type FhirReadableResourceType =
  | 'Patient'
  | 'Practitioner'
  | 'Organization'
  | 'Encounter'
  | 'Condition'
  | 'DocumentReference'
  | 'DiagnosticReport'
  | 'ImagingStudy'
  | 'Binary'
  | 'MedicationRequest'
  | 'AllergyIntolerance'
  | 'Procedure'
  | 'ServiceRequest'
  | 'PractitionerRole'
  | 'HealthcareService'
  | 'Location'
  | 'Endpoint'
  | 'ValueSet'
  | 'CodeSystem';

export interface FhirClient {
  read<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    id: string,
  ): Promise<TResource | null>;
  search<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<FhirBundle<TResource>>;
  searchAll<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<TResource[]>;
}
