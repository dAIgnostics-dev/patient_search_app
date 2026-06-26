import type { FhirEncounter } from '../../../fhir/types';
import { mapFhirEncounter } from '../../../mappers/mapFhirEncounter';
import type { EncounterDto } from '../../dto';
import type { FhirClient } from '../../fhir-client/types';
import type { ResourceRepository } from '../common';

export class HealthLakeEncounterRepository implements ResourceRepository<EncounterDto> {
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<EncounterDto[]> {
    const resources = await this.client.searchAll<FhirEncounter>('Encounter', params);
    return resources.map((resource) => {
      const mapped = mapFhirEncounter(resource);
      return {
        id: resource.id ?? mapped.fhirId,
        fhirId: mapped.fhirId,
        status: mapped.status,
        start: mapped.start,
        end: mapped.end,
        classCode: mapped.classCode,
        classDisplay: mapped.classDisplay,
        visitId: mapped.visitId,
        practitionerFhirId: mapped.practitionerFhirId,
        organizationFhirId: mapped.organizationFhirId,
      };
    });
  }

  async getById(id: string): Promise<EncounterDto | null> {
    const items = await this.search({ _id: id });
    return items.find((item) => item.id === id) ?? null;
  }
}
