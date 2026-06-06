import type { FhirIdentifier } from '../fhir/types';

export function findIdentifier(
  identifiers: FhirIdentifier[] | undefined,
  system: string,
): string | undefined {
  return identifiers?.find((i) => i.system === system)?.value;
}

export function firstCodingCode(
  coding: { code?: string }[] | undefined,
): string | undefined {
  return coding?.[0]?.code;
}
