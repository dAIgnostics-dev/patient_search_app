import type { FhirClinicalDocumentBundle } from '../../fhir/types';
import {
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_DOCUMENT_SECTION_DJELATNOST,
  CEZIH_DOCUMENT_SECTION_MEDICINSKA_INFORMACIJA,
  CEZIH_DOCUMENT_SECTION_PRILOZI,
  CEZIH_DOCUMENT_SECTION_SYSTEM,
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
  CEZIH_DOCUMENT_TYPE_SYSTEM,
  CEZIH_HZJZ_SYSTEM,
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_ICD10_HR_SYSTEM,
  CEZIH_MBO_SYSTEM,
  CEZIH_OBSERVATION_ANAMNEZA_CODE,
  CEZIH_OBSERVATION_ISHOD_PREGLEDA_CODE,
  CEZIH_OBSERVATIONS_SYSTEM,
  CEZIH_VISIT_SYSTEM,
} from '../../fhir/types';
import { DOCUMENT_OUTCOME_OPTIONS, DOCUMENT_OUTCOME_SYSTEM } from './documentOutcomeCatalog';
import type { SubmitDocumentInput } from './types';

export interface BuildSubmitDocumentRequestResult {
  bundle: FhirClinicalDocumentBundle;
  binaryId?: string;
}

function newUuid(): string {
  return crypto.randomUUID();
}

