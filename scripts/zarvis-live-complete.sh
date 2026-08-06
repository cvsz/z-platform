#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_VERSION="2026.08.07.3"
ROOT_DIR="${ZARVIS_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${ROOT_DIR}/.env.zarvis.local"
COMPOSE_FILE="${ROOT_DIR}/compose.zarvis-local.yml"
CONFIRM_LIVE=false
KEEP_BACKUP=true

ACTION_PORT=8098
PROACTIVE_PORT=8099
EVIDENCE_DIR=""
BACKUP_DIR=""
RUNTIME_DIR=""
VOLUMES_REMOVED=false
RESTORE_COMPLETED=false
ROTATION_STARTED=false
ROTATION_VERIFIED=false

log()  { printf '[ZARVIS-LIVE] %s\n' "$*"; }
pass() { printf '[ZARVIS-LIVE][PASS] %s\n' "$*"; }
warn() { printf '[ZARVIS-LIVE][WARN] %s\n' "$*" >&2; }
die()  { printf '[ZARVIS-LIVE][ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Z.A.R.V.I.S. actual-host live completion validator

Usage:
  bash scripts/zarvis-live-complete.sh --confirm-live [--remove-backup]

This performs reversible but disruptive validation:
  - starts/updates the local stack;
  - runs focused tests, action/proactive acceptance, SLO and red-team checks;
  - interrupts workers and restarts services;
  - backs up, destroys and restores durable Docker volumes;
  - rotates owner and worker credentials and rejects old credentials;
  - creates secret-free evidence, manifest and checksums.

Browser microphone, camera, screen and developer-tools checks remain manual.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --confirm-live) CONFIRM_LIVE=true; shift ;;
    --remove-backup) KEEP_BACKUP=false; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

if [[ "$CONFIRM_LIVE" != true ]]; then
  if [[ -t 0 ]]; then
    cat <<'NOTICE'

This validation will temporarily stop services, remove and restore the two
Z.A.R.V.I.S. durable volumes, and rotate all three local credentials.
A verified SHA-256 backup is created before volume removal.
NOTICE
    read -r -p "Type LIVE to continue: " answer
    [[ "$answer" == "LIVE" ]] || die "Cancelled"
  else
    die "Non-interactive execution requires --confirm-live"
  fi
fi

require_tool() { command -v "$1" >/dev/null 2>&1 || die "$1 is required"; }
for tool in git docker node npm curl openssl sha256sum ss awk sed grep stat hostname; do require_tool "$tool"; done
[[ "$(uname -s)" == "Linux" ]] || die "Linux/Ubuntu is required"
docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is required"
docker info >/dev/null 2>&1 || die "Docker daemon unavailable or permission denied"
(( $(node -p 'Number(process.versions.node.split(".")[0])') >= 22 )) || die "Node.js 22+ is required"

[[ -d "${ROOT_DIR}/.git" ]] || die "Not a Git repository: ${ROOT_DIR}"
[[ -f "${ROOT_DIR}/scripts/zarvis-local-setup.sh" ]] || die "Missing local setup script"
[[ -f "$COMPOSE_FILE" ]] || die "Missing compose.zarvis-local.yml"

compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

