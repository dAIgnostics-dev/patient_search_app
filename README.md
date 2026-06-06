# CEZIH Patient Search (Practitioner PAA)

Practitioner-facing app to look up patient kartons from **AWS HealthLake** via a Gen 2 Lambda FHIR proxy deployed from this project.

## Features

- **Login** — plain-text account files per practitioner (POC only)
- **MBO lookup** — enter patient MBO → open karton (no open name-only search); recently viewed patients on the MBO tab
- **My patients** — patients who had an encounter with the logged-in practitioner; search, sort, and filter within your panel
- **Patient karton** — sticky banner, at-a-glance summary, collapsible sections with jump nav, encounter timeline (highlights your visits), conditions, medications, allergies, procedures, documents, and referrals
- **Localization** — Croatian (default) and English UI; FHIR status codes translated; Croatian uses `hr-HR` date format and 24-hour time
- **Access audit (POC)** — MBO lookups, list selections, karton opens, and resource views logged locally (`audit/access.jsonl`) or to S3 (`access.jsonl` in the deployed audit bucket); not for production compliance

## Prerequisites

- Node.js 20+
- AWS credentials configured
- HealthLake datastore with FHIR data imported (see [`../app_healthlake/`](../app_healthlake/))

## Setup

```bash
cd app_patient_search
npm install

# Deploy Lambda FHIR proxy (writes amplify_outputs.json)
export HEALTHLAKE_DATASTORE_ID=your-datastore-id
export HEALTHLAKE_REGION=us-east-1
export AWS_REGION=eu-north-1   # or your bootstrapped Amplify region
npm run sandbox

# Generate practitioner login accounts
npm run auth:generate

# Run the UI
npm run dev
```

Open http://localhost:5173

## Verify proxy

```bash
npm run verify:healthlake:proxy
```

## Demo credentials

After `npm run auth:generate`, default password for all accounts is **`cezih-demo`**:

| Username | Practitioner | HZJZ ID |
|----------|--------------|---------|
| `ana.markovic` | Ana Marković | 1234567 |
| `luka.novak` | Luka Novak | 2233445 |
| `ivana.juric` | Ivana Jurić | 3344556 |
| `ana.knezevic` | Ana Knezevic | 1234568 |

## Example MBOs

| MBO | Patient |
|-----|---------|
| `180223069` | Ivan Horvat |
| `290334170` | Petra Kovacic |
| `480556182` | Ana Horvat |

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `HEALTHLAKE_DATASTORE_ID` | Shell when running `npm run sandbox` | Datastore ID for Lambda + IAM |
| `HEALTHLAKE_REGION` | Shell when running sandbox | Region where HealthLake datastore exists |
| `AWS_REGION` | Shell when running sandbox | Region where Amplify deploys the Lambda |
| `VITE_API_BASE_URL` | `.env` or shell for `npm run dev` | Override FHIR proxy URL |
| `VITE_AUTH_API_URL` | `.env` or Amplify env | Override auth Lambda URL (default: Vite middleware locally, `amplify_outputs.json` when deployed) |
| `VITE_AUDIT_API_URL` | `.env` or Amplify env | Override audit Lambda URL (default: Vite middleware locally, `amplify_outputs.json` when deployed) |
| `VITE_BUNDLE_SCOPE` | `.env` for `npm run dev` | Default **on** — only CEZIH bulk-import ids (~31 resources). Set `false` to search the full datastore (slower). Manifest: [`src/config/cezihBundleManifest.ts`](src/config/cezihBundleManifest.ts) |

### Adding clinical resources to the karton

Medications, allergies, procedures, documents, and referrals are loaded from HealthLake when present. After you import those FHIR resources:

1. Add their resource ids to the matching arrays in [`src/config/cezihBundleManifest.ts`](src/config/cezihBundleManifest.ts) (e.g. `MedicationRequest`, `AllergyIntolerance`), **or**
2. Set `VITE_BUNDLE_SCOPE=false` to search the full datastore.

