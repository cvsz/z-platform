#!/usr/bin/env bash
set -Eeuo pipefail

log() { printf '\n[INFO] %s\n' "$*"; }
die() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

log "Starting automated fix process..."

# 1. Install missing dependencies recursively
log "Installing missing dependencies (pnpm install)..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm install --recursive --prefer-offline || die "pnpm install failed"
else
  log "pnpm not found, trying npm..."
  npm install --workspaces --if-present || die "npm install failed"
fi

# 2. Ensure .env files exist for services that might need them to pass tests
log "Ensuring minimal .env files exist to prevent config errors..."
for dir in apps/zchat services/ai-gateway services/billing-ledger; do
  if [[ -d "$dir" ]]; then
    env_file="$dir/.env"
    if [[ ! -f "$env_file" ]]; then
      log "Creating minimal $env_file..."
      cat > "$env_file" << 'ENV'
NODE_ENV=test
LOG_LEVEL=error
# Minimal mocks to prevent startup crashes during local test
AI_PROVIDER_ENDPOINTS=https://api.example-ai-1.com,https://api.example-ai-2.com
AI_UPLOAD_URL=https://upload.example-ai.com
AI_FAILOVER_URL=https://failover.example-ai.com
ALERT_TEST_URL=https://alerts.example.com/test
ALERT_DELIVERY_STATUS_URL=https://alerts.example.com/status
ENV
      chmod 600 "$env_file"
    fi
  fi
done

# 3. Run tests to verify fixes
log "Running tests to verify fixes..."
if command -v pnpm >/dev/null 2>&1; then
  pnpm test || {
    die "Tests still failing. Please check logs above and fix manually before pushing."
  }
else
  npm test || {
    die "Tests still failing. Please check logs above and fix manually before pushing."
  }
fi

log "All tests passed!"

# 4. Attempt push (only if tests pass)
log "Attempting to push to remote..."
if git push; then
  log "Push successful!"
else
  die "Push failed. You may need to pull changes first or resolve conflicts."
fi

log "Automated fix complete."
