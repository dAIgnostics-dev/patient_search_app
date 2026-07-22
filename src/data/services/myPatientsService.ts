import { DEFAULT_PRACTITIONER_ROLE } from '../../auth/roles';
import type { PractitionerSession } from '../../auth/types';
import type { PatientSummary } from '../../domain/models';
import type { PractitionerPatientSummary } from '../legacy/practitionerPatientsLegacy';
import { getAppRepository } from '../repositories/registry';
import type { ClinicianContext, MyPatientsFilters } from './types';
import { patientSearchService } from './patientSearchService';

function toSession(context: ClinicianContext): PractitionerSession {
  const practitionerId = context.clinicianId;
  const hzjzId = context.hzjzId?.trim() || practitionerId;
  const username = context.username?.trim() || practitionerId;
  const firstName = context.firstName?.trim() || '';
  const lastName = context.lastName?.trim() || '';
  const auditSessionId = context.auditSessionId?.trim() || practitionerId;

  return {
    practitionerId,
    username,
    firstName,
    lastName,
    hzjzId,
    role: context.role?.trim() || DEFAULT_PRACTITIONER_ROLE,
    auditSessionId,
  };
}

function matchesSearch(patient: PatientSummary, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
  return fullName.includes(q) || (patient.mbo?.includes(q) ?? false) || patient.fhirId.includes(q);
}

export function filterMyPatients(
  patients: PractitionerPatientSummary[],
  options: MyPatientsFilters,
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

export class MyPatientsService {
  async getMyPatients(
    clinicianContext: ClinicianContext,
    filters?: MyPatientsFilters,
  ): Promise<PractitionerPatientSummary[]> {
    const list = await getAppRepository().getPatientsForPractitioner(toSession(clinicianContext));
    return filters ? filterMyPatients(list, filters) : list;
  }

  async findPatientByMbo(
    clinicianContext: ClinicianContext | null,
    mbo: string,
  ): Promise<PatientSummary | null> {
    return patientSearchService.findPatientByMbo(clinicianContext, mbo);
  }
}

export const myPatientsService = new MyPatientsService();
