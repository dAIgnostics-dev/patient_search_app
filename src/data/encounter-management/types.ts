import type { EncounterSummary } from '../../domain/models';

export interface EncounterParticipantInput {
  hzjzId: string;
}

export interface EncounterMessageBodyInput {
  patientMbo: string;
  practitionerHzjzId: string;
  organizationHzzoCode: string;
  periodStart: string;
  classCode: string;
  classDisplay?: string;
  localIdentifier?: string;
  participationCost?: { oznaka: string; sifraOslobodjenja?: string };
  encounterType?: { code: string; display?: string };
  additionalParticipants?: EncounterParticipantInput[];
  priorityCode?: string;
  diagnosisCaseIds?: string[];
}

export interface CreateEncounterInput extends EncounterMessageBodyInput {}

export interface UpdateEncounterInput extends EncounterMessageBodyInput {
  visitId: string;
}

/** Shared payload for close (1.3) and cancel (1.4) encounter messages. */
export interface EncounterStatusChangeInput {
  visitId: string;
  practitionerHzjzId: string;
  organizationHzzoCode: string;
  periodStart: string;
  periodEnd: string;
  classCode: string;
  classDisplay?: string;
  diagnosisCaseIds?: string[];
}

export interface CloseEncounterInput extends EncounterStatusChangeInput {}

export interface CancelEncounterInput extends EncounterStatusChangeInput {}

export interface ReopenEncounterInput
  extends Pick<
    EncounterStatusChangeInput,
    'visitId' | 'practitionerHzjzId' | 'organizationHzzoCode' | 'classCode' | 'classDisplay'
  > {}

export interface EncounterValidationIssue {
  field: string;
  message: string;
}

export type CreateEncounterValidationIssue = EncounterValidationIssue;

export type EncounterManagementResult =
  | {
      outcome: 'success';
      requestBundleId: string;
      encounterId: string;
      visitId: string;
      encounter: EncounterSummary;
    }
  | {
      outcome: 'error';
      requestBundleId: string;
      issues: Array<{ severity: string; code: string; diagnostics?: string }>;
    };

export type CreateEncounterResult = EncounterManagementResult;
export type UpdateEncounterResult = EncounterManagementResult;
export type CloseEncounterResult = EncounterManagementResult;
export type CancelEncounterResult = EncounterManagementResult;
export type ReopenEncounterResult = EncounterManagementResult;

export interface EncounterMessageContext {
  sourceEndpoint: string;
}

/** @deprecated Use EncounterMessageContext */
export type CreateEncounterMessageContext = EncounterMessageContext;
