/** Domain / frontend patient model (mapped from FHIR). */
export interface PatientSummary {
  id: string;
  fhirId: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  gender?: string | null;
  mbo?: string | null;
  /** From most recent encounter (for search result context). */
  primaryPractitionerName?: string | null;
  primaryOrganizationName?: string | null;
}

/** Alias for readability in provider interfaces. */
export type Patient = PatientSummary;

export interface MedicationSummary {
  id: string;
  fhirId: string;
  status?: string | null;
  intent?: string | null;
  display?: string | null;
  code?: string | null;
  authoredOn?: string | null;
  dosage?: string | null;
  note?: string | null;
}

export type MedicationDetail = MedicationSummary;

export interface AllergySummary {
  id: string;
  fhirId: string;
  display?: string | null;
  code?: string | null;
  clinicalStatus?: string | null;
  verificationStatus?: string | null;
  type?: string | null;
  category?: string | null;
  criticality?: string | null;
  onsetDate?: string | null;
  note?: string | null;
}

export type AllergyDetail = AllergySummary;

export interface ProcedureSummary {
  id: string;
  fhirId: string;
  status?: string | null;
  display?: string | null;
  code?: string | null;
  performedDate?: string | null;
  note?: string | null;
}

export type ProcedureDetail = ProcedureSummary;

export interface DocumentSummary {
  id: string;
  fhirId: string;
  status?: string | null;
  typeDisplay?: string | null;
  typeCode?: string | null;
  category?: string | null;
  date?: string | null;
  description?: string | null;
  contentType?: string | null;
  documentId?: string | null;
  compositionStatus?: string | null;
  title?: string | null;
  encounterVisitId?: string | null;
  caseId?: string | null;
  caseDisplay?: string | null;
  authorHzjzId?: string | null;
  authorName?: string | null;
  organizationHzzoCode?: string | null;
  organizationName?: string | null;
  healthcareServiceName?: string | null;
  hasSignature?: boolean | null;
  attachmentCount?: number | null;
  anamnesisPreview?: string | null;
  outcomeDisplay?: string | null;
}

export type DocumentDetail = DocumentSummary;

export interface ReferralSummary {
  id: string;
  fhirId: string;
  status?: string | null;
  intent?: string | null;
  priority?: string | null;
  display?: string | null;
  code?: string | null;
  authoredOn?: string | null;
  note?: string | null;
}

export type ReferralDetail = ReferralSummary;

export type PatientSectionKey =
  | 'medications'
  | 'allergies'
  | 'procedures'
  | 'documents'
  | 'referrals';

export interface PatientDetail extends PatientSummary {
  oib?: string | null;
  active?: boolean | null;
  encounters: EncounterSummary[];
  conditions: ConditionSummary[];
  practitioners: PractitionerSummary[];
  medications: MedicationSummary[];
  allergies: AllergySummary[];
  procedures: ProcedureSummary[];
  documents: DocumentSummary[];
  referrals: ReferralSummary[];
  sectionErrors?: Partial<Record<PatientSectionKey, string>>;
}

/** Domain / frontend encounter model (mapped from FHIR). */
export interface EncounterSummary {
  id: string;
  fhirId: string;
  status?: string | null;
  start?: string | null;
  end?: string | null;
  classCode?: string | null;
  classDisplay?: string | null;
  visitId?: string | null;
  practitionerFhirId?: string | null;
  practitionerHzjzId?: string | null;
  practitionerName?: string | null;
  organizationFhirId?: string | null;
  organizationName?: string | null;
  priorityCode?: string | null;
}

export type Encounter = EncounterSummary;

export interface EncounterDetail extends EncounterSummary {
  practitioner?: PractitionerSummary | null;
  organization?: OrganizationSummary | null;
}

export interface ConditionSummary {
  id: string;
  fhirId: string;
  icd10Code?: string | null;
  display?: string | null;
  clinicalStatus?: string | null;
  verificationStatus?: string | null;
  caseId?: string | null;
  onsetDate?: string | null;
  abatementDate?: string | null;
  recordedDate?: string | null;
  encounterVisitId?: string | null;
  asserterHzjzId?: string | null;
  recorderHzjzId?: string | null;
  note?: string | null;
}

export type ConditionDetail = ConditionSummary;

export interface PractitionerSummary {
  id: string;
  fhirId: string;
  firstName?: string | null;
  lastName?: string | null;
  hzjzId?: string | null;
}

export type PractitionerDetail = PractitionerSummary;

export interface OrganizationSummary {
  id: string;
  fhirId: string;
  name: string;
  hzzoCode?: string | null;
}

export type OrganizationDetail = OrganizationSummary;

export interface PatientSearchQuery {
  fhirId?: string;
  mbo?: string;
  firstName?: string;
  lastName?: string;
  /** Matches practitioner first or last name (via encounters). */
  practitionerName?: string;
  /** Matches organization name (via encounters). */
  organizationName?: string;
}

export type KartonSelection =
  | { kind: 'encounter'; id: string }
  | { kind: 'condition'; id: string }
  | { kind: 'practitioner'; id: string }
  | { kind: 'organization'; id: string }
  | { kind: 'medication'; id: string }
  | { kind: 'allergy'; id: string }
  | { kind: 'procedure'; id: string }
  | { kind: 'document'; id: string }
  | { kind: 'referral'; id: string };
