/**
 * FHIR resource ids from `app_healthlake/bulk-import/all-resources.ndjson`.
 * Regenerate when the CEZIH mock bundle changes (`npm run bulk:build` in app_healthlake).
 */
export const CEZIH_BUNDLE_MANIFEST = {
  Organization: ['1473', '2473', '3473', '4473'],
  Practitioner: ['1466', '2466', '3466', '5466'],
  Patient: ['1442', '2442', '3442', '4442', '5442', '6442', '7442', '8442'],
  Encounter: ['1469', '2469', '3469', '4469', '5469', '6469', '7469', '8469', '9469'],
  Condition: ['1471', '2471', '3471', '4471', '5471'],
  /** Add HealthLake resource ids after bulk import. */
  MedicationRequest: [] as string[],
  AllergyIntolerance: [] as string[],
  Procedure: [] as string[],
  DocumentReference: [] as string[],
  ServiceRequest: [] as string[],
} as const;

export type BundleResourceType = keyof typeof CEZIH_BUNDLE_MANIFEST;
