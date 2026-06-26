import { resolveCezihSourceEndpoint } from "../../config/runtime";
import { buildCreateCaseMessage } from "../case-management/buildCreateCaseMessage";
import { buildCreateCaseRecurrenceMessage } from "../case-management/buildCreateCaseRecurrenceMessage";
import { buildDeleteCaseMessage } from "../case-management/buildDeleteCaseMessage";
import { buildRemissionCaseMessage } from "../case-management/buildRemissionCaseMessage";
import { buildRelapseCaseMessage } from "../case-management/buildRelapseCaseMessage";
import { buildResolveCaseMessage } from "../case-management/buildResolveCaseMessage";
import { buildUpdateCaseMessage } from "../case-management/buildUpdateCaseMessage";
import { parseCaseManagementResponse } from "../case-management/parseCaseManagementResponse";
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
} from "../case-management/types";
import { validateCreateCaseInput } from "../case-management/validateCreateCaseInput";
import { validateCreateCaseRecurrenceInput } from "../case-management/validateCreateCaseRecurrenceInput";
import { validateDeleteCaseInput } from "../case-management/validateDeleteCaseInput";
import { validateRemissionCaseInput } from "../case-management/validateRemissionCaseInput";
import { validateRelapseCaseInput } from "../case-management/validateRelapseCaseInput";
import { validateResolveCaseInput } from "../case-management/validateResolveCaseInput";
import { validateUpdateCaseInput } from "../case-management/validateUpdateCaseInput";
import { getCezihMessageClient } from "../fhir-client/cezihMessageClientFactory";
import type { ClinicianContext } from "./types";

