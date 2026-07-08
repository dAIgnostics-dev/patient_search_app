import type { FhirCodeSystem, FhirValueSet } from './terminologyTypes';

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
  type?: string;
  display?: string;
  identifier?: FhirReferenceIdentifier;
}

export interface FhirExtension {
  url: string;
  valueCoding?: FhirCoding;
  valueString?: string;
  valueCode?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  extension?: FhirExtension[];
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
  id?: string;
  identifier?: FhirIdentifier[];
  status?: string;
  class?: FhirCoding;
  type?: FhirCodeableConcept[];
  extension?: FhirExtension[];
  subject?: FhirReference;
  period?: FhirPeriod;
  participant?: Array<{
    individual?: FhirReference;
  }>;
  priority?: FhirCodeableConcept;
  diagnosis?: Array<{ condition?: FhirReference }>;
  serviceProvider?: FhirReference;
}

export interface FhirCondition {
  resourceType: 'Condition';
  id?: string;
  identifier?: FhirIdentifier[];
  clinicalStatus?: { coding?: FhirCoding[] };
  verificationStatus?: { coding?: FhirCoding[] };
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  onsetDateTime?: string;
  abatementDateTime?: string;
  recordedDate?: string;
  recorder?: FhirReference;
  asserter?: FhirReference;
  note?: Array<{ extension?: FhirExtension[]; text?: string }>;
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
  identifier?: FhirIdentifier[];
  status?: string;
  type?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  subject?: FhirReference;
  date?: string;
  description?: string;
  author?: FhirReference[];
  custodian?: FhirReference;
  context?: {
    encounter?: FhirReference[];
    period?: FhirPeriod;
  };
  relatesTo?: Array<{
    code?: string;
    target?: FhirReference;
  }>;
  content?: Array<{
    attachment?: {
      title?: string;
      contentType?: string;
      url?: string;
      data?: string;
    };
  }>;
  extension?: FhirExtension[];
}

export interface FhirCompositionSection {
  title?: string;
  code?: FhirCodeableConcept;
  entry?: FhirReference[];
}

export interface FhirCompositionAttester {
  mode?: string;
  party?: FhirReference;
}

export interface FhirComposition {
  resourceType: 'Composition';
  id?: string;
  status?: string;
  type?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  date?: string;
  author?: FhirReference[];
  title?: string;
  attester?: FhirCompositionAttester[];
  section?: FhirCompositionSection[];
}

export interface FhirHealthcareService {
  resourceType: 'HealthcareService';
  id?: string;
  identifier?: FhirIdentifier[];
  name?: string;
  providedBy?: FhirReference;
}

export interface FhirObservation {
  resourceType: 'Observation';
  id?: string;
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
}

export interface FhirClinicalDocumentBundleEntry {
  fullUrl?: string;
  resource:
    | FhirComposition
    | FhirEncounter
    | FhirPatient
    | FhirPractitioner
    | FhirOrganization
    | FhirHealthcareService
    | FhirCondition
    | FhirDocumentReference
    | FhirObservation
    | FhirProcedure
    | Record<string, unknown>;
}

export interface FhirClinicalDocumentBundle {
  resourceType: 'Bundle';
  id: string;
  identifier?: FhirIdentifier;
  type: 'document';
  timestamp?: string;
  entry: FhirClinicalDocumentBundleEntry[];
  signature?: FhirBundleSignature;
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

export interface FhirDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id: string;
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
}

export interface FhirImagingStudy {
  resourceType: 'ImagingStudy';
  id: string;
  status?: string;
  subject?: FhirReference;
}

export interface FhirBinary {
  resourceType: 'Binary';
  id: string;
  contentType?: string;
  data?: string;
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
  | FhirServiceRequest
  | FhirDiagnosticReport
  | FhirImagingStudy
  | FhirBinary
  | FhirCodeSystem
  | FhirValueSet;

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
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  diagnostics?: string;
  details?: { coding?: FhirCoding[] };
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome';
  issue: FhirOperationOutcomeIssue[];
}

export interface FhirMessageHeader {
  resourceType: 'MessageHeader';
  eventCoding?: FhirCoding;
  sender?: FhirReference;
  author?: FhirReference;
  source?: { endpoint?: string };
  focus?: FhirReference[];
  response?: {
    identifier?: string;
    code?: 'ok' | 'fatal-error' | 'transient-error' | 'informational';
    details?: FhirReference;
  };
}

