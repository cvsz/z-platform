#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${GH_REPO:-cvsz/z-platform}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$ROOT/staging-readiness-manifest.json"
DECISION="$ROOT/staging-decision-record.json"
RELEASE_SHA="f647ca61911c97160be2ffa17aa3471d6976cddf"

command -v gh >/dev/null || { echo "error: gh is required" >&2; exit 2; }
command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 2; }
gh auth status >/dev/null

jq empty "$MANIFEST"
jq empty "$DECISION"

# Safety gate: pending evidence must be replaced by real non-secret references.
if jq -e '.. | strings | select(startswith("pending:"))' "$MANIFEST" >/dev/null; then
  echo "BLOCKED: manifest still contains pending external evidence." >&2
  echo "Replace every pending:... evidenceRef only after the corresponding external/human verification is actually complete." >&2
  exit 10
fi

gh secret set STAGING_READINESS_MANIFEST_JSON   --repo "$REPO" --env staging < "$MANIFEST"

gh secret set STAGING_DECISION_RECORD_JSON   --repo "$REPO" --env staging < "$DECISION"

gh variable set STAGING_REVIEWER   --repo "$REPO" --env staging --body "cvsz"

gh variable set INCIDENT_OWNER   --repo "$REPO" --env staging --body "cvsz"

gh variable set ESCALATION_ROUTE   --repo "$REPO" --env staging   --body "github:cvsz/z-platform#incident-response"

gh variable set WATCH_WINDOW   --repo "$REPO" --env staging --body "24h"

gh variable set PRODUCTION_APPROVER   --repo "$REPO" --env production --body "cvsz"

gh workflow run external-staging-readiness.yml   --repo "$REPO"   --ref main   -f release_sha="$RELEASE_SHA"   -f request_production_approval=false

echo "Submitted external staging readiness for $RELEASE_SHA"
