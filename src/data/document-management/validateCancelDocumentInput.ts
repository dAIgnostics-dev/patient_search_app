import { findMockDocumentReferenceById } from '../fhir-client/mockCezihClient';
import { mapFhirDocumentReference } from '../../mappers/mapFhirDocumentReference';
import { isWithinDocumentEditWindow } from './documentEditWindow';
import type { CancelDocumentInput, SubmitDocumentValidationIssue } from './types';

export function validateCancelDocumentInputSync(
  input: CancelDocumentInput,
): SubmitDocumentValidationIssue[] {
  const issues: SubmitDocumentValidationIssue[] = [];

  if (!input.documentReferenceId?.trim()) {
    issues.push({ field: 'documentReferenceId', message: 'Document reference ID is required.' });
  }
  if (!input.patientMbo?.trim()) {
    issues.push({ field: 'patientMbo', message: 'Patient MBO is required.' });
  }
  if (!input.practitionerHzjzId?.trim()) {
    issues.push({ field: 'practitionerHzjzId', message: 'Practitioner HZJZ ID is required.' });
  }
  if (!input.reason?.trim()) {
    issues.push({ field: 'reason', message: 'Cancellation reason is required.' });
  }

  return issues;
}

export async function validateCancelDocumentInput(
  input: CancelDocumentInput,
): Promise<SubmitDocumentValidationIssue[]> {
  const issues = validateCancelDocumentInputSync(input);
  if (issues.length > 0) return issues;

  const existing = await findMockDocumentReferenceById(input.documentReferenceId.trim());
  if (!existing) {
    issues.push({ field: 'documentReferenceId', message: 'Document was not found.' });
    return issues;
  }

  const mapped = mapFhirDocumentReference(existing);
  const status = (mapped.compositionStatus ?? '').toLowerCase();
  if (status !== 'final') {
    issues.push({
      field: 'documentReferenceId',
      message: 'Only final documents can be cancelled.',
    });
  }

  if (!isWithinDocumentEditWindow(mapped.date)) {
    issues.push({
      field: 'documentReferenceId',
      message: 'Document edit window has expired.',
    });
  }

  const patientMbo = existing.subject?.identifier?.value ?? null;
  if (patientMbo && patientMbo !== input.patientMbo.trim()) {
    issues.push({
      field: 'patientMbo',
      message: 'Patient MBO does not match the document.',
    });
  }

  return issues;
}
