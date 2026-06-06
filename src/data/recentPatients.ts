import type { PatientSummary } from '../domain/models';

const MAX_RECENT = 5;

export interface RecentPatientEntry {
  patient: PatientSummary;
  openedAt: string;
}

function storageKey(practitionerId: string): string {
  return `cezih-recent-patients-${practitionerId}`;
}

export function getRecentPatients(practitionerId: string): RecentPatientEntry[] {
  try {
    const raw = sessionStorage.getItem(storageKey(practitionerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentPatientEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentPatient(practitionerId: string, patient: PatientSummary): void {
  const existing = getRecentPatients(practitionerId).filter((e) => e.patient.id !== patient.id);
  const next: RecentPatientEntry[] = [
    { patient, openedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_RECENT);
  try {
    sessionStorage.setItem(storageKey(practitionerId), JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}
