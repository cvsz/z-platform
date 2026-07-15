#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${GH_REPO:-cvsz/z-platform}"
STAGING_ENV="${STAGING_ENV:-staging}"
PRODUCTION_ENV="${PRODUCTION_ENV:-production}"
OUT_DIR="${OUT_DIR:-$HOME/.config/z-platform/secrets}"
REVIEWER="${REVIEWER:-cvsz}"
INCIDENT_OWNER="${INCIDENT_OWNER:-cvsz}"
WATCH_WINDOW="${WATCH_WINDOW:-24h}"

command -v gh >/dev/null || { echo "error: gh is required" >&2; exit 2; }
command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 2; }
command -v git >/dev/null || { echo "error: git is required" >&2; exit 2; }

gh auth status >/dev/null
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

RELEASE_SHA="${RELEASE_SHA:-$(git rev-parse origin/main)}"
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "error: RELEASE_SHA must be a full lowercase 40-character SHA" >&2
  exit 2
}

prompt_required() {
  local label="$1"
  local __var="$2"
  local value=""
  while [[ -z "$value" ]]; do
    read -r -p "$label: " value
  done
  printf -v "$__var" '%s' "$value"
}

prompt_secret_optional() {
  local label="$1"
  local __var="$2"
  local value=""
  read -r -s -p "$label (optional, press Enter to skip): " value
  echo
  printf -v "$__var" '%s' "$value"
}

prompt_required "Escalation route (non-secret, e.g. github:cvsz/z-platform#incident-response)" ESCALATION_ROUTE
prompt_required "Observability dashboard HTTPS health URL" OBSERVABILITY_DASHBOARD_URL

echo
echo "Enter a non-secret evidence reference for each verified check."
echo "Examples: github-actions:run-123/artifact-name, ticket:OPS-2026-001, qa-report:zchat-keyboard-2026-07-14"
echo "Do not enter tokens, credentials, private URLs with embedded auth, account IDs, or connection strings."
echo

declare -A EVIDENCE
CHECK_IDS=(
  observability.traces
  observability.alert_delivery
  backup.external_restore
  ai.streaming
  ai.upload
  ai.multi_provider
  ai.failover
  browser.bundle_scan
  browser.har_scan
  zchat.keyboard
  zchat.screen_reader
  zchat.responsive
  zchat.session_provider
)

for id in "${CHECK_IDS[@]}"; do
  prompt_required "Evidence reference for $id" ref
  EVIDENCE["$id"]="$ref"
done

prompt_required "Approved identity provider class" IDENTITY_PROVIDER
prompt_required "Non-secret claim mapping policy reference" CLAIM_MAPPING_REF
prompt_required "Approved secret manager class" SECRET_MANAGER
prompt_required "Managed database class" DATABASE_CLASS
prompt_required "Managed queue class" QUEUE_CLASS
prompt_required "Managed object storage class" OBJECT_STORAGE_CLASS
prompt_required "Non-secret region policy" REGION_POLICY
prompt_required "External backup target class" BACKUP_TARGET_CLASS
prompt_required "Non-secret retention policy reference" RETENTION_POLICY_REF
prompt_required "Observability platform class" OBSERVABILITY_PLATFORM
prompt_required "Alert route class" ALERT_ROUTE_CLASS
prompt_required "AI allowlist policy reference" AI_ALLOWLIST_REF
prompt_required "AI quota policy reference" AI_QUOTA_REF
prompt_required "AI failover policy reference" AI_FAILOVER_REF
prompt_required "AI data-governance policy reference" AI_GOVERNANCE_REF
prompt_required "Billing currency (e.g. THB)" BILLING_CURRENCY
prompt_required "Billing jurisdiction (e.g. TH)" BILLING_JURISDICTION
prompt_required "Merchant responsibility entity" MERCHANT_RESPONSIBILITY
prompt_required "Payment processor class" PAYMENT_PROCESSOR
prompt_required "Production approver GitHub login" PRODUCTION_APPROVER
prompt_secret_optional "Staging bearer token" STAGING_BEARER_TOKEN

REVIEWED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
MANIFEST="$OUT_DIR/staging-readiness-manifest.json"
DECISION="$OUT_DIR/staging-decision-record.json"

