#!/usr/bin/env bash
# Test the deployed Lambda Function URL (not direct HealthLake).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

BASE=$(node -p "require('./amplify_outputs.json').custom?.healthlakeApiUrl || ''")
if [[ -z "$BASE" ]]; then
  echo "Missing custom.healthlakeApiUrl in amplify_outputs.json — run npm run sandbox first."
  exit 1
fi

BASE="${BASE%/}"
FAILED=0

test_url() {
  local label="$1"
  local path="$2"
  local url="${BASE}${path}"
  echo ""
  echo "=== $label ==="
  echo "GET $url"
  local http
  http=$(curl -sS -o "/tmp/hl-proxy-${label// /-}.json" -w "%{http_code}" "$url")
  echo "HTTP $http"
  head -c 400 "/tmp/hl-proxy-${label// /-}.json"
  echo ""
  if [[ "$http" != "200" ]]; then
    FAILED=1
  fi
}

test_url "Patient" "/Patient"
test_url "Encounter subject" "/Encounter?subject=Patient%2F1442"

if [[ "$FAILED" -eq 0 ]]; then
  echo ""
  echo "OK: Lambda proxy can read Patient and Encounter search from HealthLake."
  exit 0
fi

echo ""
echo "If 404 Unsupported endpoint: use paths like \${BASE}/Patient (no double slash)."
echo "If 403 signature mismatch: redeploy sandbox (handler must use node:https, not fetch)."
echo "  export HEALTHLAKE_DATASTORE_ID=your-id"
echo "  export HEALTHLAKE_REGION=us-east-1"
echo "  export AWS_REGION=eu-north-1"
echo "  npm run sandbox"
exit 1
