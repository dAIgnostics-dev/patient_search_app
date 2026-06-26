import type { FhirBinary } from '../../../fhir/types';
import type { FhirClient } from '../../fhir-client/types';
import type { BinaryDto } from '../../dto';
import type { BinaryRepository } from './types';

export class HealthLakeBinaryRepository implements BinaryRepository {
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<BinaryDto[]> {
    const resources = await this.client.searchAll<FhirBinary>('Binary', params);
    return resources.map((resource) => ({
      id: resource.id,
      fhirId: resource.id,
      contentType: resource.contentType ?? null,
    }));
  }

  async getById(id: string): Promise<BinaryDto | null> {
    const resource = await this.client.read<FhirBinary>('Binary', id);
    if (!resource) return null;
    return {
      id: resource.id,
      fhirId: resource.id,
      contentType: resource.contentType ?? null,
    };
  }
}
