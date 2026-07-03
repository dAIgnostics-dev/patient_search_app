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
import type {
  FhirCondition,
  FhirDocumentReference,
  FhirEncounter,
  FhirOrganization,
  FhirPatient,
  FhirPractitioner,
  FhirReference,
} from '../../fhir/types';
import {
  CEZIH_HZJZ_SYSTEM,
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_MBO_SYSTEM,
} from '../../fhir/types';
import { findIdentifier } from '../../mappers/fhir-utils';
import { mapFhirCondition } from '../../mappers/mapFhirCondition';
import { mapFhirDocumentReference } from '../../mappers/mapFhirDocumentReference';
import { mapFhirEncounter } from '../../mappers/mapFhirEncounter';
import { mapFhirOrganization } from '../../mappers/mapFhirOrganization';
import { mapFhirPatient } from '../../mappers/mapFhirPatient';
import { mapFhirPractitioner } from '../../mappers/mapFhirPractitioner';
import type { FhirClient } from '../fhir-client/types';
import type { PractitionerPatientSummary } from '../legacy/practitionerPatientsLegacy';
import type { AppRepository } from './appRepository';

function parseReferenceId(reference: string | undefined, expectedType: string): string | null {
  if (!reference?.startsWith(`${expectedType}/`)) return null;
  return reference.slice(expectedType.length + 1);
}

function toPatientSummary(resource: FhirPatient): PatientSummary {
  const mapped = mapFhirPatient(resource);
  return {
    id: resource.id,
    fhirId: mapped.fhirId,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    birthDate: mapped.birthDate,
    gender: mapped.gender,
    mbo: mapped.mbo,
  };
}

function toPractitionerSummary(resource: FhirPractitioner): PractitionerSummary {
  const mapped = mapFhirPractitioner(resource);
  return {
    id: resource.id,
    fhirId: mapped.fhirId,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    hzjzId: mapped.hzjzId,
  };
}

function toOrganizationSummary(resource: FhirOrganization): OrganizationDetail {
  const mapped = mapFhirOrganization(resource);
  return {
    id: resource.id,
    fhirId: mapped.fhirId,
    name: mapped.name,
    hzzoCode: mapped.hzzoCode,
  };
}

function subjectMatchesPatient(subject: FhirReference | undefined, patient: PatientSummary): boolean {
  const refId = parseReferenceId(subject?.reference, 'Patient');
  if (refId === patient.id) return true;
  return Boolean(patient.mbo && subject?.identifier?.value === patient.mbo);
}

function referenceIdentifierValue(reference: FhirReference | undefined): string | null {
  return reference?.identifier?.value ?? null;
}

function latestEncounter(encounters: EncounterDetail[]): EncounterDetail | null {
  return [...encounters].sort((a, b) => {
    const ta = a.start ? Date.parse(a.start) : 0;
    const tb = b.start ? Date.parse(b.start) : 0;
    return tb - ta;
  })[0] ?? null;
}

export class CezihAppRepository implements AppRepository {
  constructor(private readonly client: FhirClient) {}

