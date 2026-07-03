export interface LomDocumentSubmittedEvent {
  documentReferenceId: string;
  documentId: string;
  patientMbo: string;
  typeCode: string;
  encounterVisitId?: string | null;
  practitionerHzjzId: string;
  submittedAt: string;
}
