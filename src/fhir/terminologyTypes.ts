import type { FhirCodeableConcept, FhirCoding } from './types';

export interface FhirCodeSystemPropertyDefinition {
  code: string;
  uri?: string;
  type?: string;
}

export interface FhirCodeSystemConceptProperty {
  code: string;
  valueCode?: string;
  valueBoolean?: boolean;
  valueString?: string;
  valueInteger?: number;
  valueCoding?: FhirCoding;
}

export interface FhirCodeSystemConcept {
  code: string;
  display?: string;
  definition?: string;
  property?: FhirCodeSystemConceptProperty[];
  concept?: FhirCodeSystemConcept[];
}

export interface FhirCodeSystem {
  resourceType: 'CodeSystem';
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  content?: string;
  property?: FhirCodeSystemPropertyDefinition[];
  concept?: FhirCodeSystemConcept[];
  meta?: { lastUpdated?: string };
}

export interface FhirValueSetComposeInclude {
  system?: string;
  version?: string;
  concept?: Array<{ code?: string; display?: string }>;
  valueSet?: string[];
}

export interface FhirValueSetCompose {
  include?: FhirValueSetComposeInclude[];
  exclude?: FhirValueSetComposeInclude[];
}

export interface FhirValueSetExpansionContains {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  abstract?: boolean;
  inactive?: boolean;
  contains?: FhirValueSetExpansionContains[];
}

export interface FhirValueSetExpansion {
  identifier?: string;
  timestamp?: string;
  total?: number;
  offset?: number;
  contains?: FhirValueSetExpansionContains[];
}

export interface FhirValueSet {
  resourceType: 'ValueSet';
  id?: string;
  url?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  compose?: FhirValueSetCompose;
  expansion?: FhirValueSetExpansion;
  immutable?: boolean;
  meta?: { lastUpdated?: string };
  description?: string;
  purpose?: string;
  copyright?: string;
  publisher?: string;
  jurisdiction?: FhirCodeableConcept[];
}
