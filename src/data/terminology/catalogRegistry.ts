import {
  CEZIH_ICD10_HR_SYSTEM,
  CEZIH_NACIN_PRIJEMA_SYSTEM,
  FHIR_ACT_PRIORITY_SYSTEM,
  FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
} from '../../fhir/types';
import { DOCUMENT_OUTCOME_SYSTEM } from '../document-management/documentOutcomeCatalog';
import type { TerminologyCatalogKey } from './types';

export const TERMINOLOGY_CATALOG_REGISTRY: Record<TerminologyCatalogKey, string> = {
  'icd10-hr': CEZIH_ICD10_HR_SYSTEM,
  'nacin-prijema': CEZIH_NACIN_PRIJEMA_SYSTEM,
  'act-priority': FHIR_ACT_PRIORITY_SYSTEM,
  'condition-ver-status': FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
  'zavrsetak-pregleda': DOCUMENT_OUTCOME_SYSTEM,
};

export function resolveCatalogSystem(key: TerminologyCatalogKey): string {
  return TERMINOLOGY_CATALOG_REGISTRY[key];
}

export function findCatalogKeyBySystem(system: string): TerminologyCatalogKey | null {
  const normalized = system.trim();
  const entry = (Object.entries(TERMINOLOGY_CATALOG_REGISTRY) as Array<[TerminologyCatalogKey, string]>).find(
    ([, value]) => value === normalized,
  );
  return entry?.[0] ?? null;
}