jq -n \
  --arg releaseSha "$RELEASE_SHA" \
  --arg reviewer "$REVIEWER" \
  --arg reviewedAt "$REVIEWED_AT" \
  --arg dashboardUrl "$OBSERVABILITY_DASHBOARD_URL" \
  --arg traces "${EVIDENCE[observability.traces]}" \
  --arg alerts "${EVIDENCE[observability.alert_delivery]}" \
  --arg backup "${EVIDENCE[backup.external_restore]}" \
  --arg streaming "${EVIDENCE[ai.streaming]}" \
  --arg upload "${EVIDENCE[ai.upload]}" \
  --arg multi "${EVIDENCE[ai.multi_provider]}" \
  --arg failover "${EVIDENCE[ai.failover]}" \
  --arg bundle "${EVIDENCE[browser.bundle_scan]}" \
  --arg har "${EVIDENCE[browser.har_scan]}" \
  --arg keyboard "${EVIDENCE[zchat.keyboard]}" \
  --arg screenReader "${EVIDENCE[zchat.screen_reader]}" \
  --arg responsive "${EVIDENCE[zchat.responsive]}" \
  --arg sessionProvider "${EVIDENCE[zchat.session_provider]}" \
  '{
    schemaVersion: "1.0.0",
    releaseSha: $releaseSha,
    checks: [
      {
        id: "observability.dashboard",
        mode: "probe",
        url: $dashboardUrl,
        expectedStatus: 200
      },
      {
        id: "observability.traces",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $traces
      },
      {
        id: "observability.alert_delivery",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $alerts
      },
      {
        id: "backup.external_restore",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $backup
      },
      {
        id: "ai.streaming",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $streaming
      },
      {
        id: "ai.upload",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $upload
      },
      {
        id: "ai.multi_provider",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $multi
      },
      {
        id: "ai.failover",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $failover
      },
      {
        id: "browser.bundle_scan",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $bundle
      },
      {
        id: "browser.har_scan",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $har
      },
      {
        id: "zchat.keyboard",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $keyboard
      },
      {
        id: "zchat.screen_reader",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $screenReader
      },
      {
        id: "zchat.responsive",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $responsive
      },
      {
        id: "zchat.session_provider",
        mode: "attestation",
        status: "verified",
        reviewer: $reviewer,
        reviewedAt: $reviewedAt,
        evidenceRef: $sessionProvider
      }
    ]
  }' > "$MANIFEST"

jq -n \
  --arg identityProvider "$IDENTITY_PROVIDER" \
  --arg claimMappingRef "$CLAIM_MAPPING_REF" \
  --arg secretManager "$SECRET_MANAGER" \
  --arg databaseClass "$DATABASE_CLASS" \
  --arg queueClass "$QUEUE_CLASS" \
  --arg objectStorageClass "$OBJECT_STORAGE_CLASS" \
  --arg regionPolicy "$REGION_POLICY" \
  --arg backupTargetClass "$BACKUP_TARGET_CLASS" \
  --arg retentionPolicyRef "$RETENTION_POLICY_REF" \
  --arg observabilityPlatform "$OBSERVABILITY_PLATFORM" \
  --arg alertRouteClass "$ALERT_ROUTE_CLASS" \
  --arg aiAllowlistRef "$AI_ALLOWLIST_REF" \
  --arg aiQuotaRef "$AI_QUOTA_REF" \
  --arg aiFailoverRef "$AI_FAILOVER_REF" \
  --arg aiGovernanceRef "$AI_GOVERNANCE_REF" \
  --arg currency "$BILLING_CURRENCY" \
  --arg jurisdiction "$BILLING_JURISDICTION" \
  --arg merchant "$MERCHANT_RESPONSIBILITY" \
  --arg processor "$PAYMENT_PROCESSOR" \
  '{
    schemaVersion: "1.0.0",
    identityProvider: {
      status: "approved",
      providerClass: $identityProvider,
      claimMappingReference: $claimMappingRef
    },
    secretManager: {
      status: "approved",
      providerClass: $secretManager
    },
    managedDataServices: {
      status: "approved",
      databaseClass: $databaseClass,
      queueClass: $queueClass,
      objectStorageClass: $objectStorageClass,
      regionPolicy: $regionPolicy
    },
    backup: {
      status: "approved",
      targetClass: $backupTargetClass,
      retentionPolicyReference: $retentionPolicyRef
    },
    observability: {
      status: "approved",
      platformClass: $observabilityPlatform,
      alertRouteClass: $alertRouteClass
    },
    aiPolicy: {
      status: "approved",
      allowlistReference: $aiAllowlistRef,
      quotaPolicyReference: $aiQuotaRef,
      failoverPolicyReference: $aiFailoverRef,
      dataGovernanceReference: $aiGovernanceRef
    },
    billing: {
      status: "approved",
      currency: $currency,
      jurisdiction: $jurisdiction,
      merchantResponsibility: $merchant,
      paymentProcessorClass: $processor
    }
  }' > "$DECISION"

