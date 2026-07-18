#!/usr/bin/env bash
set -Eeuo pipefail

# Real S3-compatible backup workflow for the Phase 6 external restore gate.
# Required inputs are deliberately explicit; there is no local/mock fallback.

die() { echo "external-s3-backup: $*" >&2; exit 2; }
require() { [[ -n "${!1:-}" ]] || die "$1 is required"; }

for name in S3_API_ENDPOINT S3_BUCKET S3_PREFIX AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY \
  AWS_REGION BACKUP_SOURCE_URL BACKUP_RESTORE_URL BACKUP_VERIFY_URL BACKUP_ENCRYPTION_KEY; do
  require "$name"
done

[[ "$S3_API_ENDPOINT" == https://* ]] || die "S3_API_ENDPOINT must use HTTPS"
[[ "$BACKUP_SOURCE_URL" == https://* ]] || die "BACKUP_SOURCE_URL must use HTTPS"
[[ "$BACKUP_RESTORE_URL" == https://* ]] || die "BACKUP_RESTORE_URL must use HTTPS"
[[ "$BACKUP_VERIFY_URL" == https://* ]] || die "BACKUP_VERIFY_URL must use HTTPS"
command -v aws >/dev/null || die "aws CLI is required"
command -v curl >/dev/null || die "curl is required"
command -v openssl >/dev/null || die "openssl is required"
command -v jq >/dev/null || die "jq is required"

WORKDIR="${PHASE6_BACKUP_WORKDIR:-$(mktemp -d)}"
mkdir -p "$WORKDIR"
cleanup() { [[ -n "${PHASE6_BACKUP_WORKDIR:-}" ]] || rm -rf "$WORKDIR"; }
trap cleanup EXIT

export AWS_DEFAULT_REGION="$AWS_REGION"
AWS_ARGS=(--endpoint-url "$S3_API_ENDPOINT" --no-cli-pager)
AUTH_ARGS=()
[[ -n "${STAGING_BEARER_TOKEN:-}" ]] && AUTH_ARGS=(-H "Authorization: Bearer ${STAGING_BEARER_TOKEN}")
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OBJECT_KEY="${S3_PREFIX%/}/phase6-${STAMP}.json.enc"
PLAIN="$WORKDIR/backup.json"
ENCRYPTED="$WORKDIR/backup.json.enc"
MANIFEST="$WORKDIR/backup.manifest"

create_backup() {
  curl --fail --silent --show-error --max-time 120 "${AUTH_ARGS[@]}" \
    -H 'Accept: application/json' "$BACKUP_SOURCE_URL" -o "$PLAIN"
  [[ -s "$PLAIN" ]] || die "backup export was empty"
  openssl enc -aes-256-cbc -pbkdf2 -salt -iter 600000 \
    -pass env:BACKUP_ENCRYPTION_KEY -in "$PLAIN" -out "$ENCRYPTED"
  DIGEST="$(sha256sum "$ENCRYPTED" | awk '{print $1}')"
  printf 'object=%s\nsha256=%s\ncreatedAt=%s\n' "$OBJECT_KEY" "$DIGEST" "$STAMP" > "$MANIFEST"
  aws "${AWS_ARGS[@]}" s3 cp "$ENCRYPTED" "s3://${S3_BUCKET}/${OBJECT_KEY}" --only-show-errors
  aws "${AWS_ARGS[@]}" s3 cp "$MANIFEST" "s3://${S3_BUCKET}/${OBJECT_KEY}.manifest" --only-show-errors
  printf 'backup_object=%s\nbackup_sha256=%s\n' "$OBJECT_KEY" "$DIGEST"
}

restore_backup() {
  require BACKUP_OBJECT_KEY
  aws "${AWS_ARGS[@]}" s3 cp "s3://${S3_BUCKET}/${BACKUP_OBJECT_KEY}" "$ENCRYPTED" --only-show-errors
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
    -pass env:BACKUP_ENCRYPTION_KEY -in "$ENCRYPTED" -out "$PLAIN"
  curl --fail --silent --show-error --max-time 120 "${AUTH_ARGS[@]}" \
    -H 'Content-Type: application/json' --data-binary "@$PLAIN" "$BACKUP_RESTORE_URL" >/dev/null
  echo "backup restore request accepted"
}

verify_backup() {
  require BACKUP_OBJECT_KEY
  curl --fail --silent --show-error --max-time 120 "${AUTH_ARGS[@]}" \
    -H 'Accept: application/json' "$BACKUP_VERIFY_URL?object=$(printf '%s' "$BACKUP_OBJECT_KEY" | jq -sRr @uri)" \
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
