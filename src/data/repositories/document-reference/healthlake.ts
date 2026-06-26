import type { FhirDocumentReference } from '../../../fhir/types';
import { mapFhirDocumentReference } from '../../../mappers/mapFhirDocumentReference';
import type { DocumentReferenceDto } from '../../dto';
import type { FhirClient } from '../../fhir-client/types';
import type { ResourceRepository } from '../common';

export class HealthLakeDocumentReferenceRepository
  implements ResourceRepository<DocumentReferenceDto>
{
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<DocumentReferenceDto[]> {
    const resources = await this.client.searchAll<FhirDocumentReference>('DocumentReference', params);
    return resources.map((resource) => {
      const mapped = mapFhirDocumentReference(resource);
      return {
        id: resource.id,
        fhirId: mapped.fhirId,
        status: mapped.status,
        typeDisplay: mapped.typeDisplay,
        typeCode: mapped.typeCode,
        category: mapped.category,
        date: mapped.date,
        description: mapped.description,
        contentType: mapped.contentType,
      };
    });
  }

  async getById(id: string): Promise<DocumentReferenceDto | null> {
    const items = await this.search({ _id: id });
    return items.find((item) => item.id === id) ?? null;
  }
}
