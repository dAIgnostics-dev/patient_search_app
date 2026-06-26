import type { ConditionSummary } from '../../domain/models';

export type CaseVerificationStatusCode = 'confirmed' | 'unconfirmed' | 'provisional';

export interface CreateCaseInput {
  patientMbo: string;
  practitionerHzjzId: string;
  encounterVisitId: string;
  onsetDate: string;
  diagnosisCode: string;
  diagnosisDisplay: string;
  diagnosisText?: string;
  verificationStatus: CaseVerificationStatusCode;
  localIdentifier?: string;
  note?: string;
}

export interface CreateCaseRecurrenceInput extends CreateCaseInput {
  previousCaseId: string;
}

export interface DeleteCaseInput {
  caseId: string;
  patientMbo: string;
  practitionerHzjzId: string;
  reason: string;
  note?: string;
}

export interface RelapseCaseInput {
  caseId: string;
  patientMbo: string;
  practitionerHzjzId: string;
}

export interface RemissionCaseInput {
  caseId: string;
  patientMbo: string;
  practitionerHzjzId: string;
}

export interface ResolveCaseInput {
  caseId: string;
  patientMbo: string;
  practitionerHzjzId: string;
  abatementDate: string;
}

export interface UpdateCaseInput {
  caseId: string;
  patientMbo: string;
  practitionerHzjzId: string;
  clinicalStatus: string;
  localIdentifier?: string;
  verificationStatus?: CaseVerificationStatusCode;
  diagnosisCode?: string;
  diagnosisDisplay?: string;
  diagnosisText?: string;
  onsetDate?: string;
  abatementDate?: string;
  note?: string;
}

export interface CaseValidationIssue {
  field: string;
  message: string;
}

export type CaseManagementResult =
  | {
      outcome: 'success';
      requestBundleId: string;
      conditionId: string;
      caseId: string;
      condition: ConditionSummary;
    }
  | {
      outcome: 'error';
      requestBundleId: string;
      issues: Array<{ severity: string; code: string; diagnostics?: string }>;
    };

export type CreateCaseResult = CaseManagementResult;
export type CreateCaseRecurrenceResult = CaseManagementResult;
export type DeleteCaseResult = CaseManagementResult;
export type RelapseCaseResult = CaseManagementResult;
export type RemissionCaseResult = CaseManagementResult;
export type ResolveCaseResult = CaseManagementResult;
export type UpdateCaseResult = CaseManagementResult;

export interface CaseMessageContext {
  sourceEndpoint: string;
}
