import type { FhirOrganization } from '../../../fhir/types';
import { mapFhirOrganization } from '../../../mappers/mapFhirOrganization';
import type { OrganizationDto } from '../../dto';
import type { FhirClient } from '../../fhir-client/types';
import type { ResourceRepository } from '../common';

export class HealthLakeOrganizationRepository implements ResourceRepository<OrganizationDto> {
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<OrganizationDto[]> {
    const resources = await this.client.searchAll<FhirOrganization>('Organization', params);
    return resources.map((resource) => {
      const mapped = mapFhirOrganization(resource);
      return {
        id: resource.id,
        fhirId: mapped.fhirId,
        name: mapped.name,
        hzzoCode: mapped.hzzoCode,
      };
    });
  }

  async getById(id: string): Promise<OrganizationDto | null> {
    const resource = await this.client.read<FhirOrganization>('Organization', id);
    if (!resource) return null;
    const mapped = mapFhirOrganization(resource);
    return {
      id: resource.id,
      fhirId: mapped.fhirId,
      name: mapped.name,
      hzzoCode: mapped.hzzoCode,
    };
  }
}
