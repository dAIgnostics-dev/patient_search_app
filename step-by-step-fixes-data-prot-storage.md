# `patient_search_app` — Step-by-Step Fix Guide

Companion to [`findings.md`](./findings.md) and [`production-readiness-remediation.md`](./production-readiness-remediation.md).
Those two explain *what* is wrong and *why*/*in what order*. This document is the literal
**step-by-step walkthrough** for actually implementing each fix — concrete code, commands, and
verification checks, in execution order.

**Nothing in this guide has been applied yet.** It is written so each step can be done, tested, and
committed on its own. Do not run the git-history rewrite in Step 7 without the user's explicit
go-ahead — everything else is normal code/infra change.

---

## Step 1 — Add a Cognito User Pool (Amplify Gen 2 `auth` category)

Create `amplify/auth/resource.ts`:

```ts
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: { email: false, username: true },
  userAttributes: {
    // custom attributes carried through to the ID token — read by the proxies in Step 3
    'custom:practitionerId': { dataType: 'String', mutable: false },
    'custom:hzjzId': { dataType: 'String', mutable: false },
  },
});
```

Wire it into the backend in `amplify/backend.ts`:

```ts
import { auth } from './auth/resource';

const backend = defineBackend({
  auth,
  healthlakeProxy,
  authProxy, // removed later in Step 7 — keep for now so login still works mid-migration
  auditProxy,
});
```

Create the practitioner users (one-time, per environment) — do **not** put real passwords in a script
or file; set a temporary password interactively and force a reset on first login:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <POOL_ID> \
  --username ana.markovic \
  --user-attributes Name=custom:practitionerId,Value=1466 Name=custom:hzjzId,Value=1234567 \
  --temporary-password "<set-a-throwaway-temp-password-here>" \
  --message-action SUPPRESS
```

Repeat per practitioner. For local/demo environments, script this against a **sandbox** user pool only,
and never write the temporary password to a file in the repo.

**Verify:** `aws cognito-idp list-users --user-pool-id <POOL_ID>` shows the practitioners with the two
custom attributes set.

---

## Step 2 — Put the three Lambdas behind an authenticated API Gateway

Replace the raw Function URLs in `amplify/backend.ts` with an HTTP API + a Cognito JWT authorizer.

```ts
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN?.trim();
if (!FRONTEND_ORIGIN) {
  throw new Error('FRONTEND_ORIGIN must be set (e.g. https://patients.example.hr) before deploy.');
}

const apiStack = backend.createStack('api');

const authorizer = new HttpJwtAuthorizer('CognitoAuthorizer', backend.auth.resources.userPool.userPoolProviderUrl, {
  jwtAudience: [backend.auth.resources.userPoolClient.userPoolClientId],
});

const httpApi = new HttpApi(apiStack, 'PatientSearchApi', {
  corsPreflight: {
    allowOrigins: [FRONTEND_ORIGIN], // NOT '*' — fixes finding 1.1
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});

httpApi.addRoutes({
  path: '/{proxy+}',
  methods: [HttpMethod.GET],
  integration: new HttpLambdaIntegration('HealthlakeIntegration', backend.healthlakeProxy.resources.lambda),
  authorizer, // every request must carry a valid Cognito ID token — fixes finding 1.2 at the transport gate
});

httpApi.addRoutes({
  path: '/access',
  methods: [HttpMethod.POST],
  integration: new HttpLambdaIntegration('AuditIntegration', backend.auditProxy.resources.lambda),
  authorizer,
});

backend.addOutput({
  custom: {
    apiUrl: httpApi.apiEndpoint,
    userPoolId: backend.auth.resources.userPool.userPoolId,
    userPoolClientId: backend.auth.resources.userPoolClient.userPoolClientId,
  },
});
```

Notes:
- `/login` stays unauthenticated by necessity (it's how you *get* a token) — this is normal and matches
  how Cognito Hosted UI / `signIn()` works; the custom `authProxy` Lambda for login is removed in Step 7
  once the frontend talks to Cognito directly instead.
- `FRONTEND_ORIGIN` must be a real, specific origin — never `'*'` — this directly fixes finding 1.1.
- Add a `usagePlan`/throttle on the HTTP API stage here too (burst/rate limits) — this is most of
  finding/Step 6 (brute-force mitigation) for free.

**Verify:** calling `GET /Patient` (or any route) without an `Authorization: Bearer <token>` header
returns `401` from API Gateway, before the Lambda even runs.

---

## Step 3 — Make every Lambda trust the verified token, not the request body

### 3a. `audit-proxy` — derive the actor from the authorizer claims

In `amplify/functions/audit-proxy/handler.ts`, replace the client-supplied `actor` with the verified
claims from the JWT authorizer context:

```ts
function actorFromClaims(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const claims = event.requestContext.authorizer.jwt.claims;
  return {
    username: String(claims['cognito:username'] ?? claims['username']),
    practitionerId: String(claims['custom:practitionerId']),
    hzjzId: String(claims['custom:hzjzId']),
  };
}
```

Then in the handler, after parsing the body, **overwrite** `body.actor` with `actorFromClaims(event)`
before validation/storage — never trust `body.actor` from the client again. This fixes finding 2.2 for
the audit trail specifically: every audit entry's actor is now cryptographically tied to who actually
authenticated, not to whatever the client claimed.

### 3b. `healthlake-proxy` — require and use the verified identity

The route is already gated by the authorizer (Step 2), so an unauthenticated call is already rejected
before this code runs. If the product requirement is "a practitioner may only see patients they have an
encounter with" (confirm with product/compliance — this is a scope decision, not purely technical),
add the server-side check here:

```ts
async function callerMayAccessPatient(claims: JwtClaims, patientFhirId: string): Promise<boolean> {
  const hzjzId = String(claims['custom:hzjzId']);
  // search Encounter?participant.identifier=<HZJZ system>|<hzjzId>&subject=Patient/<patientFhirId>
  // return true if HealthLake returns at least one matching Encounter
}
```

Call this before `forwardToHealthLake(...)` whenever `resourceType === 'Patient'` and an `id` is present
(and, by extension, for subject-scoped searches). If the business rule is instead "any logged-in
practitioner may see any patient" (plausible for a national registry lookup tool — confirm this), then
the authenticated-only gate from Step 2 is the whole fix for this endpoint and no additional per-patient
check is needed; document that decision explicitly in the repo so it reads as a deliberate choice, not
an oversight.

**Verify:** a request with a valid token for practitioner A against a patient A has no encounter with
(if the scoping rule applies) returns `403`, not patient data.

---

## Step 4 — Move the frontend from custom `sessionStorage` session to Amplify Auth

1. `npm install aws-amplify` (if not already present) and configure it from `amplify_outputs.json`
   (Amplify Gen 2 already generates Auth config into this file once Step 1 is deployed).
2. Replace the body of `src/auth/AuthContext.tsx`:
   - `login(username, password)` → `signIn({ username, password })` from `aws-amplify/auth`.
   - `logout()` → `signOut()`.
   - Session state → derive from `fetchAuthSession()` / `getCurrentUser()` instead of a hand-rolled
     `sessionStorage` object. Amplify's Auth category manages token storage and refresh itself.
3. In `src/data/HealthLakeClient.ts` and `src/data/auditAccess.ts`, attach the ID token to every request:

```ts
import { fetchAuthSession } from 'aws-amplify/auth';

async function authHeader(): Promise<Record<string, string>> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

Spread `...(await authHeader())` into the `fetch()` headers in both `request()` (`HealthLakeClient.ts`)
and `postAuditEvent()` (`auditAccess.ts`).

**Verify:** open browser dev tools → Network tab → confirm every `/Patient`, `/Encounter`, `/access`
call carries an `Authorization: Bearer eyJ...` header, and that logging out clears the token so a
subsequent call gets `401`.

---

## Step 5 — Confirm CORS is locked down end-to-end

Already set in Step 2 (`allowOrigins: [FRONTEND_ORIGIN]`), but double-check there is no leftover `'*'`
anywhere:

```bash
grep -rn "allowedOrigins\|allowOrigins" amplify/
```

Should show only the single real origin, for every environment (staging and prod each need their own
`FRONTEND_ORIGIN` value — do not reuse one across environments).

---

## Step 6 — Throttling / brute-force protection

If using API Gateway (Step 2), add a usage plan with a sane rate/burst limit on the stage, e.g.:

```ts
httpApi.addStage('prod', {
  throttle: { rateLimit: 20, burstLimit: 40 }, // tune to real expected traffic
});
```

For login specifically, Cognito already locks an account out after repeated failed `InitiateAuth` calls
by default; if stricter behavior is needed, enable **Cognito Advanced Security** (risk-based adaptive
auth) on the user pool — note this is a paid feature tier, confirm cost before enabling.

**Verify:** scripted rapid-fire login attempts against a test account get throttled (`429`) well before
any real lockout window is needed.

---

## Step 7 — Remove plaintext credentials (code + git history)

**Do the code removal first, independently of the history rewrite:**

1. Delete `amplify/functions/auth-proxy/` entirely (handler, resource, `accounts.json`).
2. Delete `auth/accounts/*.txt` and `server/authMiddleware.ts`.
3. Rewrite `scripts/generate-accounts.ts` to call `aws cognito-idp admin-create-user` (Step 1) per
   practitioner instead of writing password files — never write a real or shared password to disk.
4. Remove the now-dead wiring: `server/authMiddleware.ts` import in the dev server, `authProxy` from
   `amplify/backend.ts`, `resolveAuthApiBaseUrl`/`resolveAuthLoginUrl` in `src/config/runtime.ts`.
5. Update `README.md`'s "Login — plain-text account files per practitioner (POC only)" line to describe
   the Cognito flow instead.

Commit that normally. **Then, separately and only with the user's explicit go-ahead**, purge the old
plaintext passwords from git history (the files above are already tracked in past commits even after
deletion):

```bash
# Requires git-filter-repo (brew install git-filter-repo / pip install git-filter-repo)
git filter-repo --invert-paths \
  --path amplify/functions/auth-proxy/accounts.json \
  --path auth/accounts/1466.txt \
  --path auth/accounts/2466.txt \
  --path auth/accounts/3466.txt \
  --path auth/accounts/5466.txt
```

This **rewrites every commit SHA** from the first commit touching those paths onward. Coordinate before
running it:
- Everyone with a clone must re-clone or hard-reset to the rewritten history — their old clones no
  longer share history with the rewritten remote.
- Any open PRs against the old history will need to be re-based or re-opened.
- The remote (`origin`) needs a force-push of every rewritten branch — **do not run `git push --force`
  yourself**; this plan stops at the rewritten local history, the user pushes it.

If the shared demo password (`cezih-demo`) is the *only* thing that was ever committed (confirmed in
`findings.md` §3.1) and this repo has never held a real credential, this step is low real-world urgency
and can be scheduled rather than rushed — just make sure it happens before any real credential is ever
added the same way.

---

## Step 8 — Add automated secret scanning

```bash
npm install --save-dev gitleaks  # or install the standalone gitleaks binary
```

Add `.gitleaks.toml` with the project's own allow-list (so the historical demo password, once purged in
Step 7, doesn't need a permanent allow-rule), and wire it as a pre-commit hook (e.g. via `husky`) and as
a CI step so a future `password=`/`secret=`-shaped commit fails the build instead of merging.

**Verify:** `git commit` with a dummy `password=something123` line in a staged file is blocked locally;
the same change opened as a PR fails CI.

---

## Step 9 — Harden the audit S3 bucket for durability

In `amplify/backend.ts`, change the bucket definition for the production stack:

```ts
const auditBucket = new s3.Bucket(auditStorageStack, 'AuditAccessBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  enforceSSL: true,
  versioned: true,
  encryption: s3.BucketEncryption.KMS,
  encryptionKey: auditKmsKey, // new dedicated kms.Key, defined above this block
  objectLockEnabled: true,
  objectLockDefaultRetention: s3.ObjectLockRetention.compliance(Duration.days(2555)), // confirm retention period with compliance — placeholder is 7y
  lifecycleRules: [{ expiration: Duration.days(2555) }], // match retention, confirm with compliance
  removalPolicy: RemovalPolicy.RETAIN, // was DESTROY — fixes finding 3.3
  // autoDeleteObjects removed entirely — fixes finding 3.3
});
```

Add the KMS key just above it:

```ts
const auditKmsKey = new kms.Key(auditStorageStack, 'AuditKey', {
  enableKeyRotation: true,
  removalPolicy: RemovalPolicy.RETAIN,
});
```

**Verify:** `aws s3api get-bucket-versioning` and `get-object-lock-configuration` on the deployed bucket
show versioning and lock enabled; attempting to delete an object before its retention period ends fails
with `AccessDenied`, even using the Lambda's own role.

---

## Step 10 — Make audit writes atomic (per-event objects)

Replace the single-growing-object pattern in `amplify/functions/audit-proxy/handler.ts`:

```ts
// Before: one shared key, read-modify-write (race condition — finding 3.4)
// const AUDIT_OBJECT_KEY = 'access.jsonl';

// After: one independent object per event, keyed by date + eventId — no read, no race
function auditObjectKey(occurredAt: string, eventId: string): string {
  const d = new Date(occurredAt);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `access/${yyyy}/${mm}/${dd}/${eventId}.json`;
}

async function putAuditEvent(bucket: string, event: Record<string, unknown>): Promise<void> {
  const key = auditObjectKey(event.occurredAt as string, event.eventId as string);
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(event),
    ContentType: 'application/json',
  }));
}
```

Delete `readExistingAuditLog`/`appendAuditLine` entirely — no longer needed once each event is its own
object. If a single combined `.jsonl` view is still wanted for ad-hoc review, generate it on read (e.g.
an Athena table over the `access/` prefix, or a scheduled compaction Lambda) rather than maintaining it
as the write path.

**Verify:** fire two audit POSTs concurrently (e.g. `curl` in parallel in a shell loop) and confirm both
land as separate objects under `access/.../` — no entry is lost, by construction.

---

## Step 11 — Scope the HealthLake IAM policy to the real datastore

Once the datastore ARN is stable, in `amplify/backend.ts` change:

```ts
// Before:
resources: ['*'],

// After:
resources: [
  `arn:aws:healthlake:${healthlakeRegion}:${Stack.of(apiStack).account}:datastore/fhir/${datastoreId}`,
],
```

Deploy to a non-prod environment first and re-run every HealthLake call path (`read`, `search`,
`searchAll`, pagination via `next` links) to confirm the managed-policy quirk noted in the original code
comment doesn't resurface with the narrowed resource — if it does, document exactly which action failed
before deciding whether to keep `'*'` for that one action only.

---

## Step 12 — Hardening pass

- Add **AWS WAFv2** in front of the HTTP API (Step 2) — start with the AWS Managed Core rule set plus a
  rate-based rule.
- Add a **CloudWatch Alarm** on a metric filter over `auth.login.failed` volume (from the audit log) and
  on `healthlake-proxy` 4xx/403 rate, notifying via SNS.
- Re-read `README.md` and remove every remaining "POC only" / "not for production compliance" caveat
  only once the corresponding fix above is actually deployed and verified — don't just delete the
  warning text early.

---

## Step 13 — Final verification before go-live

- [ ] No endpoint reachable without a valid Cognito token (Steps 2–3).
- [ ] No plaintext credential exists in the working tree or (after Step 7's history rewrite, if done) in
      git history.
- [ ] CORS allows only the real frontend origin(s), per environment.
- [ ] Audit bucket survives a `cdk destroy`/redeploy of every other stack (test this in a non-prod
      account).
- [ ] Two concurrent audit writes never lose an entry (Step 10's verification, repeated at higher
      concurrency).
- [ ] HealthLake IAM policy is scoped to the real datastore ARN.
- [ ] An external penetration test / security review has signed off, and legal/compliance has signed off
      on data handling (GDPR Art. 9 + Croatian health-data regulation) — this guide covers the
      engineering side only.
