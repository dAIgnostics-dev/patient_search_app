import type { FhirCondition, FhirMessageBundle } from '../../fhir/types';
import {
  CEZIH_ANNOTATION_TYPE_EXTENSION_URL,
  CEZIH_ANNOTATION_TYPE_SYSTEM,
  CEZIH_EHE_MESSAGE_TYPES,
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_HZJZ_SYSTEM,
  CEZIH_ICD10_HR_SYSTEM,
  CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM,
  CEZIH_MBO_SYSTEM,
  CEZIH_VISIT_SYSTEM,
  FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
  FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
} from '../../fhir/types';
import type { CaseMessageContext, CreateCaseInput, CreateCaseRecurrenceInput } from './types';
import type {
  DeleteCaseInput,
  RelapseCaseInput,
  RemissionCaseInput,
  ResolveCaseInput,
  UpdateCaseInput,
} from './types';

export const CASE_VERIFICATION_STATUS_OPTIONS = [
  { code: 'unconfirmed', displayHr: 'Nepotvrđena', displayEn: 'Unconfirmed' },
  { code: 'provisional', displayHr: 'Provizorna', displayEn: 'Provisional' },
  { code: 'confirmed', displayHr: 'Potvrđena', displayEn: 'Confirmed' },
] as const;

export function formatCaseVerificationStatusLabel(
  code: string | null | undefined,
  locale: 'hr' | 'en',
): string | null {
  if (!code?.trim()) return null;
  const option = CASE_VERIFICATION_STATUS_OPTIONS.find((item) => item.code === code.trim());
  if (!option) return code;
  return locale === 'hr' ? option.displayHr : option.displayEn;
}

export function newCaseMessageUuid(): string {
  return crypto.randomUUID();
}

type CaseBodyInput = CreateCaseInput | CreateCaseRecurrenceInput;
type StatusChangeCaseInput = RelapseCaseInput | RemissionCaseInput;
type CaseHeaderInput =
  | CaseBodyInput
  | DeleteCaseInput
  | StatusChangeCaseInput
  | ResolveCaseInput
  | UpdateCaseInput;

export function buildConditionBody(input: CaseBodyInput): FhirCondition {
  const condition: FhirCondition = {
    resourceType: 'Condition',
    identifier: input.localIdentifier?.trim()
      ? [
          {
            system: CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM,
            value: input.localIdentifier.trim(),
          },
        ]
      : undefined,
    verificationStatus: {
      coding: [
        {
          system: FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
          code: input.verificationStatus,
        },
      ],
    },
    code: {
      coding: [
        {
          system: CEZIH_ICD10_HR_SYSTEM,
          code: input.diagnosisCode.trim(),
          display: input.diagnosisDisplay.trim(),
        },
      ],
      text: input.diagnosisText?.trim() || input.diagnosisDisplay.trim(),
    },
    subject: {
      type: 'Patient',
      identifier: {
        system: CEZIH_MBO_SYSTEM,
        value: input.patientMbo.trim(),
      },
    },
    encounter: {
      type: 'Encounter',
      identifier: {
        system: CEZIH_VISIT_SYSTEM,
        value: input.encounterVisitId.trim(),
      },
    },
    onsetDateTime: input.onsetDate.trim(),
    asserter: {
      type: 'Practitioner',
      identifier: {
        system: CEZIH_HZJZ_SYSTEM,
        value: input.practitionerHzjzId.trim(),
      },
    },
  };

  if (input.note?.trim()) {
    condition.note = [
      {
        extension: [
          {
            url: CEZIH_ANNOTATION_TYPE_EXTENSION_URL,
            valueCoding: {
              system: CEZIH_ANNOTATION_TYPE_SYSTEM,
              code: '4',
            },
          },
        ],
        text: input.note.trim(),
      },
    ];
  }

  return condition;
}

function buildAnnotation(text: string, code: '1' | '4') {
  return {
    extension: [
      {
        url: CEZIH_ANNOTATION_TYPE_EXTENSION_URL,
        valueCoding: {
          system: CEZIH_ANNOTATION_TYPE_SYSTEM,
          code,
        },
      },
    ],
    text,
  };
}

export function buildDeleteConditionBody(input: DeleteCaseInput): FhirCondition {
  const note = [];
  if (input.note?.trim()) {
    note.push(buildAnnotation(input.note.trim(), '4'));
  }
  note.push(buildAnnotation(input.reason.trim(), '1'));

  return {
    resourceType: 'Condition',
    identifier: [
      {
        system: CEZIH_CASE_IDENTIFIER_SYSTEM,
        value: input.caseId.trim(),
      },
    ],
    subject: {
      type: 'Patient',
      identifier: {
        system: CEZIH_MBO_SYSTEM,
        value: input.patientMbo.trim(),
      },
    },
    note,
  };
}

