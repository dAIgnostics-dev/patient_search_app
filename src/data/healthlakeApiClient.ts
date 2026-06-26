import type {
  AllergyDetail,
  ConditionDetail,
  DocumentDetail,
  EncounterDetail,
  EncounterSummary,
  MedicationDetail,
  OrganizationDetail,
  PatientDetail,
  PatientSearchQuery,
  PatientSectionKey,
  PatientSummary,
  PractitionerDetail,
  PractitionerSummary,
  ProcedureDetail,
  ReferralDetail,
} from '../domain/models';
import {
  CEZIH_HZJZ_SYSTEM,
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_MBO_SYSTEM,
  type FhirAllergyIntolerance,
  type FhirCondition,
  type FhirDocumentReference,
  type FhirEncounter,
  type FhirMedicationRequest,
  type FhirOrganization,
  type FhirPatient,
  type FhirPractitioner,
  type FhirProcedure,
  type FhirReference,
  type FhirServiceRequest,
} from '../fhir/types';
import { mapFhirAllergyIntolerance } from '../mappers/mapFhirAllergyIntolerance';
import { mapFhirCondition } from '../mappers/mapFhirCondition';
import { mapFhirDocumentReference } from '../mappers/mapFhirDocumentReference';
import { mapFhirEncounter } from '../mappers/mapFhirEncounter';
import { mapFhirMedicationRequest } from '../mappers/mapFhirMedicationRequest';
import { mapFhirOrganization } from '../mappers/mapFhirOrganization';
import { mapFhirPatient } from '../mappers/mapFhirPatient';
import { mapFhirPractitioner } from '../mappers/mapFhirPractitioner';
import { mapFhirProcedure } from '../mappers/mapFhirProcedure';
import { mapFhirServiceRequest } from '../mappers/mapFhirServiceRequest';
import {
  bundleScopeActive,
  getBundleAllergyIntolerances,
  getBundleConditions,
  getBundleDocumentReferences,
  getBundleEncounters,
  getBundleMedicationRequests,
  getBundleOrganizations,
  getBundlePatients,
  getBundlePractitioners,
  getBundleProcedures,
  getBundleServiceRequests,
  isBundleResourceId,
  preloadBundle,
} from './bundleResourceStore';
import {
  healthLakeClient,
  type FhirResourceByType,
  type FhirResourceType,
} from './HealthLakeClient';

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

function toEncounterSummary(resource: FhirEncounter): EncounterSummary {
  const mapped = mapFhirEncounter(resource);
  const individual = resource.participant?.[0]?.individual;
  const practitionerRef = individual?.reference?.startsWith('Practitioner/')
    ? individual.reference.slice('Practitioner/'.length)
    : null;

  return {
    id: resource.id ?? mapped.fhirId,
    fhirId: mapped.fhirId,
    status: mapped.status,
    start: mapped.start,
    end: mapped.end,
    classCode: mapped.classCode,
    classDisplay: mapped.classDisplay,
    visitId: mapped.visitId,
    practitionerFhirId: practitionerRef ?? mapped.practitionerFhirId,
    practitionerHzjzId:
      individual?.identifier?.value ?? mapped.practitionerHzjzId ?? null,
    organizationFhirId: mapped.organizationFhirId,
    priorityCode: mapped.priorityCode,
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

function parseReferenceId(reference: string | undefined, expectedType: string): string | null {
  if (!reference) return null;
  if (!reference.startsWith(`${expectedType}/`)) return null;
  return reference.slice(expectedType.length + 1);
}

function buildPatientIdentifierIndex(patients: FhirPatient[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const patient of patients) {
    for (const identifier of patient.identifier ?? []) {
      if (identifier.value) index.set(identifier.value, patient.id);
    }
  }
  return index;
}

async function listAllPatientsRaw(): Promise<FhirPatient[]> {
  if (bundleScopeActive()) return getBundlePatients();
  return healthLakeClient.searchAll('Patient');
}

async function listAllEncountersRaw(): Promise<FhirEncounter[]> {
  if (bundleScopeActive()) return getBundleEncounters();
  return healthLakeClient.searchAll('Encounter');
}

async function listAllConditionsRaw(): Promise<FhirCondition[]> {
  if (bundleScopeActive()) return getBundleConditions();
  return healthLakeClient.searchAll('Condition');
}

function patientMatchesSearchQuery(resource: FhirPatient, query: PatientSearchQuery): boolean {
  const mapped = mapFhirPatient(resource);

  if (query.fhirId?.trim() && resource.id !== query.fhirId.trim()) return false;

  if (query.mbo?.trim()) {
    const q = query.mbo.trim();
    if (!mapped.mbo?.includes(q)) return false;
  }

  if (query.firstName?.trim()) {
    const q = query.firstName.trim().toLowerCase();
    if (!mapped.firstName.toLowerCase().includes(q)) return false;
  }

  if (query.lastName?.trim()) {
    const q = query.lastName.trim().toLowerCase();
    if (!mapped.lastName.toLowerCase().includes(q)) return false;
  }

  return true;
}

type PatientLink = Pick<PatientSummary, 'id' | 'mbo'>;

function isSearchFallbackError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('(400)') ||
    message.includes('not supported')
  );
}