  async searchPatients(query: PatientSearchQuery): Promise<PatientSummary[]> {
    const patients = await this.loadPatients();
    const summaries = await Promise.all(
      patients.map(async (patient) => this.enrichPatientSummary(toPatientSummary(patient))),
    );

    const firstName = query.firstName?.trim().toLowerCase();
    const lastName = query.lastName?.trim().toLowerCase();
    const mbo = query.mbo?.trim();
    const fhirId = query.fhirId?.trim().toLowerCase();
    const practitionerName = query.practitionerName?.trim().toLowerCase();
    const organizationName = query.organizationName?.trim().toLowerCase();

    return summaries.filter((patient) => {
      if (firstName && !patient.firstName.toLowerCase().includes(firstName)) return false;
      if (lastName && !patient.lastName.toLowerCase().includes(lastName)) return false;
      if (mbo && !(patient.mbo?.includes(mbo) ?? false)) return false;
      if (fhirId && !patient.fhirId.toLowerCase().includes(fhirId)) return false;
      if (
        practitionerName &&
        !(patient.primaryPractitionerName?.toLowerCase().includes(practitionerName) ?? false)
      ) {
        return false;
      }
      if (
        organizationName &&
        !(patient.primaryOrganizationName?.toLowerCase().includes(organizationName) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }

  async getPatientSummaryById(id: string): Promise<PatientSummary | null> {
    const resource = await this.client.read<FhirPatient>('Patient', id);
    return resource ? this.enrichPatientSummary(toPatientSummary(resource)) : null;
  }

  async getPatientDetailById(id: string): Promise<PatientDetail | null> {
    const resource = await this.client.read<FhirPatient>('Patient', id);
    if (!resource) return null;

    const patient = await this.enrichPatientSummary(toPatientSummary(resource));
    const encounters = await this.getEncountersForPatient(patient);
    const conditions = await this.getConditionsForPatient(patient);
    const documents = await this.getDocumentsForPatient(patient);
    const practitioners = await this.getPractitionersForPatient(patient);

    return {
      ...patient,
      oib: mapFhirPatient(resource).oib,
      active: resource.active ?? null,
      encounters,
      conditions,
      practitioners,
      medications: [],
      allergies: [],
      procedures: [],
      documents,
      referrals: [],
    };
  }

  async getPatientsForPractitioner(
    session: PractitionerSession,
  ): Promise<PractitionerPatientSummary[]> {
    const practitioners = await this.loadPractitioners();
    const encounters = (await this.client.searchAll<FhirEncounter>('Encounter')).filter((encounter) =>
      this.encounterMatchesPractitioner(encounter, session, practitioners),
    );
    const patients = await this.loadPatients();
    const patientById = new Map(patients.map((patient) => [patient.id, patient]));
    const patientByMbo = new Map(
      patients
        .map((patient) => [findIdentifier(patient.identifier, CEZIH_MBO_SYSTEM), patient] as const)
        .filter((entry): entry is readonly [string, FhirPatient] => Boolean(entry[0])),
    );

    const lastEncounterByPatientId = new Map<string, FhirEncounter>();
    for (const encounter of encounters) {
      const refId = parseReferenceId(encounter.subject?.reference, 'Patient');
      const patient = refId
        ? patientById.get(refId)
        : patientByMbo.get(encounter.subject?.identifier?.value ?? '');
      if (!patient || !encounter.period?.start) continue;

      const existing = lastEncounterByPatientId.get(patient.id);
      if (!existing || Date.parse(encounter.period.start) > Date.parse(existing.period?.start ?? '')) {
        lastEncounterByPatientId.set(patient.id, encounter);
      }
    }

    const summaries: PractitionerPatientSummary[] = [];
    for (const [patientId, encounter] of lastEncounterByPatientId) {
      const patient = patientById.get(patientId);
      if (!patient) continue;
      const summary = await this.enrichPatientSummary(toPatientSummary(patient));
      summaries.push({
        ...summary,
        lastEncounterDate: encounter.period?.start ?? null,
        lastOrganizationName: summary.primaryOrganizationName ?? null,
      });
    }

    return summaries.sort((a, b) => {
      const ta = a.lastEncounterDate ? Date.parse(a.lastEncounterDate) : 0;
      const tb = b.lastEncounterDate ? Date.parse(b.lastEncounterDate) : 0;
      return tb - ta;
    });
  }

  async findPatientByMbo(mbo: string): Promise<PatientSummary | null> {
    const trimmed = mbo.trim();
    if (!trimmed) return null;
    const patients = await this.loadPatients();
    const match = patients.find((patient) => {
      const patientMbo = findIdentifier(patient.identifier, CEZIH_MBO_SYSTEM);
      return patientMbo === trimmed || patientMbo?.includes(trimmed);
    });
    return match ? this.enrichPatientSummary(toPatientSummary(match)) : null;
  }

  async getPractitionersForPatient(patient: PatientSummary): Promise<PractitionerSummary[]> {
    const encounters = await this.getRawEncountersForPatient(patient);
    const practitioners = await this.loadPractitioners();
    const byId = new Map(practitioners.map((practitioner) => [practitioner.id, practitioner]));
    const byHzjz = new Map(
      practitioners
        .map((practitioner) => [
          findIdentifier(practitioner.identifier, CEZIH_HZJZ_SYSTEM),
          practitioner,
        ] as const)
        .filter((entry): entry is readonly [string, FhirPractitioner] => Boolean(entry[0])),
    );

    const unique = new Map<string, PractitionerSummary>();
    for (const encounter of encounters) {
      for (const participant of encounter.participant ?? []) {
        const individual = participant.individual;
        const practitioner =
          byId.get(parseReferenceId(individual?.reference, 'Practitioner') ?? '') ??
          byHzjz.get(individual?.identifier?.value ?? '');
        if (practitioner) unique.set(practitioner.id, toPractitionerSummary(practitioner));
      }
    }
    return [...unique.values()];
  }

  async getEncounterDetail(id: string): Promise<EncounterDetail | null> {
    const resource = await this.client.read<FhirEncounter>('Encounter', id);
    return resource ? this.toEncounterDetail(resource) : null;
  }

  async getConditionDetail(id: string): Promise<ConditionDetail | null> {
    const resource = await this.client.read<FhirCondition>('Condition', id);
    return resource ? this.toConditionDetail(resource) : null;
  }

  async getPractitionerDetail(id: string): Promise<PractitionerDetail | null> {
    const resource = await this.client.read<FhirPractitioner>('Practitioner', id);
    return resource ? toPractitionerSummary(resource) : null;
  }

  async getOrganizationDetail(id: string): Promise<OrganizationDetail | null> {
    const resource = await this.client.read<FhirOrganization>('Organization', id);
    return resource ? toOrganizationSummary(resource) : null;
  }

  async getMedicationDetail(_id: string): Promise<MedicationDetail | null> {
    return null;
  }

  async getAllergyDetail(_id: string): Promise<AllergyDetail | null> {
    return null;
  }

  async getProcedureDetail(_id: string): Promise<ProcedureDetail | null> {
    return null;
  }

  async getDocumentDetail(id: string): Promise<DocumentDetail | null> {
    const resource = await this.client.read<FhirDocumentReference>('DocumentReference', id);
    return resource ? this.toDocumentDetail(resource) : null;
  }

  async getReferralDetail(_id: string): Promise<ReferralDetail | null> {
    return null;
  }

  private async enrichPatientSummary(patient: PatientSummary): Promise<PatientSummary> {
    const encounters = await this.getEncountersForPatient(patient);
    const last = latestEncounter(encounters);
    return {
      ...patient,
      primaryPractitionerName: last?.practitionerName ?? null,
      primaryOrganizationName: last?.organizationName ?? null,
    };
  }

  private async getRawEncountersForPatient(patient: PatientSummary): Promise<FhirEncounter[]> {
    const encounters = await this.client.searchAll<FhirEncounter>('Encounter');
    return encounters.filter((encounter) => subjectMatchesPatient(encounter.subject, patient));
  }

  private async getEncountersForPatient(patient: PatientSummary): Promise<EncounterDetail[]> {
    const encounters = await this.getRawEncountersForPatient(patient);
    const mapped = await Promise.all(encounters.map((encounter) => this.toEncounterDetail(encounter)));
    return mapped.sort((a, b) => {
      const ta = a.start ? Date.parse(a.start) : 0;
      const tb = b.start ? Date.parse(b.start) : 0;
      return tb - ta;
    });
  }

  private async getConditionsForPatient(patient: PatientSummary): Promise<ConditionDetail[]> {
    const conditions = await this.client.searchAll<FhirCondition>('Condition');
    return conditions
      .filter((condition) => subjectMatchesPatient(condition.subject, patient))
      .map((condition) => this.toConditionDetail(condition));
  }

  private async getDocumentsForPatient(patient: PatientSummary): Promise<DocumentDetail[]> {
    const documents = await this.client.searchAll<FhirDocumentReference>('DocumentReference');
    return documents
      .filter((document) => subjectMatchesPatient(document.subject, patient))
      .map((document) => this.toDocumentDetail(document));
  }

  private async toEncounterDetail(resource: FhirEncounter): Promise<EncounterDetail> {
    const mapped = mapFhirEncounter(resource);
    const practitioner = await this.resolvePractitioner(resource);
    const organization = await this.resolveOrganization(resource);

    return {
      id: resource.id ?? mapped.fhirId,
      fhirId: mapped.fhirId,
      status: mapped.status,
      start: mapped.start,
      end: mapped.end,
      classCode: mapped.classCode,
      classDisplay: mapped.classDisplay,
      visitId: mapped.visitId,
      practitionerFhirId: practitioner?.id ?? mapped.practitionerFhirId,
      practitionerHzjzId: practitioner?.hzjzId ?? mapped.practitionerHzjzId,
      practitionerName: practitioner
        ? `${practitioner.firstName ?? ''} ${practitioner.lastName ?? ''}`.trim()
        : null,
      organizationFhirId: organization?.id ?? mapped.organizationFhirId,
      organizationName: organization?.name ?? null,
      priorityCode: mapped.priorityCode,
      practitioner,
      organization,
    };
  }

  private toConditionDetail(resource: FhirCondition): ConditionDetail {
    const mapped = mapFhirCondition(resource);
    return {
      id: resource.id ?? mapped.fhirId,
      fhirId: mapped.fhirId,
      icd10Code: mapped.icd10Code,
      display: mapped.display,
      clinicalStatus: mapped.clinicalStatus,
      verificationStatus: mapped.verificationStatus,
      caseId: mapped.caseId,
      onsetDate: mapped.onsetDate,
      abatementDate: mapped.abatementDate,
      recordedDate: mapped.recordedDate,
      encounterVisitId: mapped.encounterVisitId,
      asserterHzjzId: mapped.asserterHzjzId,
      recorderHzjzId: mapped.recorderHzjzId,
      note: mapped.note,
    };
  }

  private toDocumentDetail(resource: FhirDocumentReference): DocumentDetail {
    const mapped = mapFhirDocumentReference(resource);
    return {
      id: resource.id,
      fhirId: mapped.fhirId,
      status: mapped.status,
      typeDisplay: mapped.typeDisplay,
      typeCode: mapped.typeCode,
      category: mapped.category,
      date: mapped.date,
      description: mapped.description,
      contentType: mapped.contentType,
      documentId: mapped.documentId,
      compositionStatus: mapped.compositionStatus,
      title: mapped.title,
      encounterVisitId: mapped.encounterVisitId,
      caseId: mapped.caseId,
      caseDisplay: mapped.caseDisplay,
      authorHzjzId: mapped.authorHzjzId,
      authorName: mapped.authorName,
      organizationHzzoCode: mapped.organizationHzzoCode,
      organizationName: mapped.organizationName,
      healthcareServiceName: mapped.healthcareServiceName,
      hasSignature: mapped.hasSignature,
      attachmentCount: mapped.attachmentCount,
      anamnesisPreview: mapped.anamnesisPreview,
      outcomeDisplay: mapped.outcomeDisplay,
    };
  }

  private async resolvePractitioner(encounter: FhirEncounter): Promise<PractitionerSummary | null> {
    const individual = encounter.participant?.[0]?.individual;
    const refId = parseReferenceId(individual?.reference, 'Practitioner');
    if (refId) {
      const resource = await this.client.read<FhirPractitioner>('Practitioner', refId);
      return resource ? toPractitionerSummary(resource) : null;
    }

    const hzjzId = referenceIdentifierValue(individual);
    if (!hzjzId) return null;
    const practitioners = await this.loadPractitioners();
    const resource = practitioners.find(
      (practitioner) => findIdentifier(practitioner.identifier, CEZIH_HZJZ_SYSTEM) === hzjzId,
    );
    return resource ? toPractitionerSummary(resource) : null;
  }

  private async resolveOrganization(encounter: FhirEncounter): Promise<OrganizationDetail | null> {
    const provider = encounter.serviceProvider;
    const refId = parseReferenceId(provider?.reference, 'Organization');
    if (refId) {
      const resource = await this.client.read<FhirOrganization>('Organization', refId);
      return resource ? toOrganizationSummary(resource) : null;
    }

    const hzzoCode = referenceIdentifierValue(provider);
    if (!hzzoCode) return null;
    const organizations = await this.loadOrganizations();
    const resource = organizations.find(
      (organization) =>
        findIdentifier(organization.identifier, CEZIH_HZZO_ORG_SYSTEM) === hzzoCode,
    );
    return resource ? toOrganizationSummary(resource) : null;
  }

  private encounterMatchesPractitioner(
    encounter: FhirEncounter,
    session: PractitionerSession,
    practitioners: FhirPractitioner[],
  ): boolean {
    const individual = encounter.participant?.[0]?.individual;
    const refId = parseReferenceId(individual?.reference, 'Practitioner');
    if (refId === session.practitionerId) return true;
    if (individual?.identifier?.value === session.hzjzId) return true;

    const referencedPractitioner = refId
      ? practitioners.find((practitioner) => practitioner.id === refId)
      : null;
    return (
      findIdentifier(referencedPractitioner?.identifier, CEZIH_HZJZ_SYSTEM) === session.hzjzId
    );
  }

  private loadPatients(): Promise<FhirPatient[]> {
    return this.client.searchAll<FhirPatient>('Patient');
  }

  private loadPractitioners(): Promise<FhirPractitioner[]> {
    return this.client.searchAll<FhirPractitioner>('Practitioner');
  }

  private loadOrganizations(): Promise<FhirOrganization[]> {
    return this.client.searchAll<FhirOrganization>('Organization');
  }
}
