import type { FhirPractitioner } from '../../../fhir/types';
import { mapFhirPractitioner } from '../../../mappers/mapFhirPractitioner';
import type { PractitionerDto } from '../../dto';
import type { FhirClient } from '../../fhir-client/types';
import type { ResourceRepository } from '../common';

export class HealthLakePractitionerRepository implements ResourceRepository<PractitionerDto> {
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<PractitionerDto[]> {
    const resources = await this.client.searchAll<FhirPractitioner>('Practitioner', params);
    return resources.map((resource) => {
      const mapped = mapFhirPractitioner(resource);
      return {
        id: resource.id,
        fhirId: mapped.fhirId,
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        hzjzId: mapped.hzjzId,
      };
    });
  }

  async getById(id: string): Promise<PractitionerDto | null> {
    const resource = await this.client.read<FhirPractitioner>('Practitioner', id);
    if (!resource) return null;
    const mapped = mapFhirPractitioner(resource);
    return {
      id: resource.id,
      fhirId: mapped.fhirId,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      hzjzId: mapped.hzjzId,
    };
  }
}
