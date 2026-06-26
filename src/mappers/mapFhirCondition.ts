import type { FhirCondition } from '../fhir/types';
import {
  CEZIH_CASE_IDENTIFIER_SYSTEM,
  CEZIH_SLUCAJ_SYSTEM,
  CEZIH_VISIT_SYSTEM,
} from '../fhir/types';
import { findIdentifier } from './fhir-utils';
import { firstCodingCode } from './fhir-utils';

export function mapFhirCondition(fhir: FhirCondition) {
  const coding = fhir.code?.coding?.[0];
  const caseId =
    findIdentifier(fhir.identifier, CEZIH_CASE_IDENTIFIER_SYSTEM) ??
    findIdentifier(fhir.identifier, CEZIH_SLUCAJ_SYSTEM) ??
    fhir.identifier?.[0]?.value ??
    null;

  return {
    fhirId: fhir.id ?? caseId ?? '',
    icd10Code: coding?.code ?? null,
    display: coding?.display ?? fhir.code?.text ?? null,
    clinicalStatus: firstCodingCode(fhir.clinicalStatus?.coding) ?? null,
    verificationStatus: firstCodingCode(fhir.verificationStatus?.coding) ?? null,
    caseId,
    onsetDate: fhir.onsetDateTime ?? null,
    abatementDate: fhir.abatementDateTime ?? null,
    recordedDate: fhir.recordedDate ?? null,
    encounterVisitId: fhir.encounter?.identifier?.system === CEZIH_VISIT_SYSTEM
      ? fhir.encounter.identifier.value ?? null
      : null,
    asserterHzjzId: fhir.asserter?.identifier?.value ?? null,
    recorderHzjzId: fhir.recorder?.identifier?.value ?? null,
    note: fhir.note?.[0]?.text ?? null,
    subjectMbo: fhir.subject?.identifier?.value ?? null,
  };
}