function subjectMatchesPatient(subject: FhirReference | undefined, patient: PatientLink): boolean {
  const refId = parseReferenceId(subject?.reference, 'Patient');
  if (refId === patient.id) return true;
  if (patient.mbo && subject?.identifier?.value === patient.mbo) return true;
  return false;
}

async function searchBySubjectParam<T extends FhirResourceType>(
  resourceType: T,
  patient: PatientLink,
  subjectParam: 'subject' | 'patient',
): Promise<FhirResourceByType[T][]> {
  try {
    const byRef = await healthLakeClient.search(resourceType, {
      [subjectParam]: `Patient/${patient.id}`,
    });
    const list = (byRef.entry ?? []).map((entry) => entry.resource);
    if (list.length > 0) return list;
  } catch (err) {
    if (!isSearchFallbackError(err)) throw err;
  }

  if (patient.mbo) {
    try {
      const byMbo = await healthLakeClient.search(resourceType, {
        [`${subjectParam}:Patient.identifier`]: `${CEZIH_MBO_SYSTEM}|${patient.mbo}`,
      });
      const list = (byMbo.entry ?? []).map((entry) => entry.resource);
      if (list.length > 0) return list;
    } catch (err) {
      if (!isSearchFallbackError(err)) throw err;
    }
  }

  return [];
}

async function searchSubjectResourcesForPatient<T extends FhirResourceType>(
  resourceType: T,
  patient: PatientLink,
  getBundleList: () => Promise<FhirResourceByType[T][]>,
  listAll: () => Promise<FhirResourceByType[T][]>,
  matchesPatient: (resource: FhirResourceByType[T], link: PatientLink) => boolean,
  subjectParam: 'subject' | 'patient' = 'subject',
): Promise<FhirResourceByType[T][]> {
  if (bundleScopeActive()) {
    return (await getBundleList()).filter((resource) => matchesPatient(resource, patient));
  }

  const fromSearch = await searchBySubjectParam(resourceType, patient, subjectParam);
  if (fromSearch.length > 0) return fromSearch;

  const all = await listAll();
  return all.filter((resource) => matchesPatient(resource, patient));
}

async function listAllMedicationRequestsRaw(): Promise<FhirMedicationRequest[]> {
  if (bundleScopeActive()) return getBundleMedicationRequests();
  return healthLakeClient.searchAll('MedicationRequest');
}

async function listAllAllergyIntolerancesRaw(): Promise<FhirAllergyIntolerance[]> {
  if (bundleScopeActive()) return getBundleAllergyIntolerances();
  return healthLakeClient.searchAll('AllergyIntolerance');
}

async function listAllProceduresRaw(): Promise<FhirProcedure[]> {
  if (bundleScopeActive()) return getBundleProcedures();
  return healthLakeClient.searchAll('Procedure');
}

async function listAllDocumentReferencesRaw(): Promise<FhirDocumentReference[]> {
  if (bundleScopeActive()) return getBundleDocumentReferences();
  return healthLakeClient.searchAll('DocumentReference');
}

async function listAllServiceRequestsRaw(): Promise<FhirServiceRequest[]> {
  if (bundleScopeActive()) return getBundleServiceRequests();
  return healthLakeClient.searchAll('ServiceRequest');
}

