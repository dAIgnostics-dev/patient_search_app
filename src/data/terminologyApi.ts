import type { FhirCodeSystem, FhirValueSet } from '../fhir/terminologyTypes';
import { resolveCatalogSystem } from './terminology/catalogRegistry';
import type { TerminologyCatalogKey, TerminologyConcept, TerminologyOption, TerminologySyncResult } from './terminology/types';
import { getTerminologyService } from './services/terminologyService';

export async function getCodeSystemByUrl(url: string): Promise<FhirCodeSystem | null> {
  return getTerminologyService().getCodeSystemByUrl(url);
}

export async function getCodeSystemByKey(key: TerminologyCatalogKey): Promise<FhirCodeSystem | null> {
  return getTerminologyService().getCodeSystemByKey(key);
}

export async function getValueSetByUrl(url: string): Promise<FhirValueSet | null> {
  return getTerminologyService().getValueSetByUrl(url);
}

export async function getConceptTreeByUrl(url: string): Promise<TerminologyConcept[]> {
  return getTerminologyService().getConceptTree(url);
}

export async function getFlatOptionsByUrl(url: string): Promise<TerminologyOption[]> {
  return getTerminologyService().getFlatOptions(url);
}

export async function getFlatOptionsByCatalogKey(key: TerminologyCatalogKey): Promise<TerminologyOption[]> {
  return getTerminologyService().getFlatOptions(resolveCatalogSystem(key));
}

export async function getConceptChildren(url: string, parentCode: string): Promise<TerminologyConcept[]> {
  return getTerminologyService().getChildren(url, parentCode);
}

export async function validateTerminologyCode(url: string, code: string): Promise<boolean> {
  return getTerminologyService().validateCode(url, code);
}

export async function resolveTerminologyDisplay(
  url: string,
  code: string,
): Promise<string | null> {
  return getTerminologyService().resolveDisplay(url, code);
}

export async function syncTerminology(lastUpdatedAfter?: string): Promise<TerminologySyncResult> {
  return getTerminologyService().syncCatalogs(lastUpdatedAfter);
}
