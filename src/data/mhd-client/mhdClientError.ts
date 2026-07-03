import type { MhdOperationIssue } from './types';

export class MhdClientError extends Error {
  constructor(public readonly issues: MhdOperationIssue[]) {
    super(issues.map((issue) => issue.diagnostics ?? issue.code).join('; '));
    this.name = 'MhdClientError';
  }
}
