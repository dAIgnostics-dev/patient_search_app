import type { PatientDto } from '../../dto';
import type { ResourceRepository } from '../common';

export interface PatientRepository extends ResourceRepository<PatientDto> {}
