import type { PractitionerSession } from '../../auth/types';
import type {
  AllergyDetail,
  ConditionDetail,
  DocumentDetail,
  EncounterDetail,
  MedicationDetail,
  OrganizationDetail,
  PatientDetail,
  PatientSearchQuery,
  PatientSummary,
  PractitionerDetail,
  PractitionerSummary,
  ProcedureDetail,
  ReferralDetail,
} from '../../domain/models';
import { healthlakeApiClient } from '../healthlakeApiClient';
import {
  findPatientByMboLegacy,
  getPatientsForPractitionerLegacy,
  type PractitionerPatientSummary,
} from '../legacy/practitionerPatientsLegacy';
import type { AppRepository } from './appRepository';

export class HealthLakeAppRepository implements AppRepository {
  searchPatients(query: PatientSearchQuery): Promise<PatientSummary[]> {
    return healthlakeApiClient.searchPatients(query);
  }

  getPatientSummaryById(id: string): Promise<PatientSummary | null> {
    return healthlakeApiClient.getPatientSummaryById(id);
  }

  getPatientDetailById(id: string): Promise<PatientDetail | null> {
    return healthlakeApiClient.getPatientDetailById(id);
  }

  getPatientsForPractitioner(session: PractitionerSession): Promise<PractitionerPatientSummary[]> {
    return getPatientsForPractitionerLegacy(session);
  }

  findPatientByMbo(mbo: string): Promise<PatientSummary | null> {
    return findPatientByMboLegacy(mbo);
  }

  getPractitionersForPatient(patient: PatientSummary): Promise<PractitionerSummary[]> {
    return healthlakeApiClient.getPractitionersForPatient(patient);
  }

  getEncounterDetail(id: string): Promise<EncounterDetail | null> {
    return healthlakeApiClient.getEncounterDetail(id);
  }

  getConditionDetail(id: string): Promise<ConditionDetail | null> {
    return healthlakeApiClient.getConditionDetail(id);
  }

  getPractitionerDetail(id: string): Promise<PractitionerDetail | null> {
    return healthlakeApiClient.getPractitionerDetail(id);
  }

  getOrganizationDetail(id: string): Promise<OrganizationDetail | null> {
    return healthlakeApiClient.getOrganizationDetail(id);
  }

  getMedicationDetail(id: string): Promise<MedicationDetail | null> {
    return healthlakeApiClient.getMedicationDetail(id);
  }

  getAllergyDetail(id: string): Promise<AllergyDetail | null> {
    return healthlakeApiClient.getAllergyDetail(id);
  }

  getProcedureDetail(id: string): Promise<ProcedureDetail | null> {
    return healthlakeApiClient.getProcedureDetail(id);
  }

  getDocumentDetail(id: string): Promise<DocumentDetail | null> {
    return healthlakeApiClient.getDocumentDetail(id);
  }

  getReferralDetail(id: string): Promise<ReferralDetail | null> {
    return healthlakeApiClient.getReferralDetail(id);
  }
}
