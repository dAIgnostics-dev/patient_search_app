import { MockCezihFhirClient } from '../fhir-client/mockCezihClient';
import type { FhirClient } from '../fhir-client/types';
import type { FhirDocumentReference } from '../../fhir/types';
import { mapFhirDocumentReference } from '../../mappers/mapFhirDocumentReference';
import { isWithinDocumentEditWindow } from './documentEditWindow';
import { validateSubmitDocumentInputSync } from './validateSubmitDocumentInput';
import type { SubmitDocumentValidationIssue, UpdateDocumentInput } from './types';

export async function validateUpdateDocumentInput(
  input: UpdateDocumentInput,
  practitionerHzjzId: string,
  client: FhirClient = new MockCezihFhirClient(),
): Promise<SubmitDocumentValidationIssue[]> {
  const issues = validateSubmitDocumentInputSync(input);

  if (!input.replacesDocumentReferenceId?.trim()) {
    issues.push({
      field: 'replacesDocumentReferenceId',
      message: 'Document reference ID to replace is required.',
    });
    return issues;
  }

  if (issues.length > 0) return issues;

  const existing = await client.read<FhirDocumentReference>('DocumentReference', input.replacesDocumentReferenceId.trim());
  if (!existing) {
    issues.push({
      field: 'replacesDocumentReferenceId',
      message: 'Document to replace was not found.',
    });
    return issues;
  }

  const mapped = mapFhirDocumentReference(existing);
  const status = (mapped.compositionStatus ?? '').toLowerCase();
  if (status !== 'final') {
    issues.push({
      field: 'replacesDocumentReferenceId',
      message: 'Only final documents can be replaced with a new version.',
    });
  }

  const replacements = await client.searchAll<FhirDocumentReference>('DocumentReference', {
    relatesto: `DocumentReference/${input.replacesDocumentReferenceId.trim()}`,
  });
  const alreadyReplaced = replacements.some((item) => item.relatesTo?.some((relation) =>
    relation.code === 'replaces' &&
    (relation.target?.reference === `DocumentReference/${input.replacesDocumentReferenceId.trim()}` ||
      relation.target?.reference === input.replacesDocumentReferenceId.trim()),
  ));
  if (alreadyReplaced) {
    issues.push({
      field: 'replacesDocumentReferenceId',
      message: 'Document has already been replaced by a newer version.',
    });
  }

  if (!isWithinDocumentEditWindow(mapped.date)) {
    issues.push({
      field: 'replacesDocumentReferenceId',
      message: 'Document edit window has expired.',
    });
  }

  const patientMbo =
    existing.subject?.identifier?.value ?? null;
  if (patientMbo && patientMbo !== input.patientMbo?.trim()) {
    issues.push({
      field: 'patientMbo',
      message: 'Patient MBO does not match the document being replaced.',
    });
  }

  void practitionerHzjzId;

  return issues;
}
