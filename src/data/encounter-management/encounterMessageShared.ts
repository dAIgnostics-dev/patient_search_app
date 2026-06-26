import type { FhirEncounter, FhirMessageBundle } from '../../fhir/types';
import {
  CEZIH_EHE_MESSAGE_TYPES,
  CEZIH_HZJZ_SYSTEM,
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_LOCAL_VISIT_ID_SYSTEM,
  CEZIH_MBO_SYSTEM,
  CEZIH_NACIN_PRIJEMA_SYSTEM,
  CEZIH_OSLOBODJENJE_SYSTEM,
  CEZIH_SLUCAJ_SYSTEM,
  CEZIH_SUDJELOVANJE_SYSTEM,
  CEZIH_TROSKOVI_EXTENSION_URL,
  CEZIH_VISIT_SYSTEM,
  FHIR_ACT_PRIORITY_SYSTEM,
} from '../../fhir/types';
import type { EncounterMessageBodyInput, EncounterMessageContext } from './types';

export type EncounterMessageHeaderInput = Pick<
  EncounterMessageBodyInput,
  'practitionerHzjzId' | 'organizationHzzoCode'
>;

export const ADMISSION_CLASS_OPTIONS = [
  { code: '9', displayHr: 'Interna uputnica', displayEn: 'Internal referral' },
  { code: '1', displayHr: 'Hitna medicinska pomoć', displayEn: 'Emergency care' },
  { code: '2', displayHr: 'Ambulantno', displayEn: 'Outpatient' },
] as const;

export const PRIORITY_OPTIONS = [
  { code: 'R', displayHr: 'Rutinski', displayEn: 'Routine' },
  { code: 'UR', displayHr: 'Hitno', displayEn: 'Urgent' },
  { code: 'EL', displayHr: 'Elektivno', displayEn: 'Elective' },
  { code: 'EM', displayHr: 'Emergentno', displayEn: 'Emergency' },
] as const;

export function formatPriorityLabel(code: string | null | undefined, locale: 'hr' | 'en'): string | null {
  if (!code?.trim()) return null;
  const option = PRIORITY_OPTIONS.find((item) => item.code === code.trim());
  if (!option) return code;
  const label = locale === 'hr' ? option.displayHr : option.displayEn;
  return `${option.code} — ${label}`;
}

export function newMessageUuid(): string {
  return crypto.randomUUID();
}

function buildParticipantList(input: EncounterMessageBodyInput) {
  const hzjzIds = [
    input.practitionerHzjzId.trim(),
    ...(input.additionalParticipants ?? [])
      .map((p) => p.hzjzId.trim())
      .filter((id) => id && id !== input.practitionerHzjzId.trim()),
  ];

  return hzjzIds.map((hzjzId) => ({
    individual: {
      type: 'Practitioner',
      identifier: {
        system: CEZIH_HZJZ_SYSTEM,
        value: hzjzId,
      },
    },
  }));
}

function buildIdentifiers(input: EncounterMessageBodyInput, visitId?: string) {
  const identifiers: Array<{ system: string; value: string }> = [];
  // Service-assigned visit ID: included on update (1.2) for lookup only; CEZIH ignores changes.
  if (visitId?.trim()) {
    identifiers.push({ system: CEZIH_VISIT_SYSTEM, value: visitId.trim() });
  }
  // Local identifiers may be added, changed, or removed on update.
  if (input.localIdentifier?.trim()) {
    identifiers.push({
      system: CEZIH_LOCAL_VISIT_ID_SYSTEM,
      value: input.localIdentifier.trim(),
    });
  }
  return identifiers.length > 0 ? identifiers : undefined;
}

