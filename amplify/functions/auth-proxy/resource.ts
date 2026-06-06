import { defineFunction } from '@aws-amplify/backend';

export const authProxy = defineFunction({
  name: 'auth-proxy',
  entry: './handler.ts',
  timeoutSeconds: 10,
});
