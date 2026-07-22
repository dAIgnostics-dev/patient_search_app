import { canManageCases } from '../auth/roles';
import type { PractitionerSession } from '../auth/types';
import type {
  CaseManagementResult,
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
    role: session.role,
    organizationId: null,
  };
}

/**
 * Preduvjet autorizacije: samo dozvoljene uloge smiju izvoditi operacije nad
 * slučajevima. Vraća error rezultat kad uloga nije ovlaštena, bez slanja poruke.
 */
function roleForbiddenResult(): CaseManagementResult {
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

export async function createCase(
  session: PractitionerSession,
  input: CreateCaseInput,
): Promise<CreateCaseResult> {
  if (!canManageCases(session.role)) return roleForbiddenResult();
  return caseManagementService.createCase(toContext(session), input);
}

export async function createCaseRecurrence(
  session: PractitionerSession,
  input: CreateCaseRecurrenceInput,
): Promise<CreateCaseRecurrenceResult> {
  if (!canManageCases(session.role)) return roleForbiddenResult();
  return caseManagementService.createCaseRecurrence(toContext(session), input);
}

export async function deleteCase(
  session: PractitionerSession,
  input: DeleteCaseInput,
): Promise<DeleteCaseResult> {
  if (!canManageCases(session.role)) return roleForbiddenResult();
  return caseManagementService.deleteCase(toContext(session), input);
}

export async function updateCase(
  session: PractitionerSession,
  input: UpdateCaseInput,
): Promise<UpdateCaseResult> {
  if (!canManageCases(session.role)) return roleForbiddenResult();
  return caseManagementService.updateCase(toContext(session), input);
}

export async function relapseCase(
  session: PractitionerSession,
  input: RelapseCaseInput,
): Promise<RelapseCaseResult> {
  if (!canManageCases(session.role)) return roleForbiddenResult();
  return caseManagementService.relapseCase(toContext(session), input);
}

export async function remissionCase(
  session: PractitionerSession,
  input: RemissionCaseInput,
): Promise<RemissionCaseResult> {
  if (!canManageCases(session.role)) return roleForbiddenResult();
  return caseManagementService.remissionCase(toContext(session), input);
}

export async function resolveCase(
  session: PractitionerSession,
  input: ResolveCaseInput,
): Promise<ResolveCaseResult> {
  if (!canManageCases(session.role)) return roleForbiddenResult();
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