load_env() {
  [[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE"
  chmod 600 "$ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  ACTION_PORT="${ZARVIS_ACTION_PORT:-8098}"
  PROACTIVE_PORT="${ZARVIS_PROACTIVE_PORT:-8099}"
  export ZARVIS_ACTION_PORT="$ACTION_PORT" ZARVIS_PROACTIVE_PORT="$PROACTIVE_PORT"
  export ZARVIS_LOCAL_ENV_FILE="$ENV_FILE" ZARVIS_LOCAL_COMPOSE_FILE="$COMPOSE_FILE"
}

wait_health() {
  for _ in $(seq 1 90); do
    if curl -fsS --max-time 3 "http://127.0.0.1:${ACTION_PORT}/healthz" >/dev/null \
      && curl -fsS --max-time 3 "http://127.0.0.1:${PROACTIVE_PORT}/healthz" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  compose logs --no-color --tail=200 || true
  die "Health endpoints did not recover"
}

verify_loopback() {
  local sockets address
  sockets="$(ss -ltnH | awk -v a=":${ACTION_PORT}" -v p=":${PROACTIVE_PORT}" '$4 ~ a"$" || $4 ~ p"$" {print $4}')"
  [[ -n "$sockets" ]] || die "No listeners found on Z.A.R.V.I.S. ports"
  while IFS= read -r address; do
    [[ "$address" == 127.0.0.1:* || "$address" == "[::1]":* || "$address" == ::1:* ]] \
      || die "Non-loopback listener detected: $address"
  done <<<"$sockets"
  pass "Loopback-only listeners"
}

verify_lan_denial() {
  local ip port
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$ip" && "$ip" != 127.* ]] || { warn "LAN IP unavailable; host-address denial skipped"; return 0; }
  for port in "$ACTION_PORT" "$PROACTIVE_PORT"; do
    if curl -sS --max-time 2 "http://${ip}:${port}/healthz" >/dev/null 2>&1; then
      die "Service reachable through LAN address ${ip}:${port}"
    fi
  done
  pass "Host LAN-address denial"
}

verify_secret_file() {
  [[ "$(stat -c '%a' "$ENV_FILE")" == 600 ]] || die "Secret file must be mode 600"
  git -C "$ROOT_DIR" check-ignore -q .env.zarvis.local || die ".env.zarvis.local is not Git-ignored"
  pass "Secret file mode and Git exclusion"
}

set_env_value() {
  local key="$1" value="$2" file="$3" tmp="${file}.tmp.$$"
  awk -v key="$key" -v value="$value" '
    BEGIN { done=0 }
    index($0,key"=")==1 { if(!done){print key"="value; done=1}; next }
    { print }
    END { if(!done) print key"="value }
  ' "$file" >"$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$file"
}

recover() {
  local status="$?"
  trap - ERR INT TERM EXIT
  warn "Validation failed; starting fail-safe recovery"

  if [[ "$VOLUMES_REMOVED" == true && "$RESTORE_COMPLETED" == false && -d "$BACKUP_DIR" ]]; then
    warn "Restoring durable volumes from verified backup"
    (cd "$ROOT_DIR" && bash scripts/zarvis-local-restore.sh "$BACKUP_DIR") || true
  fi

  if [[ "$ROTATION_STARTED" == true && "$ROTATION_VERIFIED" == false && -f "$RUNTIME_DIR/original.env" ]]; then
    warn "Restoring pre-rotation credentials"
    cp "$RUNTIME_DIR/original.env" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi

  if [[ -f "$ENV_FILE" ]]; then
    compose up -d || true
  fi
  warn "Evidence and backup retained at: ${EVIDENCE_DIR:-not-created}"
  exit "$status"
}
trap recover ERR INT TERM

log "Updating repository"
git -C "$ROOT_DIR" fetch origin --prune --tags
git -C "$ROOT_DIR" switch main
git -C "$ROOT_DIR" pull --ff-only origin main
git -C "$ROOT_DIR" submodule sync --recursive
git -C "$ROOT_DIR" submodule update --init --recursive

log "Starting Z.A.R.V.I.S. local stack"
bash "$ROOT_DIR/scripts/zarvis-local-setup.sh"
load_env
wait_health
verify_loopback
verify_lan_denial
verify_secret_file

SOURCE_SHA="$(git -C "$ROOT_DIR" rev-parse HEAD)"
STAMP="$(date +%Y%m%d-%H%M%S)"
EVIDENCE_DIR="$ROOT_DIR/zarvis-live-evidence/${STAMP}-${SOURCE_SHA:0:12}"
BACKUP_DIR="$EVIDENCE_DIR/backup"
RUNTIME_DIR="$ROOT_DIR/.zarvis-live-runtime-${STAMP}"
mkdir -p "$BACKUP_DIR" "$RUNTIME_DIR"
chmod 700 "$RUNTIME_DIR"
cp "$ENV_FILE" "$RUNTIME_DIR/original.env"
chmod 600 "$RUNTIME_DIR/original.env"
export GITHUB_SHA="$SOURCE_SHA" GITHUB_RUN_ID="actual-host-${STAMP}"
log "Evidence: $EVIDENCE_DIR"

log "Running focused tests"
{
  npm test --prefix "$ROOT_DIR/packages/contracts"
  npm test --prefix "$ROOT_DIR/services/zarvis-action-gateway"
  npm test --prefix "$ROOT_DIR/services/zarvis-proactive"
} >"$EVIDENCE_DIR/focused-tests.log" 2>&1
pass "Focused tests"

log "Capturing container hardening evidence"
compose config --quiet
(cd "$ROOT_DIR" && node scripts/zarvis-local-container-evidence.mjs) \
  >"$EVIDENCE_DIR/zarvis-local-container-evidence.json"
pass "Container hardening"

log "Running owner acceptance and SLO sampling"
(cd "$ROOT_DIR" && node scripts/zarvis-local-release-acceptance.mjs) \
  >"$EVIDENCE_DIR/zarvis-local-release-acceptance.json"
pass "Action/proactive owner acceptance and SLO"

log "Running security red-team suite"
(cd "$ROOT_DIR" && node scripts/zarvis-local-red-team.mjs) \
  >"$EVIDENCE_DIR/zarvis-local-red-team.json"
pass "Red-team suite"

log "Running restart and worker-interruption drill"
(cd "$ROOT_DIR" && node scripts/zarvis-local-restart-drill.mjs \
  "$EVIDENCE_DIR/zarvis-local-release-acceptance.json") \
  >"$EVIDENCE_DIR/zarvis-local-restart-drill.json"
wait_health
pass "Restart recovery"

log "Creating and verifying durable-volume backup"
(cd "$ROOT_DIR" && bash scripts/zarvis-local-backup.sh "$BACKUP_DIR") \
  >"$EVIDENCE_DIR/zarvis-local-backup-operation.json"
cp "$BACKUP_DIR/zarvis-local-backup-manifest.json" \
  "$EVIDENCE_DIR/zarvis-local-backup-manifest.json"
node - "$BACKUP_DIR" <<'NODE'
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const d=process.argv[2],m=JSON.parse(fs.readFileSync(path.join(d,'zarvis-local-backup-manifest.json')));
if(m.contains_secrets!==false || m.archives.length!==2) throw new Error('Invalid backup manifest');
for(const a of m.archives){
  const b=fs.readFileSync(path.join(d,a.file));
  const h=crypto.createHash('sha256').update(b).digest('hex');
  if(h!==a.sha256) throw new Error(`Checksum mismatch: ${a.file}`);
}
NODE
pass "Verified SHA-256 backup"

log "Destroying volumes for restore drill"
compose down -v
VOLUMES_REMOVED=true

log "Restoring durable volumes"
(cd "$ROOT_DIR" && bash scripts/zarvis-local-restore.sh "$BACKUP_DIR") \
  >"$EVIDENCE_DIR/zarvis-local-restore-operation.json"
RESTORE_COMPLETED=true
compose up -d
wait_health
(cd "$ROOT_DIR" && node scripts/zarvis-local-verify-restore.mjs \
  "$EVIDENCE_DIR/zarvis-local-release-acceptance.json") \
  >"$EVIDENCE_DIR/zarvis-local-restore-verification.json"
pass "Destructive restore and durable-state reconstruction"

log "Rotating independent credentials"
ROTATION_STARTED=true
export OLD_ZARVIS_LOCAL_OWNER_TOKEN="$ZARVIS_LOCAL_OWNER_TOKEN"
export OLD_ZARVIS_ACTION_WORKER_TOKEN="$ZARVIS_ACTION_WORKER_TOKEN"
export OLD_ZARVIS_PROACTIVE_WORKER_TOKEN="$ZARVIS_PROACTIVE_WORKER_TOKEN"
set_env_value ZARVIS_LOCAL_OWNER_TOKEN "$(openssl rand -hex 32)" "$ENV_FILE"
set_env_value ZARVIS_ACTION_WORKER_TOKEN "$(openssl rand -hex 32)" "$ENV_FILE"
set_env_value ZARVIS_PROACTIVE_WORKER_TOKEN "$(openssl rand -hex 32)" "$ENV_FILE"
load_env
compose up -d --force-recreate
wait_health
(cd "$ROOT_DIR" && node scripts/zarvis-local-verify-rotation.mjs) \
  >"$EVIDENCE_DIR/zarvis-local-rotation-verification.json"
ROTATION_VERIFIED=true
pass "Credential rotation and old-token rejection"

verify_loopback
verify_lan_denial
verify_secret_file

log "Writing actual-host evidence"
HOSTNAME_VALUE="$(hostname)" PRIMARY_IP="$(hostname -I 2>/dev/null | awk '{print $1}')" \
OS_VALUE="$(. /etc/os-release; printf '%s' "$PRETTY_NAME")" \
KERNEL_VALUE="$(uname -srmo)" DOCKER_VALUE="$(docker version --format '{{.Server.Version}}')" \
node - "$SOURCE_SHA" <<'NODE' >"$EVIDENCE_DIR/zarvis-actual-host-automated-validation.json"
const sha=process.argv[2];
const x={
 schema_version:'zarvis.actual-host-automated-validation.v1',
 generated_at:new Date().toISOString(), source_sha:sha, owner_github_id:'4076926',
 host:{hostname:process.env.HOSTNAME_VALUE,primary_ip:process.env.PRIMARY_IP,os:process.env.OS_VALUE,kernel:process.env.KERNEL_VALUE,docker:process.env.DOCKER_VALUE},
 automated_actual_host_acceptance:'passed',
 manual_owner_device_acceptance:'pending',
 automated_checks:['health','loopback-only','host-LAN-address-denial','secret-mode-0600','focused-tests','container-hardening','action-approval-execute-rollback','emergency-revoke-resume','proactive-non-mutating-handoff','SLO','red-team','restart-recovery','backup-restore','credential-rotation']
};
process.stdout.write(JSON.stringify(x,null,2)+'\n');
NODE

cat >"$EVIDENCE_DIR/MANUAL-OWNER-ACCEPTANCE-REQUIRED.md" <<EOF2
# Z.A.R.V.I.S. Manual Owner Acceptance

Automated actual-host validation: **PASS**

Release SHA: \`$SOURCE_SHA\`

Still requires owner interaction:

- Open both consoles through an SSH tunnel and unlock with the current owner token.
- Run a typed owner-bound GitHub status command.
- Test push-to-start microphone and Thai/English speech.
- Test one-frame camera and screen capture consent/stop indicators.
- Inspect browser developer tools and confirm no credential is returned.
- Confirm ports $ACTION_PORT and $PROACTIVE_PORT fail from a separate LAN device.
- Review offline recovery material and incident contacts.

Do not place the token in screenshots, chat, logs, Git, or shared evidence.
EOF2

log "Scanning evidence for old and new credentials"
for secret in \
  "$OLD_ZARVIS_LOCAL_OWNER_TOKEN" "$OLD_ZARVIS_ACTION_WORKER_TOKEN" "$OLD_ZARVIS_PROACTIVE_WORKER_TOKEN" \
  "$ZARVIS_LOCAL_OWNER_TOKEN" "$ZARVIS_ACTION_WORKER_TOKEN" "$ZARVIS_PROACTIVE_WORKER_TOKEN"; do
  if grep -R --binary-files=without-match -F "$secret" "$EVIDENCE_DIR" >/dev/null 2>&1; then
    die "Credential detected in evidence"
  fi
done
pass "Secret-free evidence"

log "Building release manifest"
(cd "$ROOT_DIR" && node scripts/zarvis-local-build-manifest.mjs "$EVIDENCE_DIR") \
  >"$EVIDENCE_DIR/zarvis-local-release-manifest.json"
(
  cd "$EVIDENCE_DIR"
  find . -maxdepth 1 -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum
) >"$EVIDENCE_DIR/SHA256SUMS"
pass "Release manifest and checksums"

rm -rf "$RUNTIME_DIR"
unset OLD_ZARVIS_LOCAL_OWNER_TOKEN OLD_ZARVIS_ACTION_WORKER_TOKEN OLD_ZARVIS_PROACTIVE_WORKER_TOKEN
if [[ "$KEEP_BACKUP" != true ]]; then rm -rf "$BACKUP_DIR"; fi
trap - ERR INT TERM

compose ps
cat <<EOF3

============================================================
 Z.A.R.V.I.S. LIVE AUTOMATED VALIDATION: PASS
============================================================
 Version:            $SCRIPT_VERSION
 Release SHA:        $SOURCE_SHA
 Action Console:     http://127.0.0.1:$ACTION_PORT
 Proactive Console:  http://127.0.0.1:$PROACTIVE_PORT
 Evidence:           $EVIDENCE_DIR
 Verified backup:    $BACKUP_DIR

Automated actual-host checks are complete.
Manual browser/microphone/camera/screen/LAN-device acceptance remains pending.
============================================================
EOF3
