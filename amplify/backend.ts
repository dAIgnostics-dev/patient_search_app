import { defineBackend } from '@aws-amplify/backend';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { FunctionUrlAuthType, HttpMethod } from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { auditProxy } from './functions/audit-proxy/resource';
import { authProxy } from './functions/auth-proxy/resource';
import { healthlakeProxy } from './functions/healthlake-proxy/resource';

const backend = defineBackend({
  healthlakeProxy,
  authProxy,
  auditProxy,
});

const datastoreId = process.env.HEALTHLAKE_DATASTORE_ID?.trim() ?? '';
/** Region where the HealthLake datastore exists (not necessarily the Lambda deploy region). */
const healthlakeRegion = process.env.HEALTHLAKE_REGION?.trim() || 'us-east-1';

if (!datastoreId || datastoreId === 'REPLACE_WITH_YOUR_DATASTORE_ID') {
  throw new Error(
    [
      'HEALTHLAKE_DATASTORE_ID must be set before npm run sandbox.',
      'Example:',
      '  export HEALTHLAKE_DATASTORE_ID=42f70eeeb5531b9a778bbbddeb6b487e',
      '  export HEALTHLAKE_REGION=us-east-1',
      '  export AWS_REGION=eu-north-1',
      '  npm run sandbox',
    ].join('\n'),
  );
}

// Same actions as AmazonHealthLakeReadOnlyAccess; Resource * so IAM matches the managed policy.
// (Scoped datastore/fhir/... ARNs alone can fail if the role never received the managed policy.)
backend.healthlakeProxy.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'healthlake:ListFHIRDatastores',
      'healthlake:DescribeFHIRDatastore',
      'healthlake:GetCapabilities',
      'healthlake:ReadResource',
      'healthlake:SearchWithGet',
      'healthlake:SearchWithPost',
    ],
    resources: ['*'],
  }),
);

const healthlakeApiUrl = backend.healthlakeProxy.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.GET],
    allowedHeaders: ['*'],
  },
});

const authApiUrl = backend.authProxy.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.GET, HttpMethod.POST],
    allowedHeaders: ['*'],
  },
});

const auditApiUrl = backend.auditProxy.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.POST],
    allowedHeaders: ['*'],
  },
});

const auditStorageStack = backend.createStack('auditStorage');
const auditBucket = new s3.Bucket(auditStorageStack, 'AuditAccessBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  enforceSSL: true,
  lifecycleRules: [
    {
      expiration: Duration.days(365),
    },
  ],
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true,
});

auditBucket.grantReadWrite(backend.auditProxy.resources.lambda);
backend.auditProxy.addEnvironment('AUDIT_BUCKET_NAME', auditBucket.bucketName);

backend.addOutput({
  custom: {
    // No trailing slash — avoids //Patient when clients concatenate BASE + "/Patient"
    healthlakeApiUrl: healthlakeApiUrl.url.replace(/\/+$/, ''),
    healthlakeRegion,
    healthlakeDatastoreId: datastoreId,
    authApiUrl: authApiUrl.url.replace(/\/+$/, ''),
    auditApiUrl: auditApiUrl.url.replace(/\/+$/, ''),
    auditBucketName: auditBucket.bucketName,
  },
});