Redeploy the Lambda proxy if you add new resource types (`npm run sandbox`).

## Architecture

```text
React UI → HealthLakeClient → healthlake-proxy Lambda
Login    → auth-proxy Lambda (deployed) or Vite middleware (local dev)
Audit    → audit-proxy Lambda → S3 access.jsonl (deployed) or Vite middleware → audit/access.jsonl (local)
                              ↓
                         HealthLake FHIR R4
```

### Access audit log (POC)

The UI sends fire-and-forget audit events. Locally, the Vite dev/preview server appends to **`audit/access.jsonl`** (gitignored). When deployed, **`audit-proxy`** appends to **`s3://<auditBucket>/access.jsonl`** (bucket name in `amplify_outputs.json` → `custom.auditBucketName`).

Locally the endpoint is `POST /api/audit/access`; deployed it is `POST <auditApiUrl>/access`.

Each line is a flat JSON object with nested `actor`, `patient`, `resource`, and `context` blocks:

| Field | Purpose |
|-------|---------|
| `eventId` | Unique UUID per event |
| `sessionId` | UUID created at login; ties events to one practitioner session |
| `correlationId` | UUID per patient journey (lookup → karton → resource views) |
| `action` | Event type (see table below) |
| `outcome` | `success` \| `not_found` \| `error` |
| `occurredAt` | Client timestamp |
| `recordedAt` | Server append timestamp |
| `actor` | `{ practitionerId, username, hzjzId, displayName }` |
| `patient` | `{ id, mbo, displayName }` when applicable |
| `resource` | `{ type, id }` for resource views |
| `lookup` | `{ mbo }` for MBO searches |
| `context` | `{ source, locale }` when applicable |

| `action` | When |
|----------|------|
| `auth.login` | Successful practitioner login |
| `auth.login.failed` | Failed login (`actor.username` only; no `sessionId`) |
| `auth.logout` | User logs out |
| `mbo.lookup` | MBO search submitted |
| `patient.list.select` | Patient chosen from My patients or Recently viewed |
| `patient.karton.open` | Patient karton load completes (any outcome) |
| `patient.resource.view` | User opens a detail panel (visit, condition, practitioner, organization, etc.) |

## Project layout

| Path | Purpose |
|------|---------|
| [`amplify/functions/healthlake-proxy/`](amplify/functions/healthlake-proxy/) | Lambda FHIR proxy |
| [`amplify/functions/auth-proxy/`](amplify/functions/auth-proxy/) | Lambda login (bundled `accounts.json`) |
| [`amplify/functions/audit-proxy/`](amplify/functions/audit-proxy/) | Lambda access audit → S3 |
| [`src/data/healthlakeApiClient.ts`](src/data/healthlakeApiClient.ts) | Karton + patient search |
| [`auth/accounts/`](auth/accounts/) | POC practitioner credentials |

## Account files

One file per practitioner in `auth/accounts/<fhirId>.txt`:

```txt
username=ana.markovic
password=cezih-demo
practitionerId=1466
hzjzId=1234567
firstName=Ana
lastName=Marković
```

Regenerate when mock practitioners change: `npm run auth:generate` (updates both `auth/accounts/*.txt` and `amplify/functions/auth-proxy/accounts.json`).

**Note:** Text-file / bundled JSON auth is for POC only. Replace with real authentication before production.

## Amplify Hosting

After connecting the repo in Amplify Console (app root: `app_patient_search`):

1. Set backend env vars: `HEALTHLAKE_DATASTORE_ID`, `HEALTHLAKE_REGION`, `AWS_REGION`
2. Deploy — Amplify generates `amplify_outputs.json` with `healthlakeApiUrl`, `authApiUrl`, `auditApiUrl`
3. The UI automatically uses the Lambda URLs from outputs (no `VITE_*` overrides needed)
4. Download audit log: `aws s3 cp s3://<auditBucketName>/access.jsonl .`
