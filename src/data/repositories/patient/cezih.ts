import { HealthLakePatientRepository } from './healthlake';

/**
 * CEZIH patient repository currently uses the same FHIR mapping contract.
 * It remains separate so endpoint/auth/profile-specific behavior can be added in place.
 */
export class CezihPatientRepository extends HealthLakePatientRepository {}
