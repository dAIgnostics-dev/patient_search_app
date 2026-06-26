import type { FhirResource } from '../../fhir/types';

export interface ResourceRepository<TDto> {
  search(params?: Record<string, string | undefined>): Promise<TDto[]>;
  getById(id: string): Promise<TDto | null>;
}

export interface FhirBackedRepository<TDto, TFhir extends FhirResource = FhirResource>
  extends ResourceRepository<TDto> {
  toDto(resource: TFhir): TDto;
}
