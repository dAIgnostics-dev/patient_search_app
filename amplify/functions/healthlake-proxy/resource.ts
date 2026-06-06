import { defineFunction } from '@aws-amplify/backend';

/**
 * HealthLake datastore (set before `npm run sandbox`).
 * HEALTHLAKE_REGION = region where the datastore lives (e.g. us-east-1).
 * Do not use AWS_REGION for HealthLake — Lambda sets AWS_REGION to the deploy region.
 *
 * Deploy sandbox in your bootstrapped Amplify region (e.g. eu-north-1):
 *   export AWS_REGION=eu-north-1
 *   export HEALTHLAKE_REGION=us-east-1
 *   export HEALTHLAKE_DATASTORE_ID=your-id
 */
const HEALTHLAKE_DATASTORE_ID = process.env.HEALTHLAKE_DATASTORE_ID ?? 'REPLACE_WITH_YOUR_DATASTORE_ID';
const HEALTHLAKE_REGION = process.env.HEALTHLAKE_REGION ?? 'us-east-1';

export const healthlakeProxy = defineFunction({
  name: 'healthlake-proxy',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    HEALTHLAKE_DATASTORE_ID,
    HEALTHLAKE_REGION,
  },
});
