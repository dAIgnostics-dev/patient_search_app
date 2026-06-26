import { getAppRepository } from '../repositories/registry';
import type {
  ClinicianContext,
  PatientSearchByNameQuery,
  PatientSearchServiceContract,
} from './types';
import type { PatientSummary } from '../../domain/models';

function normalizeNameQuery(query: PatientSearchByNameQuery): {
  firstName?: string;
  lastName?: string;
} {
  return {
    firstName: query.firstName?.trim() || undefined,
    lastName: query.lastName?.trim() || undefined,
  };
}

export class PatientSearchService implements PatientSearchServiceContract {
  async findPatientByMbo(
    _clinicianContext: ClinicianContext | null,
    mbo: string,
  ): Promise<PatientSummary | null> {
    return getAppRepository().findPatientByMbo(mbo);
  }

  async findPatientsByName(
    _clinicianContext: ClinicianContext | null,
    query: PatientSearchByNameQuery,
  ): Promise<PatientSummary[]> {
    const normalized = normalizeNameQuery(query);
    if (!normalized.firstName && !normalized.lastName) return [];
    return getAppRepository().searchPatients({
      firstName: normalized.firstName,
      lastName: normalized.lastName,
    });
  }
}

export const patientSearchService = new PatientSearchService();
