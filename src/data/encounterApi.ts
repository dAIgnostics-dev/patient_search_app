import { canManageEncounters } from '../auth/roles';
import type { PractitionerSession } from '../auth/types';
import type {
  CancelEncounterInput,
  CancelEncounterResult,
  CloseEncounterInput,
  CloseEncounterResult,
  CreateEncounterInput,
  CreateEncounterResult,
  EncounterManagementResult,
  ReopenEncounterInput,
  ReopenEncounterResult,
  UpdateEncounterInput,
  UpdateEncounterResult,
} from './encounter-management/types';
import { encounterManagementService } from './services/encounterManagementService';
import type { ClinicianContext } from './services/types';

function toContext(session: PractitionerSession): ClinicianContext {
  return {
    clinicianId: session.practitionerId,
    hzjzId: session.hzjzId,
    username: session.username,
    firstName: session.firstName,
    lastName: session.lastName,
    auditSessionId: session.auditSessionId,
    role: session.role,
    organizationId: null,
  };
}

/**
 * Preduvjet autorizacije: samo dozvoljene uloge smiju izvoditi operacije nad
 * posjetama. Vraća error rezultat kad uloga nije ovlaštena, bez slanja poruke.
 */
function roleForbiddenResult(): EncounterManagementResult {
  return {
    outcome: 'error',
    requestBundleId: '',
    issues: [
      {
        severity: 'error',
        code: 'forbidden',
        diagnostics: 'role_not_allowed',
      },
    ],
  };
}

export async function createEncounter(
  session: PractitionerSession,
  input: CreateEncounterInput,
): Promise<CreateEncounterResult> {
  if (!canManageEncounters(session.role)) return roleForbiddenResult();
  return encounterManagementService.createEncounter(toContext(session), input);
}

export async function updateEncounter(
  session: PractitionerSession,
  input: UpdateEncounterInput,
): Promise<UpdateEncounterResult> {
  if (!canManageEncounters(session.role)) return roleForbiddenResult();
  return encounterManagementService.updateEncounter(toContext(session), input);
}

export async function closeEncounter(
  session: PractitionerSession,
  input: CloseEncounterInput,
): Promise<CloseEncounterResult> {
  if (!canManageEncounters(session.role)) return roleForbiddenResult();
  return encounterManagementService.closeEncounter(toContext(session), input);
}

export async function cancelEncounter(
  session: PractitionerSession,
  input: CancelEncounterInput,
): Promise<CancelEncounterResult> {
  if (!canManageEncounters(session.role)) return roleForbiddenResult();
  return encounterManagementService.cancelEncounter(toContext(session), input);
}

export async function reopenEncounter(
  session: PractitionerSession,
  input: ReopenEncounterInput,
): Promise<ReopenEncounterResult> {
  if (!canManageEncounters(session.role)) return roleForbiddenResult();
  return encounterManagementService.reopenEncounter(toContext(session), input);
}

export type {
  CancelEncounterInput,
  CancelEncounterResult,
  CloseEncounterInput,
  CloseEncounterResult,
  CreateEncounterInput,
  CreateEncounterResult,
  ReopenEncounterInput,
  ReopenEncounterResult,
  UpdateEncounterInput,
  UpdateEncounterResult,
};
