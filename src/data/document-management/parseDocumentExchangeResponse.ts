import type { DocumentExchangeResult } from '../repositories/document-exchange/types';
import type { SubmitDocumentResult } from './types';

export function parseDocumentExchangeResponse(
  result: DocumentExchangeResult,
): SubmitDocumentResult {
  if (result.outcome === 'success') {
    return {
      outcome: 'success',
      documentReferenceId: result.documentReferenceId,
      documentId: result.documentId,
      bundleId: result.bundleId,
      summary: result.summary,
    };
  }

  return {
    outcome: 'error',
    issues: result.issues.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      diagnostics: issue.diagnostics,
    })),
  };
}