async function searchMedicationsForPatient(
  patient: PatientLink,
): Promise<FhirMedicationRequest[]> {
  return searchSubjectResourcesForPatient(
    'MedicationRequest',
    patient,
    getBundleMedicationRequests,
    listAllMedicationRequestsRaw,
    (resource, link) => subjectMatchesPatient(resource.subject, link),
  );
}

async function searchAllergiesForPatient(
  patient: PatientLink,
): Promise<FhirAllergyIntolerance[]> {
  return searchSubjectResourcesForPatient(
    'AllergyIntolerance',
    patient,
    getBundleAllergyIntolerances,
    listAllAllergyIntolerancesRaw,
    (resource, link) => subjectMatchesPatient(resource.patient, link),
    'patient',
  );
}

async function searchProceduresForPatient(patient: PatientLink): Promise<FhirProcedure[]> {
  return searchSubjectResourcesForPatient(
    'Procedure',
    patient,
    getBundleProcedures,
    listAllProceduresRaw,
    (resource, link) => subjectMatchesPatient(resource.subject, link),
  );
}

async function searchDocumentsForPatient(
  patient: PatientLink,
): Promise<FhirDocumentReference[]> {
  return searchSubjectResourcesForPatient(
    'DocumentReference',
    patient,
    getBundleDocumentReferences,
    listAllDocumentReferencesRaw,
    (resource, link) => subjectMatchesPatient(resource.subject, link),
  );
}

async function searchReferralsForPatient(patient: PatientLink): Promise<FhirServiceRequest[]> {
  return searchSubjectResourcesForPatient(
    'ServiceRequest',
    patient,
    getBundleServiceRequests,
    listAllServiceRequestsRaw,
    (resource, link) => subjectMatchesPatient(resource.subject, link),
  );
}

async function safeSectionFetch<T>(
  key: PatientSectionKey,
  fetcher: () => Promise<T>,
  sectionErrors: Partial<Record<PatientSectionKey, string>>,
): Promise<T | null> {
  try {
    return await fetcher();
  } catch (err) {
    sectionErrors[key] =
      err instanceof Error ? err.message : 'Could not load this section.';
    return null;
  }
}

/** HealthLake encounters often use MBO identifier subjects, not Patient/{id} references. */
async function searchEncountersForPatient(patient: PatientLink): Promise<FhirEncounter[]> {
  if (bundleScopeActive()) {
    return (await getBundleEncounters()).filter((encounter) =>
      subjectMatchesPatient(encounter.subject, patient),
    );
  }

  try {
    const byRef = await healthLakeClient.search('Encounter', {
      subject: `Patient/${patient.id}`,
    });
    const list = (byRef.entry ?? []).map((entry) => entry.resource);
    if (list.length > 0) return list;
  } catch (err) {
    if (!isSearchFallbackError(err)) throw err;
  }

  if (patient.mbo) {
    try {
      const byMbo = await healthLakeClient.search('Encounter', {
        'subject:Patient.identifier': `${CEZIH_MBO_SYSTEM}|${patient.mbo}`,
      });
      const list = (byMbo.entry ?? []).map((entry) => entry.resource);
      if (list.length > 0) return list;
    } catch (err) {
      if (!isSearchFallbackError(err)) throw err;
    }
  }

  const all = await listAllEncountersRaw();
  return all.filter((encounter) => subjectMatchesPatient(encounter.subject, patient));
}

async function searchConditionsForPatient(patient: PatientLink): Promise<FhirCondition[]> {
  if (bundleScopeActive()) {
    return (await getBundleConditions()).filter((condition) =>
      subjectMatchesPatient(condition.subject, patient),
    );
  }

  try {
    const byRef = await healthLakeClient.search('Condition', {
      subject: `Patient/${patient.id}`,
    });
    const list = (byRef.entry ?? []).map((entry) => entry.resource);
    if (list.length > 0) return list;
  } catch (err) {
    if (!isSearchFallbackError(err)) throw err;
  }

  if (patient.mbo) {
    try {
      const byMbo = await healthLakeClient.search('Condition', {
        'subject:Patient.identifier': `${CEZIH_MBO_SYSTEM}|${patient.mbo}`,
      });
      const list = (byMbo.entry ?? []).map((entry) => entry.resource);
      if (list.length > 0) return list;
    } catch (err) {
      if (!isSearchFallbackError(err)) throw err;
    }
  }

  const all = await listAllConditionsRaw();
  return all.filter((condition) => subjectMatchesPatient(condition.subject, patient));
}

