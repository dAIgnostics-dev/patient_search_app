import type { ClinicalDocumentBundleSummary } from '../data/document-management/types';
import type {
  FhirClinicalDocumentBundle,
  FhirClinicalDocumentBundleEntry,
  FhirComposition,
  FhirCondition,
  FhirDocumentReference,
  FhirEncounter,
  FhirExtension,
  FhirHealthcareService,
  FhirObservation,
  FhirOrganization,
  FhirPractitioner,
  FhirReference,
} from '../fhir/types';
import {
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL,
  CEZIH_DOCUMENT_SECTION_DJELATNOST,
  CEZIH_DOCUMENT_SECTION_MEDICINSKA_INFORMACIJA,
  CEZIH_DOCUMENT_SECTION_PRILOZI,
  CEZIH_DOCUMENT_SECTION_SYSTEM,
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY,
  CEZIH_DOCUMENT_TYPE_SYSTEM,
  CEZIH_HZJZ_SYSTEM,
  CEZIH_HZZO_ORG_SYSTEM,
  CEZIH_MBO_SYSTEM,
  CEZIH_OBSERVATION_ANAMNEZA_CODE,
  CEZIH_OBSERVATION_ISHOD_PREGLEDA_CODE,
  CEZIH_OBSERVATIONS_SYSTEM,
  CEZIH_SLUCAJ_SYSTEM,
  CEZIH_VISIT_SYSTEM,
} from '../fhir/types';
import { findIdentifier } from './fhir-utils';

export interface ClinicalDocumentBundleMapping {
  summary: ClinicalDocumentBundleSummary;
  documentReference: FhirDocumentReference;
}

function sectionCode(section: { code?: { coding?: Array<{ system?: string; code?: string }> } }): string | null {
  const coding = section.code?.coding?.find(
    (item) => item.system === CEZIH_DOCUMENT_SECTION_SYSTEM,
  );
  return coding?.code ?? section.code?.coding?.[0]?.code ?? null;
}

function resolveEntry(
  entries: FhirClinicalDocumentBundleEntry[],
  reference?: FhirReference,
): FhirClinicalDocumentBundleEntry['resource'] | null {
  if (!reference) return null;
  if (reference.reference) {
    const match = entries.find((entry) => entry.fullUrl === reference.reference);
    if (match) return match.resource;
  }
  return null;
}

function practitionerName(practitioner: FhirPractitioner): string | null {
  const name = practitioner.name?.[0];
  if (!name) return null;
  if (name.text) return name.text;
  const given = name.given?.join(' ') ?? '';
  return `${given} ${name.family ?? ''}`.trim() || null;
}

function conditionCaseId(condition: FhirCondition): string | null {
  return (
    findIdentifier(condition.identifier, CEZIH_CASE_IDENTIFIER_SYSTEM) ??
    findIdentifier(condition.identifier, CEZIH_SLUCAJ_SYSTEM) ??
    condition.identifier?.[0]?.value ??
    null
  );
}

function observationCode(observation: FhirObservation): string | null {
  return (
    observation.code?.coding?.find((coding) => coding.system === CEZIH_OBSERVATIONS_SYSTEM)?.code ??
    observation.code?.coding?.[0]?.code ??
    null
  );
}

function summaryExtensionValue(
  extensions: FhirExtension[] | undefined,
  key: string,
): string | boolean | number | null {
  const root = extensions?.find((ext) => ext.url === CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL);
  const nested = root?.extension?.find((ext) => ext.url === key);
  if (!nested) return null;
  if (nested.valueBoolean !== undefined) return nested.valueBoolean;
  if (nested.valueInteger !== undefined) return nested.valueInteger;
  if (nested.valueCode !== undefined) return nested.valueCode;
  return nested.valueString ?? null;
}

export function buildClinicalDocumentSummaryExtension(
  summary: ClinicalDocumentBundleSummary,
): FhirExtension {
  const entries: FhirExtension[] = [
    { url: 'documentId', valueString: summary.documentId ?? undefined },
    { url: 'compositionStatus', valueCode: summary.compositionStatus ?? undefined },
    { url: 'encounterVisitId', valueString: summary.encounterVisitId ?? undefined },
    { url: 'caseId', valueString: summary.caseId ?? undefined },
    { url: 'caseDisplay', valueString: summary.caseDisplay ?? undefined },
    { url: 'authorHzjzId', valueString: summary.authorHzjzId ?? undefined },
    { url: 'authorName', valueString: summary.authorName ?? undefined },
    { url: 'organizationHzzoCode', valueString: summary.organizationHzzoCode ?? undefined },
    { url: 'organizationName', valueString: summary.organizationName ?? undefined },
    { url: 'healthcareServiceName', valueString: summary.healthcareServiceName ?? undefined },
    { url: 'anamnesisPreview', valueString: summary.anamnesisPreview ?? undefined },
    { url: 'outcomeDisplay', valueString: summary.outcomeDisplay ?? undefined },
    { url: 'attachmentCount', valueInteger: summary.attachmentCount },
    { url: 'hasSignature', valueBoolean: summary.hasSignature },
  ].filter(
    (entry) =>
      entry.valueString !== undefined ||
      entry.valueCode !== undefined ||
      entry.valueBoolean !== undefined ||
      entry.valueInteger !== undefined,
  );

  return {
    url: CEZIH_CLINICAL_DOCUMENT_SUMMARY_EXTENSION_URL,
    extension: entries,
  };
}

