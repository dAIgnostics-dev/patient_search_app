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
} from '../../domain/models';

export type PatientDto = PatientSummary;
export type PatientDetailDto = PatientDetail;
export type PractitionerDto = PractitionerSummary;
export type PractitionerDetailDto = PractitionerDetail;
export type OrganizationDto = OrganizationDetail;
export type EncounterDto = EncounterDetail;
export type ConditionDto = ConditionDetail;
export type MedicationDto = MedicationDetail;
export type AllergyDto = AllergyDetail;
export type ProcedureDto = ProcedureDetail;
export type DocumentReferenceDto = DocumentDetail;
export type ReferralDto = ReferralDetail;

export interface DiagnosticReportDto {
  id: string;
  fhirId: string;
  status?: string | null;
}

export interface ImagingStudyDto {
  id: string;
  fhirId: string;
  status?: string | null;
}

export interface BinaryDto {
  id: string;
  fhirId: string;
  contentType?: string | null;
}
