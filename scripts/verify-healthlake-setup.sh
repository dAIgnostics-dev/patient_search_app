#!/usr/bin/env bash
# Verify HealthLake datastore auth + SigV4 FHIR access (same as the Lambda proxy).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DATASTORE_ID="${HEALTHLAKE_DATASTORE_ID:-}"
REGION="${HEALTHLAKE_REGION:-us-east-1}"

if [[ -z "$DATASTORE_ID" ]]; then
  echo "Set HEALTHLAKE_DATASTORE_ID, e.g.:"
  echo "  export HEALTHLAKE_DATASTORE_ID=your-datastore-id"
  exit 1
fi

echo "=== Identity (who is calling AWS?) ==="
aws sts get-caller-identity --output table

echo ""
echo "=== Datastore (region: $REGION, id: $DATASTORE_ID) ==="
DESCRIBE=$(aws healthlake describe-fhir-datastore \
  --region "$REGION" \
  --datastore-id "$DATASTORE_ID" \
  --output json)

AUTH=$(echo "$DESCRIBE" | python3 -c "
import json,sys
d=json.load(sys.stdin)['DatastoreProperties']
ipc=d.get('IdentityProviderConfiguration') or {}
print(ipc.get('AuthorizationStrategy','(missing)'))
")

STATUS=$(echo "$DESCRIBE" | python3 -c "import json,sys; print(json.load(sys.stdin)['DatastoreProperties']['DatastoreStatus'])")
ENDPOINT=$(echo "$DESCRIBE" | python3 -c "import json,sys; print(json.load(sys.stdin)['DatastoreProperties']['DatastoreEndpoint'])")

echo "Status:                $STATUS"
echo "Endpoint:              $ENDPOINT"
echo "AuthorizationStrategy: $AUTH"
echo ""

case "$AUTH" in
  AWS_AUTH)
    echo "OK: Datastore uses AWS SigV4 (AWS_AUTH). The Lambda proxy can call it with IAM."
    ;;
  SMART_ON_FHIR*|SMART*)
    echo "BLOCKER: Datastore uses SMART on FHIR ($AUTH)."
    echo "  This app's Lambda proxy signs requests with IAM (SigV4), not OAuth/SMART tokens."
    echo "  Create a new datastore with AWS_AUTH, or use a SMART-aware proxy (not implemented here)."
    exit 2
    ;;
  *)
    echo "WARN: Unknown AuthorizationStrategy '$AUTH'. Expected AWS_AUTH for this proxy."
    ;;
esac

echo ""
echo "=== IAM test: SigV4 GET /Patient (healthlake:SearchWithGet) ==="
echo "Note: There is no 'aws healthlake search-with-get' CLI — FHIR uses HTTPS + SigV4."
echo ""

cd "$APP_DIR"
export HEALTHLAKE_REGION="$REGION"
export HEALTHLAKE_DATASTORE_ID="$DATASTORE_ID"

if npx tsx scripts/verify-healthlake-fhir.ts Patient; then
  echo ""
  echo "OK: Your credentials can search Patient on this datastore."
else
  echo ""
  echo "If 403 AccessDenied: attach healthlake:ReadResource + SearchWithGet, or AmazonHealthLakeReadOnlyAccess."
  echo "  arn:aws:healthlake:${REGION}:$(aws sts get-caller-identity --query Account --output text):datastore/fhir/${DATASTORE_ID}"
  exit 3
fi

echo ""
echo "=== Lambda proxy checklist (after npm run sandbox) ==="
echo "1. Lambda env: HEALTHLAKE_DATASTORE_ID=$DATASTORE_ID, HEALTHLAKE_REGION=$REGION"
echo "2. Lambda role includes AmazonHealthLakeReadOnlyAccess (see amplify/backend.ts)"
echo "3. Function URL in amplify_outputs.json -> custom.healthlakeApiUrl"
echo '4. Test: BASE=$(node -p "require('"'"'./amplify_outputs.json'"'"').custom.healthlakeApiUrl"); curl -s "${BASE%/}/Patient" | head'
