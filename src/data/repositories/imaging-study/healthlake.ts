import type { FhirImagingStudy } from '../../../fhir/types';
import type { ImagingStudyDto } from '../../dto';
import type { FhirClient } from '../../fhir-client/types';
import type { ResourceRepository } from '../common';

export class HealthLakeImagingStudyRepository implements ResourceRepository<ImagingStudyDto> {
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<ImagingStudyDto[]> {
    const resources = await this.client.searchAll<FhirImagingStudy>('ImagingStudy', params);
    return resources.map((resource) => ({
      id: resource.id,
      fhirId: resource.id,
      status: resource.status ?? null,
    }));
  }

  async getById(id: string): Promise<ImagingStudyDto | null> {
    const resource = await this.client.read<FhirImagingStudy>('ImagingStudy', id);
    if (!resource) return null;
    return { id: resource.id, fhirId: resource.id, status: resource.status ?? null };
  }
}
