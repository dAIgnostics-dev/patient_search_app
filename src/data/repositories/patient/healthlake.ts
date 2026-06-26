import type { FhirPatient } from '../../../fhir/types';
import { mapFhirPatient } from '../../../mappers/mapFhirPatient';
import type { FhirClient } from '../../fhir-client/types';
import type { PatientDto } from '../../dto';
import type { PatientRepository } from './types';

export class HealthLakePatientRepository implements PatientRepository {
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<PatientDto[]> {
    const resources = await this.client.searchAll<FhirPatient>('Patient', params);
    return resources.map((resource) => this.toDto(resource));
  }

  async getById(id: string): Promise<PatientDto | null> {
    const resource = await this.client.read<FhirPatient>('Patient', id);
    return resource ? this.toDto(resource) : null;
  }

  private toDto(resource: FhirPatient): PatientDto {
    const mapped = mapFhirPatient(resource);
    return {
      id: resource.id,
      fhirId: mapped.fhirId,
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      birthDate: mapped.birthDate,
      gender: mapped.gender,
      mbo: mapped.mbo,
    };
  }
}
