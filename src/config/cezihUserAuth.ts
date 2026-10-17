export const CEZIH_USER_AUTH_BASE = '/api/cezih/user-auth/';
export const CEZIH_USER_AUTH_ACTIONS = ['status', 'start', 'complete', 'logout', 'expire', 'test'] as const;
export type CezihUserAuthAction = typeof CEZIH_USER_AUTH_ACTIONS[number];
export const CEZIH_USER_ENDPOINTS = [
  'Patient.search', 'Encounter.search', 'Condition.search', 'DocumentReference.search',
  'case.manage', 'encounter.manage', 'document.submit', 'document.retrieve',
  'referral.manage', 'patient.foreign.manage', 'signature.submit', 'signature.retrieve',
];
export interface CezihUserPrincipal {
  subject: string;
  displayName: string;
  roles: string[];
}
export interface CezihUserAuthStatus {
  mode: 'simulation' | 'live';
  state: 'signed-out' | 'pending' | 'authenticated' | 'expired' | 'cancelled' | 'card-unavailable' | 'denied' | 'not-configured';
  user: CezihUserPrincipal | null;
  expiresAt: string | null;
  challenge: string | null;
  check: 'allowed' | 'denied' | 'requires-login' | null;
}
export const CEZIH_SIMULATION_USERS: Record<'ana' | 'luka', CezihUserPrincipal> = {
  ana: { subject: 'simulation-ana', displayName: 'Ana — simulirani djelatnik', roles: ['private_care_specialist'] },
  luka: { subject: 'simulation-luka', displayName: 'Luka — simulirani djelatnik', roles: ['private_care_specialist'] },
};
