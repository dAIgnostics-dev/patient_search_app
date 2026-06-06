import type { PractitionerSession } from '../auth/types';

let activeCorrelationId: string | null = null;
let activeCorrelationPatientId: string | null = null;

export function createAuditSessionId(): string {
  return crypto.randomUUID();
}

export function ensureAuditSessionId(session: PractitionerSession): PractitionerSession {
  if (session.auditSessionId) return session;
  return { ...session, auditSessionId: createAuditSessionId() };
}

export function beginPatientCorrelation(patientId: string): string {
  activeCorrelationId = crypto.randomUUID();
  activeCorrelationPatientId = patientId;
  return activeCorrelationId;
}

export function getPatientCorrelationId(patientId: string): string | null {
  if (activeCorrelationPatientId === patientId) return activeCorrelationId;
  return null;
}

export function clearPatientCorrelation(): void {
  activeCorrelationId = null;
  activeCorrelationPatientId = null;
}
