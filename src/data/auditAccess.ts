import type { PractitionerSession } from '../auth/types';
import { resolveAuditAccessUrl } from '../config/runtime';
import type { KartonSelection, PatientSummary } from '../domain/models';
import {
  beginPatientCorrelation,
  ensureAuditSessionId,
  getPatientCorrelationId,
} from './auditSession';

export type PatientAccessSource = 'mbo' | 'my-patients' | 'recent';

export type AuditAction =
  | 'auth.login'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'mbo.lookup'
  | 'patient.list.select'
  | 'patient.karton.open'
  | 'patient.resource.view';

export type AuditOutcome = 'success' | 'not_found' | 'error';

interface AuditActor {
  practitionerId?: string;
  username: string;
  hzjzId?: string;
  displayName?: string | null;
}

interface AuditPatient {
  id: string;
  mbo?: string | null;
  displayName?: string | null;
}

interface AuditResource {
  type: KartonSelection['kind'];
  id: string;
}

interface AuditContext {
  source?: PatientAccessSource;
  locale?: string;
  authMethod?: 'card' | 'password';
}

interface AuditEventBase {
  eventId: string;
  sessionId: string | null;
  correlationId?: string | null;
  action: AuditAction;
  occurredAt: string;
  outcome: AuditOutcome;
  actor: AuditActor;
  context?: AuditContext;
  patient?: AuditPatient | null;
  lookup?: { mbo: string };
  resource?: AuditResource;
}

function newEventId(): string {
  return crypto.randomUUID();
}

function patientDisplayName(patient: PatientSummary): string {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function actorFromSession(session: PractitionerSession): AuditActor {
  const ensured = ensureAuditSessionId(session);
  return {
    practitionerId: ensured.practitionerId,
    username: ensured.username,
    hzjzId: ensured.hzjzId,
    displayName: `${ensured.firstName} ${ensured.lastName}`.trim(),
  };
}

function patientPayload(patient: PatientSummary): AuditPatient {
  return {
    id: patient.id,
    mbo: patient.mbo ?? null,
    displayName: patientDisplayName(patient),
  };
}

function correlationForPatient(patientId: string): string | null {
  return getPatientCorrelationId(patientId) ?? beginPatientCorrelation(patientId);
}

function postAuditEvent(event: AuditEventBase): void {
  fetch(resolveAuditAccessUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => {
    // Audit must not block the UI
  });
}

function buildEvent(
  session: PractitionerSession,
  action: AuditAction,
  outcome: AuditOutcome,
  extra: Partial<AuditEventBase> = {},
): AuditEventBase {
  const ensured = ensureAuditSessionId(session);
  return {
    eventId: newEventId(),
    sessionId: ensured.auditSessionId,
    action,
    occurredAt: new Date().toISOString(),
    outcome,
    actor: actorFromSession(ensured),
    ...extra,
  };
}

export function logAuthLogin(
  session: PractitionerSession,
  locale?: string,
  authMethod: 'card' | 'password' = 'password',
): void {
  const ensured = ensureAuditSessionId(session);
  postAuditEvent(
    buildEvent(ensured, 'auth.login', 'success', {
      context: { ...(locale ? { locale } : {}), authMethod },
    }),
  );
}

export function logAuthLoginFailed(
  username: string,
  locale?: string,
  authMethod: 'card' | 'password' = 'password',
): void {
  postAuditEvent({
    eventId: newEventId(),
    sessionId: null,
    action: 'auth.login.failed',
    occurredAt: new Date().toISOString(),
    outcome: 'error',
    actor: { username: username.trim() },
    context: { ...(locale ? { locale } : {}), authMethod },
  });
}

export function logAuthLogout(session: PractitionerSession, locale?: string): void {
  postAuditEvent(
    buildEvent(session, 'auth.logout', 'success', {
      context: locale ? { locale } : undefined,
    }),
  );
}

export function logMboLookup(
  session: PractitionerSession,
  mbo: string,
  outcome: AuditOutcome,
  patient?: PatientSummary | null,
  locale?: string,
): void {
  const correlationId =
    outcome === 'success' && patient ? beginPatientCorrelation(patient.id) : null;

  postAuditEvent(
    buildEvent(session, 'mbo.lookup', outcome, {
      correlationId,
      lookup: { mbo },
      patient: patient ? patientPayload(patient) : null,
      context: locale ? { locale } : undefined,
    }),
  );
}

export function logPatientListSelect(
  session: PractitionerSession,
  patient: PatientSummary,
  source: PatientAccessSource,
  locale?: string,
): void {
  postAuditEvent(
    buildEvent(session, 'patient.list.select', 'success', {
      correlationId: beginPatientCorrelation(patient.id),
      patient: patientPayload(patient),
      context: { source, locale },
    }),
  );
}

export function logPatientKartonOpen(
  session: PractitionerSession,
  patient: PatientSummary,
  source: PatientAccessSource,
  outcome: AuditOutcome,
  locale?: string,
): void {
  postAuditEvent(
    buildEvent(session, 'patient.karton.open', outcome, {
      correlationId: correlationForPatient(patient.id),
      patient: patientPayload(patient),
      context: { source, locale },
    }),
  );
}

export function logPatientResourceView(
  session: PractitionerSession,
  patient: PatientSummary,
  selection: KartonSelection,
  source?: PatientAccessSource,
  locale?: string,
): void {
  postAuditEvent(
    buildEvent(session, 'patient.resource.view', 'success', {
      correlationId: correlationForPatient(patient.id),
      patient: patientPayload(patient),
      resource: { type: selection.kind, id: selection.id },
      context: source || locale ? { source, locale } : undefined,
    }),
  );
}