function mapValidationIssues(
  issues: Array<{ field: string; message: string }>,
): CaseManagementResult {
  return {
    outcome: "error",
    requestBundleId: "",
    issues: issues.map((issue) => ({
      severity: "error",
      code: "invalid",
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

export class CaseManagementService {
  async createCase(
    context: ClinicianContext,
    input: CreateCaseInput,
  ): Promise<CreateCaseResult> {
    const validationIssues = validateCreateCaseInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(
      context,
      input.practitionerHzjzId,
    );
    if (!practitionerHzjzId) {
      return {
        outcome: "error",
        requestBundleId: "",
        issues: [
          {
            severity: "error",
            code: "invalid",
            diagnostics:
              "Practitioner HZJZ ID is required in clinician context.",
          },
        ],
      };
    }

    const normalizedInput: CreateCaseInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildCreateCaseMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseCaseManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: "error",
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics:
              err instanceof Error ? err.message : "Case creation failed.",
          },
        ],
      };
    }
  }

  async createCaseRecurrence(
    context: ClinicianContext,
    input: CreateCaseRecurrenceInput,
  ): Promise<CreateCaseRecurrenceResult> {
    const validationIssues = validateCreateCaseRecurrenceInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(
      context,
      input.practitionerHzjzId,
    );
    if (!practitionerHzjzId) {
      return {
        outcome: "error",
        requestBundleId: "",
        issues: [
          {
            severity: "error",
            code: "invalid",
            diagnostics:
              "Practitioner HZJZ ID is required in clinician context.",
          },
        ],
      };
    }

    const normalizedInput: CreateCaseRecurrenceInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildCreateCaseRecurrenceMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseCaseManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: "error",
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics:
              err instanceof Error ? err.message : "Case recurrence creation failed.",
          },
        ],
      };
    }
  }

  async updateCase(
    context: ClinicianContext,
    input: UpdateCaseInput,
  ): Promise<UpdateCaseResult> {
    const validationIssues = validateUpdateCaseInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(
      context,
      input.practitionerHzjzId,
    );
    if (!practitionerHzjzId) {
      return {
        outcome: "error",
        requestBundleId: "",
        issues: [
          {
            severity: "error",
            code: "invalid",
            diagnostics:
              "Practitioner HZJZ ID is required in clinician context.",
          },
        ],
      };
    }

    const normalizedInput: UpdateCaseInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildUpdateCaseMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseCaseManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: "error",
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics:
              err instanceof Error ? err.message : "Case update failed.",
          },
        ],
      };
    }
  }

  async deleteCase(
    context: ClinicianContext,
    input: DeleteCaseInput,
  ): Promise<DeleteCaseResult> {
    const validationIssues = validateDeleteCaseInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(
      context,
      input.practitionerHzjzId,
    );
    if (!practitionerHzjzId) {
      return {
        outcome: "error",
        requestBundleId: "",
        issues: [
          {
            severity: "error",
            code: "invalid",
            diagnostics:
              "Practitioner HZJZ ID is required in clinician context.",
          },
        ],
      };
    }

    const normalizedInput: DeleteCaseInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildDeleteCaseMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseCaseManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: "error",
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics:
              err instanceof Error ? err.message : "Case deletion failed.",
          },
        ],
      };
    }
  }

  async relapseCase(
    context: ClinicianContext,
    input: RelapseCaseInput,
  ): Promise<RelapseCaseResult> {
    const validationIssues = validateRelapseCaseInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(
      context,
      input.practitionerHzjzId,
    );
    if (!practitionerHzjzId) {
      return {
        outcome: "error",
        requestBundleId: "",
        issues: [
          {
            severity: "error",
            code: "invalid",
            diagnostics:
              "Practitioner HZJZ ID is required in clinician context.",
          },
        ],
      };
    }

    const normalizedInput: RelapseCaseInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildRelapseCaseMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseCaseManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: "error",
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics:
              err instanceof Error ? err.message : "Case relapse failed.",
          },
        ],
      };
    }
  }

  async remissionCase(
    context: ClinicianContext,
    input: RemissionCaseInput,
  ): Promise<RemissionCaseResult> {
    const validationIssues = validateRemissionCaseInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(
      context,
      input.practitionerHzjzId,
    );
    if (!practitionerHzjzId) {
      return {
        outcome: "error",
        requestBundleId: "",
        issues: [
          {
            severity: "error",
            code: "invalid",
            diagnostics:
              "Practitioner HZJZ ID is required in clinician context.",
          },
        ],
      };
    }

    const normalizedInput: RemissionCaseInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildRemissionCaseMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseCaseManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: "error",
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics:
              err instanceof Error ? err.message : "Case remission failed.",
          },
        ],
      };
    }
  }

  async resolveCase(
    context: ClinicianContext,
    input: ResolveCaseInput,
  ): Promise<ResolveCaseResult> {
    const validationIssues = validateResolveCaseInput(input);
    if (validationIssues.length > 0) {
      return mapValidationIssues(validationIssues);
    }

    const practitionerHzjzId = resolvePractitionerHzjzId(
      context,
      input.practitionerHzjzId,
    );
    if (!practitionerHzjzId) {
      return {
        outcome: "error",
        requestBundleId: "",
        issues: [
          {
            severity: "error",
            code: "invalid",
            diagnostics:
              "Practitioner HZJZ ID is required in clinician context.",
          },
        ],
      };
    }

    const normalizedInput: ResolveCaseInput = {
      ...input,
      practitionerHzjzId,
    };

    const requestBundle = buildResolveCaseMessage(normalizedInput, {
      sourceEndpoint: resolveCezihSourceEndpoint(),
    });

    try {
      const response = await getCezihMessageClient().postMessage(requestBundle);
      return parseCaseManagementResponse(requestBundle.id, response);
    } catch (err) {
      return {
        outcome: "error",
        requestBundleId: requestBundle.id,
        issues: [
          {
            severity: "fatal",
            code: "exception",
            diagnostics:
              err instanceof Error ? err.message : "Case resolve failed.",
          },
        ],
      };
    }
  }
}

export const caseManagementService = new CaseManagementService();
