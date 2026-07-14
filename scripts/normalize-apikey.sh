#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

# Normalize *_KEY assignments without printing secret values.
#
# Processing order:
#   1. Read KEY=value or export KEY=value assignments.
#   2. Keep only variable names ending in _KEY.
#   3. Remove every single quote and double quote from the value.
#   4. Keep the last duplicate assignment.
#   5. Sort names A to Z.
#   6. Write each assignment as NAME="VALUE".
#
# Usage:
#   APIKEY_FILE=.apikey ./scripts/normalize-apikey.sh
#   ./scripts/normalize-apikey.sh /secure/path/.apikey

readonly APIKEY_FILE="${1:-${APIKEY_FILE:-.apikey}}"
readonly KEY_NAME_RE='^[A-Z][A-Z0-9_]*_KEY$'

tmp_file=''
cleanup() {
  [[ -z "$tmp_file" ]] || rm -f -- "$tmp_file"
  return 0
}
trap cleanup EXIT

log() {
  printf '%s\n' "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

sanitize_value() {
  local value="$1"

  # Required normalization: remove existing quote characters first.
  value="${value//\"/}"
  value="${value//\'/}"

  # Keep one assignment per physical line and preserve backslashes safely.
  value="${value//$'\r'/}"
  value="${value//$'\n'/}"
  value="${value//\\/\\\\}"

  printf '%s' "$value"
}

main() {
  local line name value line_number=0 accepted=0 ignored=0
  local timestamp backup_file

  [[ -f "$APIKEY_FILE" ]] || die "File not found: $APIKEY_FILE"
  [[ -r "$APIKEY_FILE" ]] || die "File is not readable: $APIKEY_FILE"

  command -v awk >/dev/null 2>&1 || die 'Missing command: awk'
  command -v sort >/dev/null 2>&1 || die 'Missing command: sort'
  command -v mktemp >/dev/null 2>&1 || die 'Missing command: mktemp'
  command -v install >/dev/null 2>&1 || die 'Missing command: install'

  chmod 600 "$APIKEY_FILE"
  tmp_file="$(mktemp)"
  chmod 600 "$tmp_file"

  # Use awk as a last-wins map without exposing values in logs.
  while IFS= read -r line || [[ -n "$line" ]]; do
    ((line_number += 1))
    line="${line%$'\r'}"
    line="$(trim "$line")"

    [[ -z "$line" || "$line" == \#* ]] && continue

    if [[ "$line" == export[[:space:]]* ]]; then
      line="$(trim "${line#export}")"
    fi

    if [[ "$line" != *=* ]]; then
      ((ignored += 1))
      continue
    fi

    name="$(trim "${line%%=*}")"
    value="$(trim "${line#*=}")"

    if [[ ! "$name" =~ $KEY_NAME_RE ]]; then
      ((ignored += 1))
      continue
    fi

    value="$(sanitize_value "$value")"
    printf '%s\t%s\n' "$name" "$value"
    ((accepted += 1))
  done < "$APIKEY_FILE" |
    awk -F '\t' '{ values[$1] = substr($0, index($0, $2)) } END { for (name in values) print name "\t" values[name] }' |
    sort -t $'\t' -k1,1 |
    awk -F '\t' '{
      name = $1
      value = substr($0, index($0, $2))
      gsub(/\\/, "\\\\", value)
      gsub(/\"/, "", value)
      gsub(/\047/, "", value)
      printf "%s=\"%s\"\n", name, value
    }' > "$tmp_file"

  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  backup_file="${APIKEY_FILE}.backup.${timestamp}"
  cp -- "$APIKEY_FILE" "$backup_file"
  chmod 600 "$backup_file"
  install -m 600 "$tmp_file" "$APIKEY_FILE"

  log "Normalized: $APIKEY_FILE"
  log "Backup:     $backup_file"
  log "Accepted assignments: $accepted"
  log "Ignored lines:        $ignored"
}

main "$@"
