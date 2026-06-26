import type { PatientSummary } from '../domain/models';
import type { PractitionerSession } from '../auth/types';
import { filterMyPatients } from './services/myPatientsService';
import {
  findPatientByMboLegacy,
  getPatientsForPractitionerLegacy,
  type PractitionerPatientSummary,
} from './legacy/practitionerPatientsLegacy';
import { getAppRepository } from './repositories/registry';

export type { PractitionerPatientSummary } from './legacy/practitionerPatientsLegacy';

export async function getPatientsForPractitioner(
  session: PractitionerSession,
): Promise<PractitionerPatientSummary[]> {
  return getAppRepository().getPatientsForPractitioner(session);
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
  return filterMyPatients(patients, options);
}

/** Search patient by MBO through the active app repository/source routing. */
export async function findPatientByMbo(mbo: string): Promise<PatientSummary | null> {
  return getAppRepository().findPatientByMbo(mbo);
}

// Kept for direct validation parity checks.
export { getPatientsForPractitionerLegacy, findPatientByMboLegacy };
