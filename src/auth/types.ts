export interface PractitionerSession {
  practitionerId: string;
  hzjzId: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  auditSessionId: string;
}

export const SESSION_STORAGE_KEY = 'cezih-practitioner-session';