export function buildEncounterBody(
  input: EncounterMessageBodyInput,
  /** Service visit ID (CEZIH 1.2): required to identify the encounter; must not be changed. */
  options?: { visitId?: string },
): FhirEncounter {
  const encounter: FhirEncounter = {
    resourceType: 'Encounter',
    // Status is always in-progress for create (1.1) and update (1.2).
    // Closing or cancelling uses separate CEZIH message events.
    status: 'in-progress',
    identifier: buildIdentifiers(input, options?.visitId),
    class: {
      system: CEZIH_NACIN_PRIJEMA_SYSTEM,
      code: input.classCode.trim(),
      display: input.classDisplay?.trim() || undefined,
    },
    subject: {
      type: 'Patient',
      identifier: {
        system: CEZIH_MBO_SYSTEM,
        value: input.patientMbo.trim(),
      },
    },
    participant: buildParticipantList(input),
    period: {
      start: input.periodStart.trim(),
    },
    serviceProvider: {
      type: 'Organization',
      identifier: {
        system: CEZIH_HZZO_ORG_SYSTEM,
        value: input.organizationHzzoCode.trim(),
      },
    },
  };

  if (input.encounterType?.code?.trim()) {
    encounter.type = [
      {
        coding: [
          {
            code: input.encounterType.code.trim(),
            display: input.encounterType.display?.trim() || undefined,
          },
        ],
      },
    ];
  }

  if (input.priorityCode?.trim()) {
    encounter.priority = {
      coding: [
        {
          system: FHIR_ACT_PRIORITY_SYSTEM,
          code: input.priorityCode.trim(),
        },
      ],
    };
  }

  if (input.diagnosisCaseIds?.length) {
    encounter.diagnosis = input.diagnosisCaseIds
      .map((caseId) => caseId.trim())
      .filter(Boolean)
      .map((caseId) => ({
        condition: {
          type: 'Condition',
          identifier: {
            system: CEZIH_SLUCAJ_SYSTEM,
            value: caseId,
          },
        },
      }));
  }

  if (input.participationCost?.oznaka?.trim()) {
    const nested: Array<{ url: string; valueCoding: { system: string; code: string } }> = [
      {
        url: 'oznaka',
        valueCoding: {
          system: CEZIH_SUDJELOVANJE_SYSTEM,
          code: input.participationCost.oznaka.trim(),
        },
      },
    ];
    if (input.participationCost.sifraOslobodjenja?.trim()) {
      nested.push({
        url: 'sifra-oslobodjenja',
        valueCoding: {
          system: CEZIH_OSLOBODJENJE_SYSTEM,
          code: input.participationCost.sifraOslobodjenja.trim(),
        },
      });
    }
    encounter.extension = [
      {
        url: CEZIH_TROSKOVI_EXTENSION_URL,
        extension: nested,
      },
    ];
  }

  return encounter;
}

export function buildMessageHeader(
  eventCode: string,
  input: EncounterMessageHeaderInput,
  context: EncounterMessageContext,
  encounterFullUrl: string,
) {
  return {
    resourceType: 'MessageHeader' as const,
    eventCoding: {
      system: CEZIH_EHE_MESSAGE_TYPES,
      code: eventCode,
    },
    sender: {
      type: 'Organization',
      identifier: {
        system: CEZIH_HZZO_ORG_SYSTEM,
        value: input.organizationHzzoCode.trim(),
      },
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
    focus: [{ reference: encounterFullUrl }],
  };
}

export function buildEncounterMessageBundle(
  eventCode: string,
  input: EncounterMessageHeaderInput,
  context: EncounterMessageContext,
  encounterBody: FhirEncounter,
): FhirMessageBundle {
  const bundleId = newMessageUuid();
  const messageHeaderId = newMessageUuid();
  const encounterEntryId = newMessageUuid();
  const encounterFullUrl = `urn:uuid:${encounterEntryId}`;

  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'message',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${messageHeaderId}`,
        resource: buildMessageHeader(eventCode, input, context, encounterFullUrl),
      },
      {
        fullUrl: encounterFullUrl,
        resource: encounterBody,
      },
    ],
  };
}
