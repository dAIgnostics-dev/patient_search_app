import type { FhirCondition } from '../fhir/types';
import { firstCodingCode } from './fhir-utils';

export function mapFhirCondition(fhir: FhirCondition) {
  const coding = fhir.code?.coding?.[0];

  return {
    fhirId: fhir.id,
    icd10Code: coding?.code ?? null,
    display: coding?.display ?? fhir.code?.text ?? null,
    clinicalStatus: firstCodingCode(fhir.clinicalStatus?.coding) ?? null,
    verificationStatus: firstCodingCode(fhir.verificationStatus?.coding) ?? null,
    caseId: fhir.identifier?.[0]?.value ?? null,
    onsetDate: fhir.onsetDateTime ?? null,
    note: fhir.note?.[0]?.text ?? null,
    subjectMbo: fhir.subject?.identifier?.value ?? null,
  };
}