export function buildSubmitDocumentRequest(
  input: SubmitDocumentInput,
  options?: { practitionerName?: string; organizationName?: string },
): BuildSubmitDocumentRequestResult {
  const bundleId = `doc-bundle-${newUuid()}`;
  const documentOid = `urn:oid:2.16.840.1.113883.2.7.50.2.1.${Date.now()}`;
  const prefix = newUuid();
  const compositionRef = `urn:uuid:${prefix}-composition`;
  const encounterRef = `urn:uuid:${prefix}-encounter`;
  const practitionerRef = `urn:uuid:${prefix}-practitioner`;
  const organizationRef = `urn:uuid:${prefix}-organization`;
  const anamnesisRef = `urn:uuid:${prefix}-anamnesis`;
  const outcomeRef = `urn:uuid:${prefix}-outcome`;
  const serviceRef = input.healthcareServiceName?.trim()
    ? `urn:uuid:${prefix}-service`
    : null;
  const conditionRef = input.caseId?.trim() ? `urn:uuid:${prefix}-condition` : null;
  const attachmentRef = input.attachment ? `urn:uuid:${prefix}-attachment` : null;
  const binaryId = input.attachment ? `bin-${newUuid()}` : undefined;

  const outcomeDisplay =
    input.outcomeDisplay ??
    DOCUMENT_OUTCOME_OPTIONS.find((item) => item.code === input.outcomeCode)?.display ??
    input.outcomeCode;

  const medicinskaEntries = [
    { reference: anamnesisRef },
    ...(conditionRef ? [{ reference: conditionRef }] : []),
    { reference: outcomeRef },
  ];

  const sections = [
    ...(serviceRef
      ? [
          {
            title: 'Djelatnost',
            code: {
              coding: [
                {
                  system: CEZIH_DOCUMENT_SECTION_SYSTEM,
                  code: CEZIH_DOCUMENT_SECTION_DJELATNOST,
                  display: 'Djelatnost',
                },
              ],
            },
            entry: [{ reference: serviceRef }],
          },
        ]
      : []),
    ...(attachmentRef
      ? [
          {
            title: 'Priloženi dokumenti',
            code: {
              coding: [
                {
                  system: CEZIH_DOCUMENT_SECTION_SYSTEM,
                  code: CEZIH_DOCUMENT_SECTION_PRILOZI,
                  display: 'Priloženi dokumenti',
                },
              ],
            },
            entry: [{ reference: attachmentRef }],
          },
        ]
      : []),
    {
      title: 'Medicinska informacija',
      code: {
        coding: [
          {
            system: CEZIH_DOCUMENT_SECTION_SYSTEM,
            code: CEZIH_DOCUMENT_SECTION_MEDICINSKA_INFORMACIJA,
            display: 'Medicinska informacija',
          },
        ],
      },
      entry: medicinskaEntries,
    },
  ];

  const bundle: FhirClinicalDocumentBundle = {
    resourceType: 'Bundle',
    id: bundleId,
    identifier: { system: 'urn:ietf:rfc:3986', value: documentOid },
    type: 'document',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: compositionRef,
        resource: {
          resourceType: 'Composition',
          status: 'final',
          type: {
            coding: [
              {
                system: CEZIH_DOCUMENT_TYPE_SYSTEM,
                code: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
                display: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
              },
            ],
          },
          subject: {
            identifier: { system: CEZIH_MBO_SYSTEM, value: input.patientMbo },
          },
          encounter: { reference: encounterRef },
          date: new Date().toISOString(),
          author: [
            {
              reference: practitionerRef,
              display: options?.practitionerName,
            },
            {
              reference: organizationRef,
              display: options?.organizationName,
            },
          ],
          title: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
          section: sections,
        },
      },
      {
        fullUrl: encounterRef,
        resource: {
          resourceType: 'Encounter',
          identifier: [
            { system: CEZIH_VISIT_SYSTEM, value: input.encounterVisitId },
          ],
          status: 'in-progress',
          subject: {
            identifier: { system: CEZIH_MBO_SYSTEM, value: input.patientMbo },
          },
        },
      },
      {
        fullUrl: practitionerRef,
        resource: {
          resourceType: 'Practitioner',
          identifier: [{ system: CEZIH_HZJZ_SYSTEM, value: input.practitionerHzjzId }],
          name: options?.practitionerName
            ? [{ text: options.practitionerName }]
            : undefined,
        },
      },
      {
        fullUrl: organizationRef,
        resource: {
          resourceType: 'Organization',
          identifier: [{ system: CEZIH_HZZO_ORG_SYSTEM, value: input.organizationHzzoCode }],
          name: options?.organizationName ?? undefined,
        },
      },
      ...(serviceRef
        ? [
            {
              fullUrl: serviceRef,
              resource: {
                resourceType: 'HealthcareService',
                name: input.healthcareServiceName,
                providedBy: { reference: organizationRef },
              },
            },
          ]
        : []),
      ...(conditionRef
        ? [
            {
              fullUrl: conditionRef,
              resource: {
                resourceType: 'Condition',
                identifier: [{ system: CEZIH_CASE_IDENTIFIER_SYSTEM, value: input.caseId }],
                code: input.caseIcd10Code
                  ? {
                      coding: [
                        {
                          system: CEZIH_ICD10_HR_SYSTEM,
                          code: input.caseIcd10Code,
                          display: input.caseDisplay,
                        },
                      ],
                    }
                  : undefined,
                subject: {
                  identifier: { system: CEZIH_MBO_SYSTEM, value: input.patientMbo },
                },
              },
            },
          ]
        : []),
      {
        fullUrl: anamnesisRef,
        resource: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [
              {
                system: CEZIH_OBSERVATIONS_SYSTEM,
                code: CEZIH_OBSERVATION_ANAMNEZA_CODE,
                display: 'Anamneza',
              },
            ],
          },
          valueString: input.anamnesisText.trim(),
        },
      },
      {
        fullUrl: outcomeRef,
        resource: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [
              {
                system: CEZIH_OBSERVATIONS_SYSTEM,
                code: CEZIH_OBSERVATION_ISHOD_PREGLEDA_CODE,
                display: 'Ishod pregleda',
              },
            ],
          },
          valueCodeableConcept: {
            coding: [
              {
                system: DOCUMENT_OUTCOME_SYSTEM,
                code: input.outcomeCode,
                display: outcomeDisplay,
              },
            ],
          },
        },
      },
      ...(attachmentRef && input.attachment
        ? [
            {
              fullUrl: attachmentRef,
              resource: {
                resourceType: 'DocumentReference',
                status: 'current',
                content: [
                  {
                    attachment: {
                      contentType: input.attachment.contentType,
                      title: input.attachment.fileName,
                      data: input.attachment.base64Data,
                      url: binaryId ? `Binary/${binaryId}` : undefined,
                    },
                  },
                ],
              },
            },
          ]
        : []),
    ],
  };

  return { bundle, binaryId };
}
