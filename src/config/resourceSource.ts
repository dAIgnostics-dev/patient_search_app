export type ResourceSource = 'cezih' | 'healthlake' | 'mock-cezih';

export type ResourceSourceKey =
  | 'Patient'
  | 'Practitioner'
  | 'Organization'
  | 'Encounter'
  | 'Condition'
  | 'DocumentReference'
  | 'DiagnosticReport'
  | 'ImagingStudy'
  | 'Binary'
  | 'PractitionerRole'
  | 'HealthcareService'
  | 'Location'
  | 'Endpoint'
  | 'ValueSet'
  | 'CodeSystem';

export type ResourceSourceConfig = {
  defaultSource: ResourceSource;
  byResource: Record<ResourceSourceKey, ResourceSource>;
  cezihBaseUrl: string | null;
};

const RESOURCE_KEYS: ResourceSourceKey[] = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Condition',
  'DocumentReference',
  'DiagnosticReport',
  'ImagingStudy',
  'Binary',
  'PractitionerRole',
  'HealthcareService',
  'Location',
  'Endpoint',
  'ValueSet',
  'CodeSystem',
];

const DEFAULT_BY_RESOURCE: Record<ResourceSourceKey, ResourceSource> = {
  Patient: 'cezih',
  Practitioner: 'cezih',
  Organization: 'cezih',
  Encounter: 'cezih',
  Condition: 'cezih',
  DocumentReference: 'cezih',
  DiagnosticReport: 'healthlake',
  ImagingStudy: 'healthlake',
  Binary: 'healthlake',
  PractitionerRole: 'cezih',
  HealthcareService: 'cezih',
  Location: 'cezih',
  Endpoint: 'cezih',
  ValueSet: 'cezih',
  CodeSystem: 'cezih',
};

function parseSource(value: string | undefined): ResourceSource | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'cezih') return 'cezih';
  if (normalized === 'healthlake') return 'healthlake';
  if (normalized === 'mock' || normalized === 'mock-cezih') return 'mock-cezih';
  return null;
}

function parseMap(raw: string | undefined): Partial<Record<ResourceSourceKey, ResourceSource>> {
  if (!raw?.trim()) return {};
  const out: Partial<Record<ResourceSourceKey, ResourceSource>> = {};

  for (const token of raw.split(',')) {
    const [rawKey, rawValue] = token.split(':');
    const key = rawKey?.trim() as ResourceSourceKey | undefined;
    const source = parseSource(rawValue);
    if (!key || !source || !RESOURCE_KEYS.includes(key)) continue;
    out[key] = source;
  }
  return out;
}

export function resolveResourceSourceConfig(): ResourceSourceConfig {
  const defaultSource = parseSource(import.meta.env.VITE_RESOURCE_SOURCE_DEFAULT) ?? 'healthlake';
  const byResource = {
    ...DEFAULT_BY_RESOURCE,
    ...parseMap(import.meta.env.VITE_RESOURCE_SOURCE_MAP),
  };
  const cezihBaseUrl = import.meta.env.VITE_CEZIH_API_BASE_URL?.trim() || null;

  return { defaultSource, byResource, cezihBaseUrl };
}

export const resourceSourceConfig = resolveResourceSourceConfig();
