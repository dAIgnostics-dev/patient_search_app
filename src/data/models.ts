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

export interface PatientDetail extends PatientSummary {
  oib?: string | null;
  active?: boolean | null;
  encounters: EncounterSummary[];
  conditions: ConditionSummary[];
  practitioners: PractitionerSummary[];
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
  organizationFhirId?: string | null;
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
  | { kind: 'organization'; id: string };
