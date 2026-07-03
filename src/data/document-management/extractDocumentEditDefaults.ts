import type { FhirClinicalDocumentBundle } from '../../fhir/types';
import { CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA } from '../../fhir/types';
import { mapClinicalDocumentBundle } from '../../mappers/mapClinicalDocumentBundle';
import { DOCUMENT_OUTCOME_OPTIONS } from './documentOutcomeCatalog';
import type { SubmitDocumentInput } from './types';

export type DocumentEditDefaults = Pick<
  SubmitDocumentInput,
  | 'encounterVisitId'
  | 'caseId'
  | 'caseIcd10Code'
  | 'caseDisplay'
  | 'typeCode'
  | 'anamnesisText'
  | 'outcomeCode'
  | 'outcomeDisplay'
  | 'healthcareServiceName'
  | 'organizationHzzoCode'
>;

export function extractDocumentEditDefaults(
  bundle: FhirClinicalDocumentBundle,
  documentReferenceId?: string,
): DocumentEditDefaults {
  const mapped = mapClinicalDocumentBundle(bundle, documentReferenceId);
  const { summary } = mapped;

  const outcomeCode =
    DOCUMENT_OUTCOME_OPTIONS.find((item) => item.display === summary.outcomeDisplay)?.code ??
    DOCUMENT_OUTCOME_OPTIONS[0].code;

  return {
    encounterVisitId: summary.encounterVisitId ?? '',
    caseId: summary.caseId ?? undefined,
    caseDisplay: summary.caseDisplay ?? undefined,
    typeCode: CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
    anamnesisText: summary.anamnesisPreview ?? '',
    outcomeCode,
    outcomeDisplay: summary.outcomeDisplay ?? DOCUMENT_OUTCOME_OPTIONS[0].display,
    healthcareServiceName: summary.healthcareServiceName ?? undefined,
    organizationHzzoCode: summary.organizationHzzoCode ?? '',
  };
}
