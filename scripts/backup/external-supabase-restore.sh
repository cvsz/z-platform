#!/usr/bin/env bash
set -Eeuo pipefail

# Real private Supabase Storage backup workflow for the Phase 6 external restore gate.

die() { echo "external-supabase-backup: $*" >&2; exit 2; }
require() { [[ -n "${!1:-}" ]] || die "$1 is required"; }

for name in SUPABASE_URL SUPABASE_SECRET_KEY SUPABASE_BACKUP_BUCKET SUPABASE_BACKUP_PREFIX \
  BACKUP_SOURCE_URL BACKUP_RESTORE_URL BACKUP_VERIFY_URL BACKUP_ENCRYPTION_KEY; do
  require "$name"
done
[[ "$SUPABASE_URL" == https://* ]] || die "SUPABASE_URL must use HTTPS"
for name in BACKUP_SOURCE_URL BACKUP_RESTORE_URL BACKUP_VERIFY_URL; do
  [[ "${!name}" == https://* ]] || die "$name must use HTTPS"
done
command -v curl >/dev/null || die "curl is required"
command -v openssl >/dev/null || die "openssl is required"
command -v jq >/dev/null || die "jq is required"

WORKDIR="${PHASE6_BACKUP_WORKDIR:-$(mktemp -d)}"
mkdir -p "$WORKDIR"
cleanup() { [[ -n "${PHASE6_BACKUP_WORKDIR:-}" ]] || rm -rf "$WORKDIR"; }
trap cleanup EXIT

AUTH=(-H "apikey: ${SUPABASE_SECRET_KEY}" -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}")
APP_AUTH=()
[[ -n "${STAGING_BEARER_TOKEN:-}" ]] && APP_AUTH=(-H "Authorization: Bearer ${STAGING_BEARER_TOKEN}")
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OBJECT_KEY="${SUPABASE_BACKUP_PREFIX%/}/phase6-${STAMP}.json.enc"
PLAIN="$WORKDIR/backup.json"
ENCRYPTED="$WORKDIR/backup.json.enc"
OBJECT_FILE="$WORKDIR/object-key"

storage_url() { printf '%s/storage/v1/object/%s/%s' "$SUPABASE_URL" "$SUPABASE_BACKUP_BUCKET" "$1"; }

create_backup() {
  curl --fail --silent --show-error --max-time 120 "${APP_AUTH[@]}" \
    -H 'Accept: application/json' "$BACKUP_SOURCE_URL" -o "$PLAIN"
  [[ -s "$PLAIN" ]] || die "backup export was empty"
  openssl enc -aes-256-cbc -pbkdf2 -salt -iter 600000 \
    -pass env:BACKUP_ENCRYPTION_KEY -in "$PLAIN" -out "$ENCRYPTED"
  DIGEST="$(sha256sum "$ENCRYPTED" | awk '{print $1}')"
  printf '%s' "$OBJECT_KEY" > "$OBJECT_FILE"
  curl --fail --silent --show-error --max-time 120 -X POST "$(storage_url "$OBJECT_KEY")" \
    "${AUTH[@]}" -H 'Content-Type: application/octet-stream' -H 'x-upsert: false' --data-binary "@$ENCRYPTED" >/dev/null
  printf 'object=%s\nsha256=%s\ncreatedAt=%s\n' "$OBJECT_KEY" "$DIGEST" "$STAMP" | \
    curl --fail --silent --show-error --max-time 30 -X POST "$(storage_url "$OBJECT_KEY.manifest")" \
      "${AUTH[@]}" -H 'Content-Type: text/plain' -H 'x-upsert: false' --data-binary @- >/dev/null
  printf 'backup_object=%s\nbackup_sha256=%s\n' "$OBJECT_KEY" "$DIGEST"
}

restore_backup() {
  object_key="${BACKUP_OBJECT_KEY:-$(cat "$OBJECT_FILE" 2>/dev/null || true)}"
  [[ -n "$object_key" ]] || die "BACKUP_OBJECT_KEY or a prior create operation is required"
  curl --fail --silent --show-error --max-time 120 "$(storage_url "$object_key")" "${AUTH[@]}" -o "$ENCRYPTED"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
    -pass env:BACKUP_ENCRYPTION_KEY -in "$ENCRYPTED" -out "$PLAIN"
  curl --fail --silent --show-error --max-time 120 "${APP_AUTH[@]}" \
    -H 'Content-Type: application/json' --data-binary "@$PLAIN" "$BACKUP_RESTORE_URL" >/dev/null
  echo "backup restore request accepted"
}

verify_backup() {
  object_key="${BACKUP_OBJECT_KEY:-$(cat "$OBJECT_FILE" 2>/dev/null || true)}"
  [[ -n "$object_key" ]] || die "BACKUP_OBJECT_KEY or a prior create operation is required"
  curl --fail --silent --show-error --max-time 120 "${APP_AUTH[@]}" \
    -H 'Accept: application/json' "$BACKUP_VERIFY_URL?object=$(printf '%s' "$object_key" | jq -sRr @uri)" \
    -o "$WORKDIR/verification.json"
  jq -e '(.verified == true) or (.status == "verified") or (.restored == true)' "$WORKDIR/verification.json" >/dev/null \
    || die "backup verification response did not confirm integrity and restore"
  echo "backup restore verification passed"
}

case "${1:-}" in
  create) create_backup ;;
  restore) restore_backup ;;
  verify) verify_backup ;;
  *) die "usage: $0 {create|restore|verify}" ;;
esac