async function resolvePractitionerFromEncounter(
  encounter: FhirEncounter,
): Promise<PractitionerSummary | null> {
  const participant = encounter.participant?.[0]?.individual;
  if (!participant) return null;

  const refId = parseReferenceId(participant.reference, 'Practitioner');
  if (refId) {
    const resource = await healthLakeClient.read('Practitioner', refId);
    return resource ? toPractitionerSummary(resource) : null;
  }

  const identifier = participant.identifier?.value;
  if (!identifier) return null;

  const byIdentifier = await healthLakeClient.search('Practitioner', {
    identifier: `${CEZIH_HZJZ_SYSTEM}|${identifier}`,
  });
  const resource = byIdentifier.entry?.[0]?.resource;
  return resource ? toPractitionerSummary(resource) : null;
}

async function enrichEncountersWithOrganizations(
  encounterResources: FhirEncounter[],
): Promise<ReturnType<typeof toEncounterSummary>[]> {
  const orgCache = new Map<string, string | null>();

  async function orgNameForEncounter(resource: FhirEncounter): Promise<string | null> {
    const cacheKey =
      resource.serviceProvider?.reference ??
      (resource.serviceProvider?.identifier?.value
        ? `id:${resource.serviceProvider.identifier.value}`
        : '');
    if (!cacheKey) return null;
    if (orgCache.has(cacheKey)) return orgCache.get(cacheKey) ?? null;
    const org = await resolveOrganizationFromEncounter(resource);
    const name = org?.name ?? null;
    orgCache.set(cacheKey, name);
    return name;
  }

  return Promise.all(
    encounterResources.map(async (resource) => ({
      ...toEncounterSummary(resource),
      organizationName: await orgNameForEncounter(resource),
    })),
  );
}

async function resolveOrganizationFromEncounter(
  encounter: FhirEncounter,
): Promise<OrganizationDetail | null> {
  const serviceProvider = encounter.serviceProvider;
  if (!serviceProvider) return null;

  const refId = parseReferenceId(serviceProvider.reference, 'Organization');
  if (refId) {
    const resource = await healthLakeClient.read('Organization', refId);
    return resource ? toOrganizationSummary(resource) : null;
  }

  const identifier = serviceProvider.identifier?.value;
  if (!identifier) return null;

  const byIdentifier = await healthLakeClient.search('Organization', {
    identifier: `${CEZIH_HZZO_ORG_SYSTEM}|${identifier}`,
  });
  const resource = byIdentifier.entry?.[0]?.resource;
  return resource ? toOrganizationSummary(resource) : null;
}

async function getPatientsMatchingPractitionerName(
  patients: FhirPatient[],
  nameQuery: string,
): Promise<Set<string>> {
  const practitionerResources = bundleScopeActive()
    ? await getBundlePractitioners()
    : await healthLakeClient.searchAll('Practitioner');
  const q = nameQuery.toLowerCase();

  const matching = practitionerResources.filter((resource) => {
    const mapped = toPractitionerSummary(resource);
    const fullName = `${mapped.firstName ?? ''} ${mapped.lastName ?? ''}`.trim().toLowerCase();
    return (
      (mapped.firstName?.toLowerCase().includes(q) ?? false) ||
      (mapped.lastName?.toLowerCase().includes(q) ?? false) ||
      fullName.includes(q)
    );
  });

  const matchedIds = new Set(matching.map((p) => p.id));
  const matchedIdentifiers = new Set(
    matching.flatMap((p) => (p.identifier ?? []).map((i) => i.value).filter(Boolean) as string[]),
  );

  const patientIdentifierIndex = buildPatientIdentifierIndex(patients);
  const encounters = await listAllEncountersRaw();

  const patientIds = new Set<string>();
  for (const encounter of encounters) {
    const individual = encounter.participant?.[0]?.individual;
    const practitionerRefId = parseReferenceId(individual?.reference, 'Practitioner');
    const practitionerIdentifier = individual?.identifier?.value;

    const matchesPractitioner =
      (practitionerRefId ? matchedIds.has(practitionerRefId) : false) ||
      (practitionerIdentifier ? matchedIdentifiers.has(practitionerIdentifier) : false);

    if (!matchesPractitioner) continue;

    const patientRefId = parseReferenceId(encounter.subject?.reference, 'Patient');
    if (patientRefId) {
      patientIds.add(patientRefId);
      continue;
    }

    const subjectIdentifier = encounter.subject?.identifier?.value;
    if (subjectIdentifier) {
      const id = patientIdentifierIndex.get(subjectIdentifier);
      if (id) patientIds.add(id);
    }
  }

  return patientIds;
}

