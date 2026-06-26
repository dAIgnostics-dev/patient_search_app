import { resourceSourceConfig, type ResourceSource, type ResourceSourceKey } from '../../config/resourceSource';
import { resolveCezihApiBaseUrl } from '../../config/runtime';
import { CezihFhirClient } from '../fhir-client/cezihClient';
import { HealthLakeFhirClient } from '../fhir-client/healthlakeClient';
import { MockCezihFhirClient } from '../fhir-client/mockCezihClient';
import type { FhirClient } from '../fhir-client/types';
import type { AppRepository } from './appRepository';
import { CezihAppRepository } from './cezihAppRepository';
import { HealthLakeAppRepository } from './healthlakeAppRepository';
import { MockCezihAppRepository } from './mockCezihAppRepository';
import { resolveResourceSource } from './routing';

const healthlakeClient = new HealthLakeFhirClient();
const mockCezihClient = new MockCezihFhirClient();

function createCezihClient(): FhirClient {
  const baseUrl = resourceSourceConfig.cezihBaseUrl ?? resolveCezihApiBaseUrl();
  if (!baseUrl) return mockCezihClient;
  return new CezihFhirClient(baseUrl);
}

const fhirClients: Record<ResourceSource, FhirClient> = {
  healthlake: healthlakeClient,
  'mock-cezih': mockCezihClient,
  cezih: createCezihClient(),
};

const appRepositories: Record<ResourceSource, AppRepository> = {
  healthlake: new HealthLakeAppRepository(),
  cezih: new CezihAppRepository(fhirClients.cezih),
  'mock-cezih': new MockCezihAppRepository(mockCezihClient),
};

export function resolveSourceForResource(resourceType: ResourceSourceKey): ResourceSource {
  return resolveResourceSource(
    resourceSourceConfig.byResource,
    resourceSourceConfig.defaultSource,
    resourceType,
  );
}

export function getFhirClientForResource(resourceType: ResourceSourceKey): FhirClient {
  return fhirClients[resolveSourceForResource(resourceType)];
}

export function getAppRepository(): AppRepository {
  const patientSource = resolveSourceForResource('Patient');
  return appRepositories[patientSource];
}