function buildStatusChangeConditionBody(input: StatusChangeCaseInput): FhirCondition {
  return {
    resourceType: 'Condition',
    identifier: [
      {
        system: CEZIH_CASE_IDENTIFIER_SYSTEM,
        value: input.caseId.trim(),
      },
    ],
    subject: {
      type: 'Patient',
      identifier: {
        system: CEZIH_MBO_SYSTEM,
        value: input.patientMbo.trim(),
      },
    },
  };
}

export function buildRelapseConditionBody(input: RelapseCaseInput): FhirCondition {
  return buildStatusChangeConditionBody(input);
}

export function buildRemissionConditionBody(input: RemissionCaseInput): FhirCondition {
  return buildStatusChangeConditionBody(input);
}

export function buildResolveConditionBody(input: ResolveCaseInput): FhirCondition {
  return {
    resourceType: 'Condition',
    identifier: [
      {
        system: CEZIH_CASE_IDENTIFIER_SYSTEM,
        value: input.caseId.trim(),
      },
    ],
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: 'resolved',
        },
      ],
    },
    subject: {
      type: 'Patient',
      identifier: {
        system: CEZIH_MBO_SYSTEM,
        value: input.patientMbo.trim(),
      },
    },
    abatementDateTime: input.abatementDate.trim(),
  };
}

export function buildUpdateConditionBody(input: UpdateCaseInput): FhirCondition {
  const identifiers = [
    {
      system: CEZIH_CASE_IDENTIFIER_SYSTEM,
      value: input.caseId.trim(),
    },
  ];

  if (input.localIdentifier?.trim()) {
    identifiers.push({
      system: CEZIH_LOCAL_CASE_IDENTIFIER_SYSTEM,
      value: input.localIdentifier.trim(),
    });
  }

  const condition: FhirCondition = {
    resourceType: 'Condition',
    identifier: identifiers,
    clinicalStatus: {
      coding: [
        {
          system: FHIR_CONDITION_CLINICAL_STATUS_SYSTEM,
          code: input.clinicalStatus.trim(),
        },
      ],
    },
    subject: {
      type: 'Patient',
      identifier: {
        system: CEZIH_MBO_SYSTEM,
        value: input.patientMbo.trim(),
      },
    },
    asserter: {
      type: 'Practitioner',
      identifier: {
        system: CEZIH_HZJZ_SYSTEM,
        value: input.practitionerHzjzId.trim(),
      },
    },
  };

  if (input.verificationStatus?.trim()) {
    condition.verificationStatus = {
      coding: [
        {
          system: FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
          code: input.verificationStatus.trim(),
        },
      ],
    };
  }

  if (input.diagnosisCode?.trim() && input.diagnosisDisplay?.trim()) {
    condition.code = {
      coding: [
        {
          system: CEZIH_ICD10_HR_SYSTEM,
          code: input.diagnosisCode.trim(),
          display: input.diagnosisDisplay.trim(),
        },
      ],
      text: input.diagnosisText?.trim() || input.diagnosisDisplay.trim(),
    };
  }

  if (input.onsetDate?.trim()) {
    condition.onsetDateTime = input.onsetDate.trim();
  }

  if (input.abatementDate?.trim()) {
    condition.abatementDateTime = input.abatementDate.trim();
  }

  if (input.note?.trim()) {
    condition.note = [buildAnnotation(input.note.trim(), '4')];
  }

  return condition;
}

function buildMessageHeader(
  eventCode: string,
  input: Pick<CaseHeaderInput, 'practitionerHzjzId'>,
  context: CaseMessageContext,
  conditionFullUrl: string,
) {
  return {
    resourceType: 'MessageHeader' as const,
    eventCoding: {
      system: CEZIH_EHE_MESSAGE_TYPES,
      code: eventCode,
    },
    author: {
      type: 'Practitioner',
      identifier: {
        system: CEZIH_HZJZ_SYSTEM,
        value: input.practitionerHzjzId.trim(),
      },
    },
    source: {
      endpoint: context.sourceEndpoint,
    },
    focus: [{ reference: conditionFullUrl }],
  };
}

export function buildCaseMessageBundle(
  eventCode: string,
  input: CaseHeaderInput,
  context: CaseMessageContext,
  conditionBody: FhirCondition,
): FhirMessageBundle {
  const bundleId = newCaseMessageUuid();
  const messageHeaderId = newCaseMessageUuid();
  const conditionEntryId = newCaseMessageUuid();
  const conditionFullUrl = `urn:uuid:${conditionEntryId}`;

  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'message',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${messageHeaderId}`,
        resource: buildMessageHeader(eventCode, input, context, conditionFullUrl),
      },
      {
        fullUrl: conditionFullUrl,
        resource: conditionBody,
      },
    ],
  };
}