async function getPatientsMatchingOrganizationName(
  patients: FhirPatient[],
  nameQuery: string,
): Promise<Set<string>> {
  const organizationResources = bundleScopeActive()
    ? (await getBundleOrganizations()).filter((o) =>
        o.name?.toLowerCase().includes(nameQuery.toLowerCase()),
      )
    : await healthLakeClient.searchAll('Organization', { name: nameQuery });

  const matchedIds = new Set(organizationResources.map((o) => o.id));
  const matchedIdentifiers = new Set(
    organizationResources.flatMap((o) => (o.identifier ?? []).map((i) => i.value).filter(Boolean) as string[]),
  );

  const patientIdentifierIndex = buildPatientIdentifierIndex(patients);
  const encounters = await listAllEncountersRaw();
  const patientIds = new Set<string>();

  for (const encounter of encounters) {
    const refId = parseReferenceId(encounter.serviceProvider?.reference, 'Organization');
    const identifier = encounter.serviceProvider?.identifier?.value;
    const matchesOrg =
      (refId ? matchedIds.has(refId) : false) ||
      (identifier ? matchedIdentifiers.has(identifier) : false);

    if (!matchesOrg) continue;

    const patientRefId = parseReferenceId(encounter.subject?.reference, 'Patient');
    if (patientRefId) {
      patientIds.add(patientRefId);
      continue;
    }

    const subjectIdentifier = encounter.subject?.identifier?.value;
    if (subjectIdentifier) {
      const id = patientIdentifierIndex.get(subjectIdentifier);
      if (id) patientIds.add(id);
    }
  }

  return patientIds;
}

async function withCareContext(
  patient: PatientSummary,
  encountersHint?: FhirEncounter[],
): Promise<PatientSummary> {
  const encounters = encountersHint ?? (await searchEncountersForPatient(patient));
  if (encounters.length === 0) return patient;

  const latest = [...encounters].sort((a, b) => {
    const ta = a.period?.start ? Date.parse(a.period.start) : 0;
    const tb = b.period?.start ? Date.parse(b.period.start) : 0;
    return tb - ta;
  })[0];

  const practitioner = await resolvePractitionerFromEncounter(latest);
  const organization = await resolveOrganizationFromEncounter(latest);

  return {
    ...patient,
    primaryPractitionerName: practitioner
      ? `${practitioner.firstName ?? ''} ${practitioner.lastName ?? ''}`.trim() || null
      : null,
    primaryOrganizationName: organization?.name ?? null,
  };
}

