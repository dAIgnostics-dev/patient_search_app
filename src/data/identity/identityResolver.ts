import type { OrganizationIdentity, PatientIdentity, PractitionerIdentity } from './types';

export class IdentityResolver {
  resolvePatient(identity: PatientIdentity): PatientIdentity {
    return { ...identity };
  }

  resolvePractitioner(identity: PractitionerIdentity): PractitionerIdentity {
    return { ...identity };
  }

  resolveOrganization(identity: OrganizationIdentity): OrganizationIdentity {
    return { ...identity };
  }
}

export const identityResolver = new IdentityResolver();
