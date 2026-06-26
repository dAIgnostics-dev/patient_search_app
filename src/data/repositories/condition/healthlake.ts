import type { FhirCondition } from '../../../fhir/types';
import { mapFhirCondition } from '../../../mappers/mapFhirCondition';
import type { ConditionDto } from '../../dto';
import type { FhirClient } from '../../fhir-client/types';
import type { ResourceRepository } from '../common';

export class HealthLakeConditionRepository implements ResourceRepository<ConditionDto> {
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<ConditionDto[]> {
    const resources = await this.client.searchAll<FhirCondition>('Condition', params);
    return resources.map((resource) => {
      const mapped = mapFhirCondition(resource);
      return {
        id: resource.id ?? mapped.fhirId,
        fhirId: mapped.fhirId,
        icd10Code: mapped.icd10Code,
        display: mapped.display,
        clinicalStatus: mapped.clinicalStatus,
        verificationStatus: mapped.verificationStatus,
        caseId: mapped.caseId,
        onsetDate: mapped.onsetDate,
        abatementDate: mapped.abatementDate,
        recordedDate: mapped.recordedDate,
        encounterVisitId: mapped.encounterVisitId,
        asserterHzjzId: mapped.asserterHzjzId,
        recorderHzjzId: mapped.recorderHzjzId,
        note: mapped.note,
      };
    });
  }

  async getById(id: string): Promise<ConditionDto | null> {
    const items = await this.search({ _id: id });
    return items.find((item) => item.id === id) ?? null;
  }
}