chmod 600 "$MANIFEST" "$DECISION"

jq empty "$MANIFEST"
jq empty "$DECISION"

if grep -nE 'REPLACE_WITH|example\.com|<[^>]+>' "$MANIFEST" "$DECISION"; then
  echo "error: placeholder-like content remains" >&2
  exit 3
fi

[[ "$OBSERVABILITY_DASHBOARD_URL" == https://* ]] || {
  echo "error: observability dashboard URL must use HTTPS" >&2
  exit 3
}

echo "Setting protected staging secrets..."
gh secret set STAGING_READINESS_MANIFEST_JSON \
  --repo "$REPO" \
  --env "$STAGING_ENV" \
  < "$MANIFEST"

gh secret set STAGING_DECISION_RECORD_JSON \
  --repo "$REPO" \
  --env "$STAGING_ENV" \
  < "$DECISION"

if [[ -n "$STAGING_BEARER_TOKEN" ]]; then
  printf '%s' "$STAGING_BEARER_TOKEN" | gh secret set STAGING_BEARER_TOKEN \
    --repo "$REPO" \
    --env "$STAGING_ENV" \
    --body -
fi
unset STAGING_BEARER_TOKEN

echo "Setting staging variables..."
gh variable set STAGING_REVIEWER \
  --repo "$REPO" \
  --env "$STAGING_ENV" \
  --body "$REVIEWER"

gh variable set INCIDENT_OWNER \
  --repo "$REPO" \
  --env "$STAGING_ENV" \
  --body "$INCIDENT_OWNER"

gh variable set ESCALATION_ROUTE \
  --repo "$REPO" \
  --env "$STAGING_ENV" \
  --body "$ESCALATION_ROUTE"

gh variable set WATCH_WINDOW \
  --repo "$REPO" \
  --env "$STAGING_ENV" \
  --body "$WATCH_WINDOW"

gh variable set PRODUCTION_APPROVER \
  --repo "$REPO" \
  --env "$PRODUCTION_ENV" \
  --body "$PRODUCTION_APPROVER"

echo
echo "Configured:"
gh secret list --repo "$REPO" --env "$STAGING_ENV"
gh variable list --repo "$REPO" --env "$STAGING_ENV"
gh variable list --repo "$REPO" --env "$PRODUCTION_ENV"

echo
read -r -p "Run staging readiness now? [y/N]: " RUN_NOW
if [[ "$RUN_NOW" =~ ^[Yy]$ ]]; then
  gh workflow run external-staging-readiness.yml \
    --repo "$REPO" \
    --ref main \
    -f release_sha="$RELEASE_SHA" \
    -f request_production_approval=false

  sleep 3
  RUN_ID="$(
    gh run list \
      --repo "$REPO" \
      --workflow external-staging-readiness.yml \
      --limit 1 \
      --json databaseId \
      --jq '.[0].databaseId'
  )"

  echo "Watching workflow run $RUN_ID..."
  gh run watch "$RUN_ID" --repo "$REPO" --exit-status
fi

echo
echo "Manifest: $MANIFEST"
echo "Decision record: $DECISION"
echo "Release SHA: $RELEASE_SHA"
echo "Production traffic remains disabled until explicit production approval and Issue #1 completion."