export function mapClinicalDocumentBundle(
  bundle: FhirClinicalDocumentBundle,
  summaryId?: string,
): ClinicalDocumentBundleMapping {
  const entries = bundle.entry ?? [];
  const compositionEntry = entries.find(
    (entry) => entry.resource.resourceType === 'Composition',
  );
  const composition = compositionEntry?.resource as FhirComposition | undefined;
  if (!composition) {
    throw new Error(`Document bundle ${bundle.id} is missing Composition resource.`);
  }

  const typeCoding = composition.type?.coding?.find(
    (coding) => coding.system === CEZIH_DOCUMENT_TYPE_SYSTEM,
  );
  const typeCode = (typeCoding?.code ?? CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA) as '011';
  const typeDisplay =
    typeCoding?.display ?? CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA_DISPLAY;

  const encounterResource = resolveEntry(entries, composition.encounter) as FhirEncounter | null;
  const encounterVisitId =
    findIdentifier(encounterResource?.identifier, CEZIH_VISIT_SYSTEM) ??
    composition.encounter?.identifier?.value ??
    null;

  const practitionerAuthor = composition.author
    ?.map((author) => resolveEntry(entries, author))
    .find((resource) => resource?.resourceType === 'Practitioner') as FhirPractitioner | undefined;
  const organizationAuthor = composition.author
    ?.map((author) => resolveEntry(entries, author))
    .find((resource) => resource?.resourceType === 'Organization') as FhirOrganization | undefined;

  const authorHzjzId =
    findIdentifier(practitionerAuthor?.identifier, CEZIH_HZJZ_SYSTEM) ??
    composition.author?.[0]?.identifier?.value ??
    null;
  const authorName =
    practitionerName(practitionerAuthor ?? { resourceType: 'Practitioner', id: '' }) ??
    composition.author?.[0]?.display ??
    null;
  const organizationHzzoCode =
    findIdentifier(organizationAuthor?.identifier, CEZIH_HZZO_ORG_SYSTEM) ??
    composition.author?.[1]?.identifier?.value ??
    null;
  const organizationName = organizationAuthor?.name ?? composition.author?.[1]?.display ?? null;

  const djelatnostSection = composition.section?.find(
    (section) => sectionCode(section) === CEZIH_DOCUMENT_SECTION_DJELATNOST,
  );
  const priloziSection = composition.section?.find(
    (section) => sectionCode(section) === CEZIH_DOCUMENT_SECTION_PRILOZI,
  );
  const medicinskaSection = composition.section?.find(
    (section) => sectionCode(section) === CEZIH_DOCUMENT_SECTION_MEDICINSKA_INFORMACIJA,
  );

  const healthcareService = djelatnostSection?.entry
    ?.map((entry) => resolveEntry(entries, entry))
    .find((resource) => resource?.resourceType === 'HealthcareService') as
    | FhirHealthcareService
    | undefined;

  const medicinskaResources =
    medicinskaSection?.entry
      ?.map((entry) => resolveEntry(entries, entry))
      .filter((resource): resource is NonNullable<typeof resource> => Boolean(resource)) ?? [];

  const conditionResource = medicinskaResources.find(
    (resource) => resource.resourceType === 'Condition',
  ) as FhirCondition | undefined;
  const caseId = conditionResource ? conditionCaseId(conditionResource) : null;
  const caseDisplay =
    conditionResource?.code?.coding?.[0]?.display ?? conditionResource?.code?.text ?? null;

  const anamnesisObservation = medicinskaResources.find(
    (resource) =>
      resource.resourceType === 'Observation' &&
      observationCode(resource as FhirObservation) === CEZIH_OBSERVATION_ANAMNEZA_CODE,
  ) as FhirObservation | undefined;
  const outcomeObservation = medicinskaResources.find(
    (resource) =>
      resource.resourceType === 'Observation' &&
      observationCode(resource as FhirObservation) === CEZIH_OBSERVATION_ISHOD_PREGLEDA_CODE,
  ) as FhirObservation | undefined;

  const attachmentEntries =
    priloziSection?.entry
      ?.map((entry) => resolveEntry(entries, entry))
      .filter((resource) => resource?.resourceType === 'DocumentReference') ?? [];
  const attachmentCount = attachmentEntries.length;
  const firstAttachment = attachmentEntries[0] as FhirDocumentReference | undefined;
  const attachment = firstAttachment?.content?.[0]?.attachment;

  const patientMbo =
    composition.subject?.identifier?.value ??
    (resolveEntry(entries, composition.subject) as { identifier?: Array<{ value?: string }> } | null)
      ?.identifier?.[0]?.value ??
    null;

  const summary: ClinicalDocumentBundleSummary = {
    bundleId: bundle.id,
    documentId: bundle.identifier?.value ?? bundle.id,
    compositionStatus: composition.status ?? null,
    typeCode,
    typeDisplay,
    title: composition.title ?? typeDisplay,
    date: composition.date ?? bundle.timestamp ?? null,
    patientMbo,
    encounterVisitId,
    caseId,
    caseDisplay,
    authorHzjzId,
    authorName,
    organizationHzzoCode,
    organizationName,
    healthcareServiceName: healthcareService?.name ?? null,
    hasSignature: Boolean(bundle.signature),
    attachmentCount,
    anamnesisPreview: anamnesisObservation?.valueString ?? null,
    outcomeDisplay:
      outcomeObservation?.valueCodeableConcept?.coding?.[0]?.display ??
      outcomeObservation?.valueCodeableConcept?.text ??
      null,
    sections: (composition.section ?? []).map((section) => ({
      code: sectionCode(section) ?? '',
      title: section.title ?? section.code?.coding?.[0]?.display ?? null,
      entryCount: section.entry?.length ?? 0,
    })),
  };

  const documentReference: FhirDocumentReference = {
    resourceType: 'DocumentReference',
    id: summaryId ?? `doc-${bundle.id.replace(/^doc-bundle-/, '')}`,
    identifier: bundle.identifier ? [bundle.identifier] : undefined,
    status: 'current',
    type: {
      coding: [
        {
          system: CEZIH_DOCUMENT_TYPE_SYSTEM,
          code: summary.typeCode,
          display: summary.typeDisplay,
        },
      ],
      text: summary.title,
    },
    subject: patientMbo
      ? {
          identifier: {
            system: CEZIH_MBO_SYSTEM,
            value: patientMbo,
          },
        }
      : composition.subject,
    date: summary.date ?? undefined,
    description: summary.title,
    author: authorHzjzId
      ? [
          {
            identifier: { system: CEZIH_HZJZ_SYSTEM, value: authorHzjzId },
            display: authorName ?? undefined,
          },
        ]
      : undefined,
    custodian: organizationHzzoCode
      ? {
          identifier: { system: CEZIH_HZZO_ORG_SYSTEM, value: organizationHzzoCode },
          display: organizationName ?? undefined,
        }
      : undefined,
    context: encounterVisitId
      ? {
          encounter: [
            {
              identifier: { system: CEZIH_VISIT_SYSTEM, value: encounterVisitId },
            },
          ],
        }
      : undefined,
    content: attachment
      ? [
          {
            attachment: {
              title: attachment.title,
              contentType: attachment.contentType,
            },
          },
        ]
      : undefined,
    extension: [buildClinicalDocumentSummaryExtension(summary)],
  };

  return { summary, documentReference };
}

