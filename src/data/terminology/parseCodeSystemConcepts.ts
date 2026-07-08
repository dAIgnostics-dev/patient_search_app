import type {
  FhirCodeSystem,
  FhirCodeSystemConcept,
  FhirCodeSystemConceptProperty,
} from '../../fhir/terminologyTypes';
import type { TerminologyConcept } from './types';

function flattenRecursive(
  concepts: FhirCodeSystemConcept[] | undefined,
  out: FhirCodeSystemConcept[],
): void {
  if (!concepts) return;
  for (const concept of concepts) {
    out.push(concept);
    flattenRecursive(concept.concept, out);
  }
}

export function flattenConcepts(concepts: FhirCodeSystemConcept[] | undefined): FhirCodeSystemConcept[] {
  const out: FhirCodeSystemConcept[] = [];
  flattenRecursive(concepts, out);
  return out;
}

export function readConceptProperty(
  concept: FhirCodeSystemConcept,
  propertyCode: string,
): FhirCodeSystemConceptProperty | null {
  const normalized = propertyCode.trim();
  if (!normalized) return null;
  return concept.property?.find((property) => property.code.trim() === normalized) ?? null;
}

function resolveDisplay(concept: FhirCodeSystemConcept): string {
  return concept.display?.trim() || concept.code.trim();
}

export function isConceptSelectable(concept: FhirCodeSystemConcept): boolean {
  const property = readConceptProperty(concept, 'notSelectable');
  return property?.valueBoolean !== true;
}

export function toTerminologyConcept(concept: FhirCodeSystemConcept): TerminologyConcept {
  const parent = readConceptProperty(concept, 'parent-id');
  return {
    code: concept.code.trim(),
    display: resolveDisplay(concept),
    parentId: parent?.valueCode?.trim() || undefined,
    notSelectable: !isConceptSelectable(concept),
  };
}

export function parseCodeSystemConcepts(codeSystem: FhirCodeSystem | null | undefined): TerminologyConcept[] {
  const flat = flattenConcepts(codeSystem?.concept);
  return flat
    .filter((concept) => Boolean(concept.code?.trim()))
    .map((concept) => toTerminologyConcept(concept));
}