export const healthlakeApiClient = {
  async searchPatients(query: PatientSearchQuery): Promise<PatientSummary[]> {
    let resources: FhirPatient[];
    let bundleEncounters: FhirEncounter[] | undefined;

    if (bundleScopeActive()) {
      await preloadBundle();
      resources = (await getBundlePatients()).filter((p) => patientMatchesSearchQuery(p, query));
      if (query.practitionerName?.trim() || query.organizationName?.trim()) {
        bundleEncounters = await getBundleEncounters();
      }
    } else if (query.fhirId?.trim()) {
      resources = await healthLakeClient.searchAll('Patient', { _id: query.fhirId });
      resources = resources.filter((resource) => resource.id === query.fhirId!.trim());
    } else {
      resources = await healthLakeClient.searchAll('Patient', {
        identifier: query.mbo,
        family: query.lastName,
        given: query.firstName,
      });
    }

    if (query.practitionerName?.trim()) {
      const allPatients = bundleScopeActive()
        ? await getBundlePatients()
        : await listAllPatientsRaw();
      const allowed = await getPatientsMatchingPractitionerName(
        allPatients,
        query.practitionerName.trim(),
      );
      resources = resources.filter((resource) => allowed.has(resource.id));
    }

    if (query.organizationName?.trim()) {
      const allPatients = bundleScopeActive()
        ? await getBundlePatients()
        : await listAllPatientsRaw();
      const allowed = await getPatientsMatchingOrganizationName(
        allPatients,
        query.organizationName.trim(),
      );
      resources = resources.filter((resource) => allowed.has(resource.id));
    }

    if (!bundleEncounters && bundleScopeActive()) {
      bundleEncounters = await getBundleEncounters();
    }

    const mapped = resources.map(toPatientSummary);
    return Promise.all(
      mapped.map((p) => {
        const encountersForPatient = bundleEncounters?.filter((e) =>
          subjectMatchesPatient(e.subject, p),
        );
        return withCareContext(p, encountersForPatient);
      }),
    );
  },

  async getPatientSummaryById(id: string): Promise<PatientSummary | null> {
    if (!isBundleResourceId('Patient', id)) return null;
    const resource = await healthLakeClient.read('Patient', id);
    if (!resource) return null;
    const summary = toPatientSummary(resource);
    const encounters = bundleScopeActive()
      ? (await getBundleEncounters()).filter((e) => subjectMatchesPatient(e.subject, summary))
      : undefined;
    return withCareContext(summary, encounters);
  },

  async getPatientDetailById(id: string): Promise<PatientDetail | null> {
    const patient = await this.getPatientSummaryById(id);
    if (!patient) return null;

    const sectionErrors: Partial<Record<PatientSectionKey, string>> = {};

    const [
      encounterResources,
      conditionResources,
      medicationResources,
      allergyResources,
      procedureResources,
      documentResources,
      referralResources,
    ] = await Promise.all([
      searchEncountersForPatient(patient),
      searchConditionsForPatient(patient),
      safeSectionFetch('medications', () => searchMedicationsForPatient(patient), sectionErrors),
      safeSectionFetch('allergies', () => searchAllergiesForPatient(patient), sectionErrors),
      safeSectionFetch('procedures', () => searchProceduresForPatient(patient), sectionErrors),
      safeSectionFetch('documents', () => searchDocumentsForPatient(patient), sectionErrors),
      safeSectionFetch('referrals', () => searchReferralsForPatient(patient), sectionErrors),
    ]);

    const encounters = await enrichEncountersWithOrganizations(encounterResources);
    const conditions: ConditionDetail[] = conditionResources.map((resource) => {
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
    });

    const medications = (medicationResources ?? []).map((resource) => {
      const mapped = mapFhirMedicationRequest(resource);
      return {
        id: resource.id,
        fhirId: mapped.fhirId,
        status: mapped.status,
        intent: mapped.intent,
        display: mapped.display,
        code: mapped.code,
        authoredOn: mapped.authoredOn,
        dosage: mapped.dosage,
        note: mapped.note,
      };
    });

    const allergies = (allergyResources ?? []).map((resource) => {
      const mapped = mapFhirAllergyIntolerance(resource);
      return {
        id: resource.id,
        fhirId: mapped.fhirId,
        display: mapped.display,
        code: mapped.code,
        clinicalStatus: mapped.clinicalStatus,
        verificationStatus: mapped.verificationStatus,
        type: mapped.type,
        category: mapped.category,
        criticality: mapped.criticality,
        onsetDate: mapped.onsetDate,
        note: mapped.note,
      };
    });

    const procedures = (procedureResources ?? []).map((resource) => {
      const mapped = mapFhirProcedure(resource);
      return {
        id: resource.id,
        fhirId: mapped.fhirId,
        status: mapped.status,
        display: mapped.display,
        code: mapped.code,
        performedDate: mapped.performedDate,
        note: mapped.note,
      };
    });

    const documents = (documentResources ?? []).map((resource) => {
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
      };
    });

    const referrals = (referralResources ?? []).map((resource) => {
      const mapped = mapFhirServiceRequest(resource);
      return {
        id: resource.id,
        fhirId: mapped.fhirId,
        status: mapped.status,
        intent: mapped.intent,
        priority: mapped.priority,
        display: mapped.display,
        code: mapped.code,
        authoredOn: mapped.authoredOn,
        note: mapped.note,
      };
    });

    const practitioners = await this.getPractitionersForPatient(patient);

    return {
      ...patient,
      active: null,
      oib: null,
      encounters,
      conditions,
      practitioners,
      medications,
      allergies,
      procedures,
      documents,
      referrals,
      sectionErrors: Object.keys(sectionErrors).length > 0 ? sectionErrors : undefined,
    };
  },

  async getPractitionersForPatient(patient: PatientLink): Promise<PractitionerSummary[]> {
    const encounterResources = await searchEncountersForPatient(patient);

    const seen = new Set<string>();
    const list: PractitionerSummary[] = [];

    for (const resource of encounterResources) {
      const practitioner = await resolvePractitionerFromEncounter(resource);
      if (!practitioner || seen.has(practitioner.id)) continue;
      seen.add(practitioner.id);
      list.push(practitioner);
    }

    return list;
  },

  async getEncounterDetail(id: string): Promise<EncounterDetail | null> {
    if (!isBundleResourceId('Encounter', id)) return null;
    const resource = await healthLakeClient.read('Encounter', id);
    if (!resource) return null;

    const [practitioner, organization] = await Promise.all([
      resolvePractitionerFromEncounter(resource),
      resolveOrganizationFromEncounter(resource),
    ]);

    return {
      ...toEncounterSummary(resource),
      practitioner,
      organization,
    };
  },

  async getConditionDetail(id: string): Promise<ConditionDetail | null> {
    if (!isBundleResourceId('Condition', id)) return null;
    const resource = await healthLakeClient.read('Condition', id);
    if (!resource) return null;

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
  },

  async getPractitionerDetail(id: string): Promise<PractitionerDetail | null> {
    if (!isBundleResourceId('Practitioner', id)) return null;
    const resource = await healthLakeClient.read('Practitioner', id);
    return resource ? toPractitionerSummary(resource) : null;
  },

  async getOrganizationDetail(id: string): Promise<OrganizationDetail | null> {
    if (!isBundleResourceId('Organization', id)) return null;
    const resource = await healthLakeClient.read('Organization', id);
    return resource ? toOrganizationSummary(resource) : null;
  },

  async getMedicationDetail(id: string): Promise<MedicationDetail | null> {
    if (!isBundleResourceId('MedicationRequest', id)) return null;
    const resource = await healthLakeClient.read('MedicationRequest', id);
    if (!resource) return null;
    const mapped = mapFhirMedicationRequest(resource);
    return { id: resource.id, ...mapped };
  },

  async getAllergyDetail(id: string): Promise<AllergyDetail | null> {
    if (!isBundleResourceId('AllergyIntolerance', id)) return null;
    const resource = await healthLakeClient.read('AllergyIntolerance', id);
    if (!resource) return null;
    const mapped = mapFhirAllergyIntolerance(resource);
    return { id: resource.id, ...mapped };
  },

  async getProcedureDetail(id: string): Promise<ProcedureDetail | null> {
    if (!isBundleResourceId('Procedure', id)) return null;
    const resource = await healthLakeClient.read('Procedure', id);
    if (!resource) return null;
    const mapped = mapFhirProcedure(resource);
    return { id: resource.id, ...mapped };
  },

  async getDocumentDetail(id: string): Promise<DocumentDetail | null> {
    if (!isBundleResourceId('DocumentReference', id)) return null;
    const resource = await healthLakeClient.read('DocumentReference', id);
    if (!resource) return null;
    const mapped = mapFhirDocumentReference(resource);
    return { id: resource.id, ...mapped };
  },

  async getReferralDetail(id: string): Promise<ReferralDetail | null> {
    if (!isBundleResourceId('ServiceRequest', id)) return null;
    const resource = await healthLakeClient.read('ServiceRequest', id);
    if (!resource) return null;
    const mapped = mapFhirServiceRequest(resource);
    return { id: resource.id, ...mapped };
  },
};
