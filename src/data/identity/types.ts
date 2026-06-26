export interface PatientIdentity {
  cezihId?: string;
  healthLakeId?: string;
  oib?: string;
  mbo?: string;
}

export interface PractitionerIdentity {
  cezihId?: string;
  healthLakeId?: string;
  hzjzId?: string;
}

export interface OrganizationIdentity {
  cezihId?: string;
  healthLakeId?: string;
  hzzoCode?: string;
}
