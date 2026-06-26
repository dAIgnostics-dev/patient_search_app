import { resolveCezihSourceEndpoint } from '../../config/runtime';
import { buildCreateEncounterMessage } from '../encounter-management/buildCreateEncounterMessage';
import { buildCancelEncounterMessage } from '../encounter-management/buildCancelEncounterMessage';
import { buildCloseEncounterMessage } from '../encounter-management/buildCloseEncounterMessage';
import { buildReopenEncounterMessage } from '../encounter-management/buildReopenEncounterMessage';
import { buildUpdateEncounterMessage } from '../encounter-management/buildUpdateEncounterMessage';
import { parseEncounterManagementResponse } from '../encounter-management/parseEncounterManagementResponse';
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
} from '../encounter-management/types';
import { validateCancelEncounterInput } from '../encounter-management/validateCancelEncounterInput';
import { validateCloseEncounterInput } from '../encounter-management/validateCloseEncounterInput';
import { validateCreateEncounterInput } from '../encounter-management/validateCreateEncounterInput';
import { validateReopenEncounterInput } from '../encounter-management/validateReopenEncounterInput';
import { validateUpdateEncounterInput } from '../encounter-management/validateUpdateEncounterInput';
import { getCezihMessageClient } from '../fhir-client/cezihMessageClientFactory';
import type { ClinicianContext } from './types';

function mapValidationIssues(
  issues: Array<{ field: string; message: string }>,
): CreateEncounterResult {
  return {
    outcome: 'error',
    requestBundleId: '',
    issues: issues.map((issue) => ({
      severity: 'error',
      code: 'invalid',
      diagnostics: `${issue.field}: ${issue.message}`,
    })),
  };
}

function resolvePractitionerHzjzId(
  context: ClinicianContext,
  inputHzjzId: string | undefined,
): string | null {
  return inputHzjzId?.trim() || context.hzjzId?.trim() || null;
}

export class EncounterManagementService {
  async createEncounter(
    context: ClinicianContext,
    input: CreateEncounterInput,
  ): Promise<CreateEncounterResult> {
    const validationIssues = validateCreateEncounterInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        requestBundleId: '',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const normalizedInput: CreateEncounterInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildCreateEncounterMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseEncounterManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: 'error',
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics: err instanceof Error ? err.message : 'Encounter creation failed.',
          },
        ],
      };
    }
  }

  async updateEncounter(
    context: ClinicianContext,
    input: UpdateEncounterInput,
  ): Promise<UpdateEncounterResult> {
    const validationIssues = validateUpdateEncounterInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        requestBundleId: '',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const normalizedInput: UpdateEncounterInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildUpdateEncounterMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseEncounterManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: 'error',
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics: err instanceof Error ? err.message : 'Encounter update failed.',
          },
        ],
      };
    }
  }

  async closeEncounter(
    context: ClinicianContext,
    input: CloseEncounterInput,
  ): Promise<CloseEncounterResult> {
    const validationIssues = validateCloseEncounterInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        requestBundleId: '',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const normalizedInput: CloseEncounterInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildCloseEncounterMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseEncounterManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: 'error',
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics: err instanceof Error ? err.message : 'Encounter close failed.',
          },
        ],
      };
    }
  }

  async cancelEncounter(
    context: ClinicianContext,
    input: CancelEncounterInput,
  ): Promise<CancelEncounterResult> {
    const validationIssues = validateCancelEncounterInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        requestBundleId: '',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const normalizedInput: CancelEncounterInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildCancelEncounterMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseEncounterManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: 'error',
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics: err instanceof Error ? err.message : 'Encounter cancel failed.',
          },
        ],
      };
    }
  }

  async reopenEncounter(
    context: ClinicianContext,
    input: ReopenEncounterInput,
  ): Promise<ReopenEncounterResult> {
    const validationIssues = validateReopenEncounterInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(context, input.practitionerHzjzId);
    if (!practitionerHzjzId) {
      return {
        outcome: 'error',
        requestBundleId: '',
        issues: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Practitioner HZJZ ID is required in clinician context.',
          },
        ],
      };
    }

    const normalizedInput: ReopenEncounterInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildReopenEncounterMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseEncounterManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: 'error',
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: 'fatal',
            code: 'exception',
            diagnostics: err instanceof Error ? err.message : 'Encounter reopen failed.',
          },
        ],
      };
    }
  }
}

export const encounterManagementService = new EncounterManagementService();
