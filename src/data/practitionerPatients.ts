import type { PatientSummary } from '../domain/models';
import { CEZIH_HZZO_ORG_SYSTEM, CEZIH_MBO_SYSTEM } from '../fhir/types';
import type { FhirEncounter, FhirPatient } from '../fhir/types';
import { mapFhirPatient } from '../mappers/mapFhirPatient';
import type { PractitionerSession } from '../auth/types';
import {
  bundleScopeActive,
  getBundleEncounters,
  getBundleOrganizations,
  getBundlePatients,
  preloadBundle,
} from './bundleResourceStore';
import { healthLakeClient } from './HealthLakeClient';

export interface PractitionerPatientSummary extends PatientSummary {
  lastEncounterDate?: string | null;
  lastOrganizationName?: string | null;
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

function encounterMatchesPractitioner(
  encounter: FhirEncounter,
  session: PractitionerSession,
): boolean {
  const individual = encounter.participant?.[0]?.individual;
  if (!individual) return false;

  const refId = parseReferenceId(individual.reference, 'Practitioner');
  if (refId === session.practitionerId) return true;

  return individual.identifier?.value === session.hzjzId;
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

function matchesSearch(patient: PatientSummary, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
  return (
    fullName.includes(q) ||
    (patient.mbo?.includes(q) ?? false) ||
    patient.fhirId.includes(q)
  );
}

async function resolveOrganizationName(encounter: FhirEncounter): Promise<string | null> {
  const serviceProvider = encounter.serviceProvider;
  if (!serviceProvider) return null;

  const refId = parseReferenceId(serviceProvider.reference, 'Organization');
  if (refId) {
    const resource = await healthLakeClient.read('Organization', refId);
    return resource?.name ?? null;
  }

  const identifier = serviceProvider.identifier?.value;
  if (!identifier) return null;

  if (bundleScopeActive()) {
    const orgs = await getBundleOrganizations();
    const match = orgs.find(
      (o) =>
        o.id === identifier ||
        o.identifier?.some(
          (i) => i.system === CEZIH_HZZO_ORG_SYSTEM && i.value === identifier,
        ),
    );
    return match?.name ?? null;
  }

  const byIdentifier = await healthLakeClient.search('Organization', {
    identifier: `${CEZIH_HZZO_ORG_SYSTEM}|${identifier}`,
  });
  return byIdentifier.entry?.[0]?.resource?.name ?? null;
}

export async function getPatientsForPractitioner(
  session: PractitionerSession,
): Promise<PractitionerPatientSummary[]> {
  if (bundleScopeActive()) await preloadBundle();

  const encounters = bundleScopeActive()
    ? await getBundleEncounters()
    : await healthLakeClient.searchAll('Encounter');

  const relevantEncounters = encounters.filter((e) =>
    encounterMatchesPractitioner(e, session),
  );

  const patients = bundleScopeActive()
    ? await getBundlePatients()
    : await healthLakeClient.searchAll('Patient');

  const patientById = new Map(patients.map((p) => [p.id, p]));
  const patientIdentifierIndex = buildPatientIdentifierIndex(patients);

  const lastEncounterByPatientId = new Map<string, FhirEncounter>();

  for (const encounter of relevantEncounters) {
    let patientId = parseReferenceId(encounter.subject?.reference, 'Patient');

    if (!patientId) {
      const mbo = encounter.subject?.identifier?.value;
      if (mbo) patientId = patientIdentifierIndex.get(mbo) ?? null;
    }

    if (!patientId) continue;

    const start = encounter.period?.start;
    if (!start) continue;

    const existing = lastEncounterByPatientId.get(patientId);
    if (!existing || Date.parse(start) > Date.parse(existing.period?.start ?? '')) {
      lastEncounterByPatientId.set(patientId, encounter);
    }
  }

  const summaries: PractitionerPatientSummary[] = [];

  for (const [patientId, lastEncounter] of lastEncounterByPatientId) {
    const resource = patientById.get(patientId);
    const lastEncounterDate = lastEncounter.period?.start ?? null;
    const lastOrganizationName = await resolveOrganizationName(lastEncounter);

    if (!resource) {
      const read = await healthLakeClient.read('Patient', patientId);
      if (!read) continue;
      summaries.push({
        ...toPatientSummary(read),
        lastEncounterDate,
        lastOrganizationName,
      });
      continue;
    }

    summaries.push({
      ...toPatientSummary(resource),
      lastEncounterDate,
      lastOrganizationName,
    });
  }

  return summaries;
}

/** Filter practitioner panel client-side (search, sort, date filter). */
export function filterPractitionerPatients(
  patients: PractitionerPatientSummary[],
  options: {
    search?: string;
    sort?: 'lastVisit' | 'name';
    last12MonthsOnly?: boolean;
  },
): PractitionerPatientSummary[] {
  let list = [...patients];

  if (options.last12MonthsOnly) {
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    list = list.filter((p) => {
      if (!p.lastEncounterDate) return false;
      return Date.parse(p.lastEncounterDate) >= cutoff;
    });
  }

  if (options.search?.trim()) {
    list = list.filter((p) => matchesSearch(p, options.search!));
  }

  if (options.sort === 'name') {
    list.sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } else {
    list.sort((a, b) => {
      const ta = a.lastEncounterDate ? Date.parse(a.lastEncounterDate) : 0;
      const tb = b.lastEncounterDate ? Date.parse(b.lastEncounterDate) : 0;
      return tb - ta;
    });
  }

  return list;
}

/** Search patient by MBO — bundle-scoped patients when enabled, else full HealthLake. */
export async function findPatientByMbo(mbo: string): Promise<PatientSummary | null> {
  const trimmed = mbo.trim();
  if (!trimmed) return null;

  if (bundleScopeActive()) {
    await preloadBundle();
    const patients = await getBundlePatients();
    const match = patients.find((p) => {
      const mapped = mapFhirPatient(p);
      return mapped.mbo === trimmed || mapped.mbo?.includes(trimmed);
    });
    return match ? toPatientSummary(match) : null;
  }

  const results = await healthLakeClient.searchAll('Patient', {
    identifier: `${CEZIH_MBO_SYSTEM}|${trimmed}`,
  });

  if (results.length === 0) {
    const fallback = await healthLakeClient.searchAll('Patient', { identifier: trimmed });
    if (fallback.length === 0) return null;
    return toPatientSummary(fallback[0]);
  }

  return toPatientSummary(results[0]);
}
