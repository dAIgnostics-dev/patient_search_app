import type { FhirBundle, FhirResource } from '../../fhir/types';
import { HealthLakeClient } from '../HealthLakeClient';
import type { FhirClient, FhirReadableResourceType, FhirSearchParams } from './types';

type LegacyResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Condition'
  | 'Practitioner'
  | 'Organization'
  | 'MedicationRequest'
  | 'AllergyIntolerance'
  | 'Procedure'
  | 'DocumentReference'
  | 'ServiceRequest';

function isLegacyResourceType(resourceType: FhirReadableResourceType): resourceType is LegacyResourceType {
  return [
    'Patient',
    'Encounter',
    'Condition',
    'Practitioner',
    'Organization',
    'MedicationRequest',
    'AllergyIntolerance',
    'Procedure',
    'DocumentReference',
    'ServiceRequest',
  ].includes(resourceType);
}

export class HealthLakeFhirClient implements FhirClient {
  constructor(private readonly client: HealthLakeClient = new HealthLakeClient()) {}

  async read<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    id: string,
  ): Promise<TResource | null> {
    if (!isLegacyResourceType(resourceType)) return null;
    return (await this.client.read(resourceType, id)) as TResource | null;
  }

  async search<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<FhirBundle<TResource>> {
    if (!isLegacyResourceType(resourceType)) {
      return { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] };
    }
    return (await this.client.search(resourceType, params)) as FhirBundle<TResource>;
  }

  async searchAll<TResource extends FhirResource = FhirResource>(
    resourceType: FhirReadableResourceType,
    params?: FhirSearchParams,
  ): Promise<TResource[]> {
    if (!isLegacyResourceType(resourceType)) return [];
    return (await this.client.searchAll(resourceType, params)) as TResource[];
  }
}
