import type {
  AllergyDetail,
  ConditionDetail,
  DocumentDetail,
  EncounterDetail,
  MedicationDetail,
  OrganizationDetail,
  PatientDetail,
  PatientSummary,
  PractitionerDetail,
  PractitionerSummary,
  ProcedureDetail,
  ReferralDetail,
} from '../domain/models';
import { getAppRepository } from './repositories/registry';
import { patientChartService } from './services/patientChartService';
import { practitionerDisplayName } from '../utils/practitionerDisplayName';

export async function getPractitionersForPatient(
  patient: PatientSummary,
): Promise<PractitionerSummary[]> {
  return patientChartService.getPractitionersForPatient(null, patient);
}

export async function getPatientChart(patientId: string): Promise<PatientDetail | null> {
  return patientChartService.getPatientChart(null, patientId);
}

export async function getEncounterDetail(encounterId: string): Promise<EncounterDetail | null> {
  return getAppRepository().getEncounterDetail(encounterId);
}

export async function getConditionDetail(conditionId: string): Promise<ConditionDetail | null> {
  return getAppRepository().getConditionDetail(conditionId);
}

export async function getPractitionerDetail(
  practitionerId: string,
): Promise<PractitionerDetail | null> {
  return getAppRepository().getPractitionerDetail(practitionerId);
}

export async function getOrganizationDetail(
  organizationId: string,
): Promise<OrganizationDetail | null> {
  return getAppRepository().getOrganizationDetail(organizationId);
}

export async function getMedicationDetail(id: string): Promise<MedicationDetail | null> {
  return getAppRepository().getMedicationDetail(id);
}

export async function getAllergyDetail(id: string): Promise<AllergyDetail | null> {
  return getAppRepository().getAllergyDetail(id);
}

export async function getProcedureDetail(id: string): Promise<ProcedureDetail | null> {
  return getAppRepository().getProcedureDetail(id);
}

export async function getDocumentDetail(id: string): Promise<DocumentDetail | null> {
  return getAppRepository().getDocumentDetail(id);
}

export async function getReferralDetail(id: string): Promise<ReferralDetail | null> {
  return getAppRepository().getReferralDetail(id);
}

export { practitionerDisplayName };
