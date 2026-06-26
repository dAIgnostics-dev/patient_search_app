import type { PractitionerSession } from '../auth/types';
import type {
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
    role: 'clinician',
    organizationId: null,
  };
}

export async function createEncounter(
  session: PractitionerSession,
  input: CreateEncounterInput,
): Promise<CreateEncounterResult> {
  return encounterManagementService.createEncounter(toContext(session), input);
}

export async function updateEncounter(
  session: PractitionerSession,
  input: UpdateEncounterInput,
): Promise<UpdateEncounterResult> {
  return encounterManagementService.updateEncounter(toContext(session), input);
}

export async function closeEncounter(
  session: PractitionerSession,
  input: CloseEncounterInput,
): Promise<CloseEncounterResult> {
  return encounterManagementService.closeEncounter(toContext(session), input);
}

export async function cancelEncounter(
  session: PractitionerSession,
  input: CancelEncounterInput,
): Promise<CancelEncounterResult> {
  return encounterManagementService.cancelEncounter(toContext(session), input);
}

export async function reopenEncounter(
  session: PractitionerSession,
  input: ReopenEncounterInput,
): Promise<ReopenEncounterResult> {
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
