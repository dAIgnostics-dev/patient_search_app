import type { FhirDiagnosticReport } from '../../../fhir/types';
import type { DiagnosticReportDto } from '../../dto';
import type { FhirClient } from '../../fhir-client/types';
import type { ResourceRepository } from '../common';

export class HealthLakeDiagnosticReportRepository
  implements ResourceRepository<DiagnosticReportDto>
{
  constructor(private readonly client: FhirClient) {}

  async search(params?: Record<string, string | undefined>): Promise<DiagnosticReportDto[]> {
    const resources = await this.client.searchAll<FhirDiagnosticReport>('DiagnosticReport', params);
    return resources.map((resource) => ({
      id: resource.id,
      fhirId: resource.id,
      status: resource.status ?? null,
    }));
  }

  async getById(id: string): Promise<DiagnosticReportDto | null> {
    const resource = await this.client.read<FhirDiagnosticReport>('DiagnosticReport', id);
    if (!resource) return null;
    return { id: resource.id, fhirId: resource.id, status: resource.status ?? null };
  }
}
