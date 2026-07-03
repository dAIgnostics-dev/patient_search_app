import {
  findMockDocumentReferenceById,
  findMockDocumentReferenceReplacing,
} from '../fhir-client/mockCezihClient';
import { mapFhirDocumentReference } from '../../mappers/mapFhirDocumentReference';
import { isWithinDocumentEditWindow } from './documentEditWindow';
import { validateSubmitDocumentInputSync } from './validateSubmitDocumentInput';
import type { SubmitDocumentValidationIssue, UpdateDocumentInput } from './types';

export async function validateUpdateDocumentInput(
  input: UpdateDocumentInput,
  practitionerHzjzId: string,
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

  const existing = await findMockDocumentReferenceById(input.replacesDocumentReferenceId.trim());
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

  const alreadyReplaced = await findMockDocumentReferenceReplacing(input.replacesDocumentReferenceId.trim());
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
