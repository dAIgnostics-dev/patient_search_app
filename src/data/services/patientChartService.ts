import type { PractitionerSession } from '../../auth/types';
import type {
  ConditionDetail,
  EncounterDetail,
  OrganizationDetail,
  PatientSummary,
  PractitionerDetail,
  PractitionerSummary,
} from '../../domain/models';
import { getAppRepository } from '../repositories/registry';
import { assemblePatientChart } from './stitching/patientChartAssembler';
import type { ClinicianContext, PatientChart } from './types';

function toClinicianContext(session?: PractitionerSession | null): ClinicianContext | null {
  if (!session) return null;
  return {
    clinicianId: session.practitionerId,
    role: 'clinician',
    organizationId: null,
  };
}

export class PatientChartService {
  async getPatientSummaryById(
    _clinicianContext: ClinicianContext | null,
    patientId: string,
  ): Promise<PatientSummary | null> {
    return getAppRepository().getPatientSummaryById(patientId);
  }

  async getPatientChart(
    clinicianContext: ClinicianContext | null,
    patientId: string,
  ): Promise<PatientChart | null> {
    void clinicianContext;
    const detail = await getAppRepository().getPatientDetailById(patientId);
    if (!detail) return null;
    return assemblePatientChart(detail);
  }

  async getPractitionersForPatient(
    clinicianContext: ClinicianContext | null,
    patient: PatientSummary,
  ): Promise<PractitionerSummary[]> {
    void clinicianContext;
    return getAppRepository().getPractitionersForPatient(patient);
  }

  async getEncounterDetail(
    clinicianContext: ClinicianContext | null,
    encounterId: string,
  ): Promise<EncounterDetail | null> {
    void clinicianContext;
    return getAppRepository().getEncounterDetail(encounterId);
  }

  async getConditionDetail(
    clinicianContext: ClinicianContext | null,
    conditionId: string,
  ): Promise<ConditionDetail | null> {
    void clinicianContext;
    return getAppRepository().getConditionDetail(conditionId);
  }

  async getPractitionerDetail(
    clinicianContext: ClinicianContext | null,
    practitionerId: string,
  ): Promise<PractitionerDetail | null> {
    void clinicianContext;
    return getAppRepository().getPractitionerDetail(practitionerId);
  }

  async getOrganizationDetail(
    clinicianContext: ClinicianContext | null,
    organizationId: string,
  ): Promise<OrganizationDetail | null> {
    void clinicianContext;
    return getAppRepository().getOrganizationDetail(organizationId);
  }

  toContext(session?: PractitionerSession | null): ClinicianContext | null {
    return toClinicianContext(session);
  }
}

export const patientChartService = new PatientChartService();
