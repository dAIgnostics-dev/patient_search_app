import { defineFunction } from '@aws-amplify/backend';

export const auditProxy = defineFunction({
  name: 'audit-proxy',
  entry: './handler.ts',
  timeoutSeconds: 15,
});
