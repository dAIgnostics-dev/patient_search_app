import type { ResourceSource, ResourceSourceKey } from '../../config/resourceSource';

export type ResourceSourceMap = Record<ResourceSourceKey, ResourceSource>;

export function resolveResourceSource(
  byResource: ResourceSourceMap,
  defaultSource: ResourceSource,
  key: ResourceSourceKey,
): ResourceSource {
  return byResource[key] ?? defaultSource;
}
