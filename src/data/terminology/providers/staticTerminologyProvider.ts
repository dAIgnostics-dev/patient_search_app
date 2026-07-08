import type { FhirCodeSystem, FhirValueSet } from '../../../fhir/terminologyTypes';
import { CASE_VERIFICATION_STATUS_OPTIONS } from '../../case-management/caseMessageShared';
import { DIAGNOSIS_CATALOG } from '../../case-management/diagnosisCatalog';
import { DOCUMENT_OUTCOME_OPTIONS, DOCUMENT_OUTCOME_SYSTEM } from '../../document-management/documentOutcomeCatalog';
import { ADMISSION_CLASS_OPTIONS, PRIORITY_OPTIONS } from '../../encounter-management/encounterMessageShared';
import {
  CEZIH_ICD10_HR_SYSTEM,
  CEZIH_NACIN_PRIJEMA_SYSTEM,
  FHIR_ACT_PRIORITY_SYSTEM,
  FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
} from '../../../fhir/types';
import type { TerminologyProvider, TerminologyQuery } from '../types';

function mapToConcepts<T extends { code: string }>(
  items: readonly T[],
  getDisplay: (item: T) => string,
): Array<{ code: string; display: string }> {
  return items.map((item) => ({
    code: item.code,
    display: getDisplay(item),
  }));
}

const STATIC_CODE_SYSTEMS: FhirCodeSystem[] = [
  {
    resourceType: 'CodeSystem',
    id: 'icd10-hr-static',
    url: CEZIH_ICD10_HR_SYSTEM,
    name: 'Icd10HrStatic',
    content: 'complete',
    concept: mapToConcepts(DIAGNOSIS_CATALOG, (item) => item.display),
  },
  {
    resourceType: 'CodeSystem',
    id: 'nacin-prijema-static',
    url: CEZIH_NACIN_PRIJEMA_SYSTEM,
    name: 'NacinPrijemaStatic',
    content: 'complete',
    concept: mapToConcepts(ADMISSION_CLASS_OPTIONS, (item) => item.displayHr),
  },
  {
    resourceType: 'CodeSystem',
    id: 'act-priority-static',
    url: FHIR_ACT_PRIORITY_SYSTEM,
    name: 'ActPriorityStatic',
    content: 'complete',
    concept: mapToConcepts(PRIORITY_OPTIONS, (item) => item.displayHr),
  },
  {
    resourceType: 'CodeSystem',
    id: 'condition-ver-status-static',
    url: FHIR_CONDITION_VERIFICATION_STATUS_SYSTEM,
    name: 'ConditionVerificationStatusStatic',
    content: 'complete',
    concept: mapToConcepts(CASE_VERIFICATION_STATUS_OPTIONS, (item) => item.displayHr),
  },
  {
    resourceType: 'CodeSystem',
    id: 'document-outcome-static',
    url: DOCUMENT_OUTCOME_SYSTEM,
    name: 'DocumentOutcomeStatic',
    content: 'complete',
    concept: mapToConcepts(DOCUMENT_OUTCOME_OPTIONS, (item) => item.display),
  },
];

function byQuery(list: FhirCodeSystem[], query?: Pick<TerminologyQuery, 'url'>): FhirCodeSystem[] {
  const url = query?.url?.trim();
  if (!url) return list;
  return list.filter((item) => item.url === url);
}

export class StaticTerminologyProvider implements TerminologyProvider {
  async getCodeSystem(query: TerminologyQuery): Promise<FhirCodeSystem | null> {
    const byUrl = query.url?.trim()
      ? STATIC_CODE_SYSTEMS.find((item) => item.url === query.url?.trim()) ?? null
      : null;
    if (byUrl) return byUrl;

    const id = query.id?.trim();
    if (!id) return null;
    return STATIC_CODE_SYSTEMS.find((item) => item.id === id) ?? null;
  }

  async queryCodeSystems(
    query?: Pick<TerminologyQuery, 'url' | 'lastUpdatedAfter'>,
  ): Promise<FhirCodeSystem[]> {
    return byQuery(STATIC_CODE_SYSTEMS, query);
  }

  async getValueSet(_query: TerminologyQuery): Promise<FhirValueSet | null> {
    return null;
  }

  async queryValueSets(
    _query?: Pick<TerminologyQuery, 'url' | 'lastUpdatedAfter'>,
  ): Promise<FhirValueSet[]> {
    return [];
  }
}
