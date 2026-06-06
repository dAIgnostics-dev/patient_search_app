export interface FhirIdentifier {
  system?: string;
  value?: string;
}

export interface FhirHumanName {
  family?: string;
  given?: string[];
  text?: string;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirReferenceIdentifier {
  system?: string;
  value?: string;
}

export interface FhirReference {
  reference?: string;
  identifier?: FhirReferenceIdentifier;
}

export interface FhirPatient {
  resourceType: 'Patient';
  id: string;
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  gender?: string;
  birthDate?: string;
}

export interface FhirEncounter {
  resourceType: 'Encounter';
  id: string;
  identifier?: FhirIdentifier[];
  status?: string;
  class?: FhirCoding;
  subject?: FhirReference;
  period?: FhirPeriod;
  participant?: Array<{
    individual?: FhirReference;
  }>;
  serviceProvider?: FhirReference;
}

export interface FhirCondition {
  resourceType: 'Condition';
  id: string;
  identifier?: FhirIdentifier[];
  clinicalStatus?: { coding?: FhirCoding[] };
  verificationStatus?: { coding?: FhirCoding[] };
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  onsetDateTime?: string;
  note?: Array<{ text?: string }>;
}

export interface FhirPractitioner {
  resourceType: 'Practitioner';
  id: string;
  identifier?: FhirIdentifier[];
  name?: FhirHumanName[];
}

export interface FhirOrganization {
  resourceType: 'Organization';
  id: string;
  identifier?: FhirIdentifier[];
  name?: string;
}

export interface FhirMedicationRequest {
  resourceType: 'MedicationRequest';
  id: string;
  status?: string;
  intent?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  subject?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  dosageInstruction?: Array<{ text?: string }>;
  note?: Array<{ text?: string }>;
}

export interface FhirAllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id: string;
  clinicalStatus?: { coding?: FhirCoding[] };
  verificationStatus?: { coding?: FhirCoding[] };
  type?: string;
  category?: string[];
  criticality?: string;
  code?: FhirCodeableConcept;
  patient?: FhirReference;
  onsetDateTime?: string;
  note?: Array<{ text?: string }>;
}

export interface FhirProcedure {
  resourceType: 'Procedure';
  id: string;
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  performedDateTime?: string;
  performedPeriod?: FhirPeriod;
  performer?: Array<{ actor?: FhirReference }>;
  note?: Array<{ text?: string }>;
}

export interface FhirDocumentReference {
  resourceType: 'DocumentReference';
  id: string;
  status?: string;
  type?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  subject?: FhirReference;
  date?: string;
  description?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
}

export interface FhirServiceRequest {
  resourceType: 'ServiceRequest';
  id: string;
  status?: string;
  intent?: string;
  priority?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  performer?: FhirReference[];
  note?: Array<{ text?: string }>;
}

export interface FhirSeedBundle {
  patients: FhirPatient[];
  encounters: FhirEncounter[];
  conditions: FhirCondition[];
  practitioners: FhirPractitioner[];
  organizations: FhirOrganization[];
}

export type FhirResource =
  | FhirPatient
  | FhirEncounter
  | FhirCondition
  | FhirPractitioner
  | FhirOrganization
  | FhirMedicationRequest
  | FhirAllergyIntolerance
  | FhirProcedure
  | FhirDocumentReference
  | FhirServiceRequest;

export interface FhirBundleEntry<T extends FhirResource = FhirResource> {
  resource: T;
}

export interface FhirBundle<T extends FhirResource = FhirResource> {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  entry: FhirBundleEntry<T>[];
  link?: Array<{ relation: 'self' | 'next'; url: string }>;
}

export interface FhirOperationOutcomeIssue {
  severity: 'error';
  code: 'not-found' | 'invalid' | 'not-supported';
  diagnostics: string;
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: FhirOperationOutcomeIssue[];
}

export const CEZIH_MBO_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/MBO';
export const CEZIH_HZJZ_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/HZJZ-broj-zdravstvenog-djelatnika';
export const CEZIH_HZZO_ORG_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/HZZO-sifra-zdravstvene-organizacije';
export const CEZIH_VISIT_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/identifikator-posjete';
