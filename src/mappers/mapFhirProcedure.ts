import type { FhirProcedure } from '../fhir/types';

export function mapFhirProcedure(fhir: FhirProcedure) {
  const coding = fhir.code?.coding?.[0];

  return {
    fhirId: fhir.id,
    status: fhir.status ?? null,
    display: coding?.display ?? fhir.code?.text ?? null,
    code: coding?.code ?? null,
    performedDate:
      fhir.performedDateTime ??
      fhir.performedPeriod?.start ??
      fhir.performedPeriod?.end ??
      null,
    note: fhir.note?.[0]?.text ?? null,
  };
}
