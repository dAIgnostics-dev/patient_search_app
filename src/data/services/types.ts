import type { PatientDetail, PatientSummary } from '../../domain/models';

export interface ClinicianContext {
  clinicianId: string;
  hzjzId?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  auditSessionId?: string | null;
  role: string;
  organizationId?: string | null;
}

export interface TimelineEvent {
  id: string;
  date: string;
  type: 'Encounter' | 'Condition' | 'DocumentReference' | 'DiagnosticReport' | 'ImagingStudy';
  title: string;
  source: 'healthlake' | 'cezih' | 'mock-cezih';
}

export interface PatientChart extends PatientDetail {
  timeline: TimelineEvent[];
}

export interface MyPatientsFilters {
  search?: string;
  sort?: 'lastVisit' | 'name';
  last12MonthsOnly?: boolean;
}

export interface PatientSearchByNameQuery {
  firstName?: string;
  lastName?: string;
}

export interface PatientSearchServiceContract {
  findPatientByMbo(
    clinicianContext: ClinicianContext | null,
    mbo: string,
  ): Promise<PatientSummary | null>;
  findPatientsByName(
    clinicianContext: ClinicianContext | null,
    query: PatientSearchByNameQuery,
  ): Promise<PatientSummary[]>;
}
