import { findMockEncounterByVisitId } from '../fhir-client/mockCezihClient';
import { CEZIH_HZJZ_SYSTEM } from '../../fhir/types';
import type { SubmitDocumentInput, SubmitDocumentValidationIssue } from './types';

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export function validateSubmitDocumentInputSync(
  input: SubmitDocumentInput,
): SubmitDocumentValidationIssue[] {
  const issues: SubmitDocumentValidationIssue[] = [];

  if (!input.patientMbo?.trim()) {
    issues.push({ field: 'patientMbo', message: 'Patient MBO is required.' });
  }
  if (!input.encounterVisitId?.trim()) {
    issues.push({ field: 'encounterVisitId', message: 'Encounter visit ID is required.' });
  }
  if (!input.practitionerHzjzId?.trim()) {
    issues.push({ field: 'practitionerHzjzId', message: 'Practitioner HZJZ ID is required.' });
  }
  if (!input.organizationHzzoCode?.trim()) {
    issues.push({ field: 'organizationHzzoCode', message: 'Organization HZZO code is required.' });
  }
  if (!input.anamnesisText?.trim()) {
    issues.push({ field: 'anamnesisText', message: 'Anamnesis text is required.' });
  }
  if (!input.outcomeCode?.trim()) {
    issues.push({ field: 'outcomeCode', message: 'Visit outcome is required.' });
  }
  if (input.typeCode !== '011') {
    issues.push({ field: 'typeCode', message: 'Only document type 011 is supported.' });
  }

  if (input.attachment) {
    if (!input.attachment.fileName?.trim()) {
      issues.push({ field: 'attachment.fileName', message: 'Attachment file name is required.' });
    }
    if (!input.attachment.contentType?.trim()) {
      issues.push({ field: 'attachment.contentType', message: 'Attachment content type is required.' });
    }
    if (!input.attachment.base64Data?.trim()) {
      issues.push({ field: 'attachment.base64Data', message: 'Attachment data is required.' });
    } else {
      const estimatedBytes = Math.floor((input.attachment.base64Data.length * 3) / 4);
      if (estimatedBytes > MAX_ATTACHMENT_BYTES) {
        issues.push({ field: 'attachment', message: 'Attachment exceeds 2 MB limit.' });
      }
    }
  }

  return issues;
}

export async function validateSubmitDocumentInput(
  input: SubmitDocumentInput,
  practitionerHzjzId: string,
): Promise<SubmitDocumentValidationIssue[]> {
  const issues = validateSubmitDocumentInputSync(input);
  if (issues.length > 0) return issues;

  const encounter = await findMockEncounterByVisitId(input.encounterVisitId.trim());
  if (!encounter) {
    issues.push({ field: 'encounterVisitId', message: 'Encounter not found.' });
    return issues;
  }

  const status = (encounter.status ?? '').toLowerCase();
  if (status !== 'in-progress') {
    issues.push({ field: 'encounterVisitId', message: 'Encounter must be in progress.' });
  }

  const encounterHzjz =
    encounter.participant?.[0]?.individual?.identifier?.value ??
    encounter.participant?.find(
      (item) => item.individual?.identifier?.system === CEZIH_HZJZ_SYSTEM,
    )?.individual?.identifier?.value;

  if (encounterHzjz && encounterHzjz !== practitionerHzjzId) {
    issues.push({
      field: 'encounterVisitId',
      message: 'Encounter does not belong to the current practitioner.',
    });
  }

  return issues;
}
