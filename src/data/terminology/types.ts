import type { FhirCodeSystem, FhirValueSet } from '../../fhir/terminologyTypes';

export type TerminologyCatalogKey =
  | 'icd10-hr'
  | 'nacin-prijema'
  | 'act-priority'
  | 'condition-ver-status'
  | 'zavrsetak-pregleda';

export interface TerminologyConcept {
  code: string;
  display: string;
  parentId?: string;
  notSelectable: boolean;
  children?: TerminologyConcept[];
}

export interface TerminologyOption {
  code: string;
  display: string;
  system: string;
}

export interface TerminologyQuery {
  url?: string;
  id?: string;
  lastUpdatedAfter?: string;
}

export interface TerminologySyncResult {
  fetched: number;
  updated: number;
  cachedAt: string;
}

export interface TerminologyCodeSystemResult {
  codeSystem: FhirCodeSystem | null;
  concepts: TerminologyConcept[];
}

export interface TerminologyProvider {
  getCodeSystem(query: TerminologyQuery): Promise<FhirCodeSystem | null>;
  queryCodeSystems(query?: Pick<TerminologyQuery, 'url' | 'lastUpdatedAfter'>): Promise<FhirCodeSystem[]>;
  getValueSet(query: TerminologyQuery): Promise<FhirValueSet | null>;
  queryValueSets(query?: Pick<TerminologyQuery, 'url' | 'lastUpdatedAfter'>): Promise<FhirValueSet[]>;
}
