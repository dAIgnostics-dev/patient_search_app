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
import type { PractitionerPatientSummary } from '../practitionerPatients';

export interface AppRepository {
  searchPatients(query: PatientSearchQuery): Promise<PatientSummary[]>;
  getPatientSummaryById(id: string): Promise<PatientSummary | null>;
  getPatientDetailById(id: string): Promise<PatientDetail | null>;
  getPatientsForPractitioner(session: PractitionerSession): Promise<PractitionerPatientSummary[]>;
  findPatientByMbo(mbo: string): Promise<PatientSummary | null>;
  getPractitionersForPatient(patient: PatientSummary): Promise<PractitionerSummary[]>;
  getEncounterDetail(id: string): Promise<EncounterDetail | null>;
  getConditionDetail(id: string): Promise<ConditionDetail | null>;
  getPractitionerDetail(id: string): Promise<PractitionerDetail | null>;
  getOrganizationDetail(id: string): Promise<OrganizationDetail | null>;
  getMedicationDetail(id: string): Promise<MedicationDetail | null>;
  getAllergyDetail(id: string): Promise<AllergyDetail | null>;
  getProcedureDetail(id: string): Promise<ProcedureDetail | null>;
  getDocumentDetail(id: string): Promise<DocumentDetail | null>;
  getReferralDetail(id: string): Promise<ReferralDetail | null>;
}
