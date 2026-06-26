import type { PractitionerSession } from '../auth/types';
import type {
  CreateCaseInput,
  CreateCaseRecurrenceInput,
  CreateCaseRecurrenceResult,
  CreateCaseResult,
  DeleteCaseInput,
  DeleteCaseResult,
  RemissionCaseInput,
  RemissionCaseResult,
  RelapseCaseInput,
  RelapseCaseResult,
  ResolveCaseInput,
  ResolveCaseResult,
  UpdateCaseInput,
  UpdateCaseResult,
} from './case-management/types';
import { caseManagementService } from './services/caseManagementService';
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

export async function createCase(
  session: PractitionerSession,
  input: CreateCaseInput,
): Promise<CreateCaseResult> {
  return caseManagementService.createCase(toContext(session), input);
}

export async function createCaseRecurrence(
  session: PractitionerSession,
  input: CreateCaseRecurrenceInput,
): Promise<CreateCaseRecurrenceResult> {
  return caseManagementService.createCaseRecurrence(toContext(session), input);
}

export async function deleteCase(
  session: PractitionerSession,
  input: DeleteCaseInput,
): Promise<DeleteCaseResult> {
  return caseManagementService.deleteCase(toContext(session), input);
}

export async function updateCase(
  session: PractitionerSession,
  input: UpdateCaseInput,
): Promise<UpdateCaseResult> {
  return caseManagementService.updateCase(toContext(session), input);
}

export async function relapseCase(
  session: PractitionerSession,
  input: RelapseCaseInput,
): Promise<RelapseCaseResult> {
  return caseManagementService.relapseCase(toContext(session), input);
}

export async function remissionCase(
  session: PractitionerSession,
  input: RemissionCaseInput,
): Promise<RemissionCaseResult> {
  return caseManagementService.remissionCase(toContext(session), input);
}

export async function resolveCase(
  session: PractitionerSession,
  input: ResolveCaseInput,
): Promise<ResolveCaseResult> {
  return caseManagementService.resolveCase(toContext(session), input);
}

export type {
  CreateCaseInput,
  CreateCaseRecurrenceInput,
  CreateCaseRecurrenceResult,
  CreateCaseResult,
  DeleteCaseInput,
  DeleteCaseResult,
  RemissionCaseInput,
  RemissionCaseResult,
  RelapseCaseInput,
  RelapseCaseResult,
  ResolveCaseInput,
  ResolveCaseResult,
  UpdateCaseInput,
  UpdateCaseResult,
};