export function readClinicalDocumentSummaryExtension(
  extensions: FhirExtension[] | undefined,
): Partial<ClinicalDocumentBundleSummary> {
  return {
    documentId: summaryExtensionValue(extensions, 'documentId') as string | null,
    compositionStatus: summaryExtensionValue(extensions, 'compositionStatus') as string | null,
    encounterVisitId: summaryExtensionValue(extensions, 'encounterVisitId') as string | null,
    caseId: summaryExtensionValue(extensions, 'caseId') as string | null,
    caseDisplay: summaryExtensionValue(extensions, 'caseDisplay') as string | null,
    authorHzjzId: summaryExtensionValue(extensions, 'authorHzjzId') as string | null,
    authorName: summaryExtensionValue(extensions, 'authorName') as string | null,
    organizationHzzoCode: summaryExtensionValue(extensions, 'organizationHzzoCode') as string | null,
    organizationName: summaryExtensionValue(extensions, 'organizationName') as string | null,
    healthcareServiceName: summaryExtensionValue(extensions, 'healthcareServiceName') as string | null,
    anamnesisPreview: summaryExtensionValue(extensions, 'anamnesisPreview') as string | null,
    outcomeDisplay: summaryExtensionValue(extensions, 'outcomeDisplay') as string | null,
    attachmentCount: (summaryExtensionValue(extensions, 'attachmentCount') as number | null) ?? undefined,
    hasSignature: (summaryExtensionValue(extensions, 'hasSignature') as boolean | null) ?? undefined,
  };
}