export interface FhirBundleSignature {
  type?: FhirCoding[];
  when?: string;
  who?: FhirReference;
  data?: string;
}

export type FhirMessageResource =
  | FhirMessageHeader
  | FhirEncounter
  | FhirCondition
  | FhirOperationOutcome;

export interface FhirMessageBundleEntry {
  fullUrl?: string;
  resource: FhirMessageResource;
}

export interface FhirMessageBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'message';
  timestamp?: string;
  entry: FhirMessageBundleEntry[];
  signature?: FhirBundleSignature;
}

export const CEZIH_MBO_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/MBO';
export const CEZIH_HZJZ_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/HZJZ-broj-zdravstvenog-djelatnika';
export const CEZIH_HZZO_ORG_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/HZZO-sifra-zdravstvene-organizacije';
export const CEZIH_VISIT_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/identifikator-posjete';
export const CEZIH_LOCAL_VISIT_ID_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/lokalni-identifikator-posjete';
export const CEZIH_EHE_MESSAGE_TYPES = 'http://ent.hr/fhir/CodeSystem/ehe-message-types';
export const CEZIH_CREATE_ENCOUNTER_EVENT = '1.1';
export const CEZIH_UPDATE_ENCOUNTER_EVENT = '1.2';
export const CEZIH_CLOSE_ENCOUNTER_EVENT = '1.3';
export const CEZIH_CANCEL_ENCOUNTER_EVENT = '1.4';
export const CEZIH_REOPEN_ENCOUNTER_EVENT = '1.5';
export const CEZIH_CREATE_CASE_EVENT = '2.1';
export const CEZIH_CREATE_CASE_RECURRENCE_EVENT = '2.2';
export const CEZIH_REMISSION_CASE_EVENT = '2.3';
export const CEZIH_RESOLVE_CASE_EVENT = '2.4';
export const CEZIH_CASE_RESPONSE_EVENT = '2.6';
export const CEZIH_RELAPSE_CASE_EVENT = '2.5';
export const CEZIH_DELETE_CASE_EVENT = '2.7';
export const CEZIH_CASE_IDENTIFIER_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/identifikator-slucaja';
export const CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/lokalni-identifikator-slucaja';
export const CEZIH_SLUCAJ_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/slucaj';
export const CEZIH_ICD10_HR_SYSTEM = 'http://fhir.cezih.hr/specifikacije/CodeSystem/icd10-hr';
export const FHIR_CONDITION_CLINICAL_STATUS_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/condition-clinical';
export const FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/condition-ver-status';
export const CEZIH_ANNOTATION_TYPE_EXTENSION_URL =
  'http://fhir.cezih.hr/specifikacije/StructureDefinition/hr-annotation-type';
export const CEZIH_ANNOTATION_TYPE_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/CodeSystem/annotation-type';
export const FHIR_ACT_PRIORITY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-ActPriority';
export const CEZIH_NACIN_PRIJEMA_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/CodeSystem/nacin-prijema';
export const CEZIH_TROSKOVI_EXTENSION_URL =
  'http://fhir.cezih.hr/specifikacije/StructureDefinition/hr-troskovi-sudjelovanje';
export const CEZIH_SUDJELOVANJE_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/CodeSystem/sudjelovanje-u-troskovima';
export const CEZIH_OSLOBODJENJE_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/CodeSystem/sifra-oslobodjenja-od-sudjelovanja-u-troskovima';
export const CEZIH_DOCUMENT_TYPE_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/CodeSystem/document-type';
export const CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA = '011';
export const CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY =
  'Izvješće nakon pregleda u ambulanti privatne zdravstvene ustanove';
export const CEZIH_DOCUMENT_SECTION_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/CodeSystem/document-section';
export const CEZIH_DOCUMENT_SECTION_DJELATNOST = '12';
export const CEZIH_DOCUMENT_SECTION_PRILOZI = '16';
export const CEZIH_DOCUMENT_SECTION_MEDICINSKA_INFORMACIJA = '18';
export const CEZIH_OBSERVATIONS_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/CodeSystem/observations';
export const CEZIH_OBSERVATION_ANAMNEZA_CODE = '15';
export const CEZIH_OBSERVATION_ISHOD_PREGLEDA_CODE = '24';
export const CEZIH_DJELATNOST_ID_SYSTEM =
  'http://fhir.cezih.hr/specifikacije/identifikatori/ID-djelatnosti';
export const CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL =
  'http://fhir.cezih.hr/specifikacije/StructureDefinition/hr-clinical-document-summary';
