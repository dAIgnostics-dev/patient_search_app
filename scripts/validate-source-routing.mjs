const map = {
  Patient: 'cezih',
  Practitioner: 'cezih',
  Organization: 'cezih',
  Encounter: 'cezih',
  Condition: 'cezih',
  DocumentReference: 'cezih',
  DiagnosticReport: 'healthlake',
  ImagingStudy: 'healthlake',
  Binary: 'healthlake',
  PractitionerRole: 'cezih',
  HealthcareService: 'cezih',
  Location: 'cezih',
  Endpoint: 'cezih',
  ValueSet: 'cezih',
  CodeSystem: 'cezih',
};

function resolveResourceSource(byResource, defaultSource, key) {
  return byResource[key] ?? defaultSource;
}

function assertEquals(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

assertEquals(resolveResourceSource(map, 'healthlake', 'Patient'), 'cezih', 'patient routes to CEZIH');
assertEquals(
  resolveResourceSource(map, 'healthlake', 'DocumentReference'),
  'cezih',
  'document routes to CEZIH',
);
assertEquals(
  resolveResourceSource(map, 'healthlake', 'DiagnosticReport'),
  'healthlake',
  'diagnostic report routes to HealthLake',
);
assertEquals(
  resolveResourceSource(map, 'healthlake', 'ImagingStudy'),
  'healthlake',
  'imaging routes to HealthLake',
);

console.log('Source routing validation passed.');
