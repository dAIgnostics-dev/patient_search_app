import mockStore from '../mock-data/cezih-fhir-store.json' with { type: 'json' };
import { mapClinicalDocumentBundle } from '../src/mappers/mapClinicalDocumentBundle.ts';
import { mapFhirDocumentReference } from '../src/mappers/mapFhirDocumentReference.ts';
import {
  CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA,
  type FhirClinicalDocumentBundle,
  type FhirDocumentReference,
} from '../src/fhir/types.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const bundles = (mockStore as { DocumentBundle?: FhirClinicalDocumentBundle[] }).DocumentBundle ?? [];
const summaries = (mockStore as { DocumentReference?: FhirDocumentReference[] }).DocumentReference ?? [];

assert(bundles.length >= 2, 'expected at least 2 clinical document bundles in mock store');
assert(summaries.length >= 2, 'expected at least 2 document reference summaries in mock store');

const bundleById = new Map(
  bundles.map((bundle) => {
    const mapped = mapClinicalDocumentBundle(bundle);
    return [bundle.id, mapped] as const;
  }),
);

const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));

for (const [bundleId, mapped] of bundleById) {
  const { summary, documentReference } = mapped;
  assert(summary.typeCode === CEZIH_DOCUMENT_TYPE_AMBULANTA_PRIVATNA, `${bundleId} typeCode must be 011`);
  assert(summary.encounterVisitId, `${bundleId} must have encounterVisitId`);
  assert(summary.authorHzjzId, `${bundleId} must have authorHzjzId`);
  assert(summary.organizationHzzoCode, `${bundleId} must have organizationHzzoCode`);

  if (bundleId === 'doc-bundle-001') {
    assert(summary.caseId === 'case-001', 'doc-bundle-001 must link to case-001');
    assert(summary.caseDisplay === 'Hipertenzija', 'doc-bundle-001 must include case display');
  }

  if (bundleId === 'doc-bundle-002') {
    assert(!summary.caseId, 'doc-bundle-002 must not include caseId');
  }

  if (bundleId === 'doc-bundle-003') {
    assert(summary.hasSignature, 'doc-bundle-003 must include bundle signature');
    assert(summary.attachmentCount === 1, 'doc-bundle-003 must include one attachment');
  }

  const expectedSummaryId = `doc-${bundleId.replace(/^doc-bundle-/, '')}`;
  const storedSummary = summaryById.get(expectedSummaryId);
  assert(storedSummary, `missing stored DocumentReference summary ${expectedSummaryId}`);

  const storedMapped = mapFhirDocumentReference(storedSummary);
  assert(
    storedMapped.encounterVisitId === summary.encounterVisitId,
    `${expectedSummaryId} encounterVisitId mismatch`,
  );
  assert(storedMapped.typeCode === summary.typeCode, `${expectedSummaryId} typeCode mismatch`);
  assert(
    storedMapped.authorHzjzId === summary.authorHzjzId,
    `${expectedSummaryId} authorHzjzId mismatch`,
  );
  assert(
    documentReference.id === expectedSummaryId,
    `generated DocumentReference id must be ${expectedSummaryId}`,
  );
}

console.log('validate-document-read: ok');
