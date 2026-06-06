import type {
  AllergyDetail,
  ConditionDetail,
  DocumentDetail,
  EncounterDetail,
  MedicationDetail,
  OrganizationDetail,
  PatientSummary,
  PractitionerDetail,
  PractitionerSummary,
  ProcedureDetail,
  ReferralDetail,
} from '../domain/models';
import { healthlakeApiClient } from './healthlakeApiClient';
import { practitionerDisplayName } from '../utils/practitionerDisplayName';

export async function getPractitionersForPatient(
  patient: PatientSummary,
): Promise<PractitionerSummary[]> {
  return healthlakeApiClient.getPractitionersForPatient(patient);
}

export async function getEncounterDetail(encounterId: string): Promise<EncounterDetail | null> {
  return healthlakeApiClient.getEncounterDetail(encounterId);
}

export async function getConditionDetail(conditionId: string): Promise<ConditionDetail | null> {
  return healthlakeApiClient.getConditionDetail(conditionId);
}

export async function getPractitionerDetail(
  practitionerId: string,
): Promise<PractitionerDetail | null> {
  return healthlakeApiClient.getPractitionerDetail(practitionerId);
}

export async function getOrganizationDetail(
  organizationId: string,
): Promise<OrganizationDetail | null> {
  return healthlakeApiClient.getOrganizationDetail(organizationId);
}

export async function getMedicationDetail(id: string): Promise<MedicationDetail | null> {
  return healthlakeApiClient.getMedicationDetail(id);
}

export async function getAllergyDetail(id: string): Promise<AllergyDetail | null> {
  return healthlakeApiClient.getAllergyDetail(id);
}

export async function getProcedureDetail(id: string): Promise<ProcedureDetail | null> {
  return healthlakeApiClient.getProcedureDetail(id);
}

export async function getDocumentDetail(id: string): Promise<DocumentDetail | null> {
  return healthlakeApiClient.getDocumentDetail(id);
}

export async function getReferralDetail(id: string): Promise<ReferralDetail | null> {
  return healthlakeApiClient.getReferralDetail(id);
}

export { practitionerDisplayName };
