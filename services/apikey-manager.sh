#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

# ==============================================================================
# API Key Manager
#
# Features:
#   - Organize *_API_KEY / *_TOKEN / selected credential variables A -> Z
#   - Normalize assignments to NAME="value"
#   - Preserve secrets without printing them
#   - Detect empty, placeholder, duplicate, malformed, and suspicious values
#   - Test supported provider credentials using read-only endpoints
#   - Export a CSV validation report without exposing secrets
#   - Create timestamped backups before rewriting
#
# Usage:
#   ./apikey-manager.sh sanitize
#   ./apikey-manager.sh organize
#   ./apikey-manager.sh lint
#   ./apikey-manager.sh test
#   ./apikey-manager.sh report
#   ./apikey-manager.sh all
#
# Optional environment variables:
#   APIKEY_FILE=/path/to/.apikey
#   APIKEY_REPORT=/path/to/apikey-validation-report.csv
#   APIKEY_TIMEOUT=15
#   APIKEY_CONNECT_TIMEOUT=5
#   APIKEY_PARALLELISM=6
#
# Exit codes:
#   0  Success / no invalid credentials found
#   1  Invalid credential or lint failure found
#   2  Indeterminate result such as timeout, DNS failure, or unsupported provider
#
# Security:
#   - Complete credential values are never printed.
#   - Query-string credentials are avoided except where required by provider API.
#   - Temporary files are created with restrictive permissions.
#   - The target credential file and backups are chmod 600.
# ==============================================================================

readonly SCRIPT_NAME="${0##*/}"
readonly APIKEY_FILE="${APIKEY_FILE:-.apikey}"
readonly APIKEY_REPORT="${APIKEY_REPORT:-apikey-validation-report.csv}"
readonly APIKEY_TIMEOUT="${APIKEY_TIMEOUT:-15}"
readonly APIKEY_CONNECT_TIMEOUT="${APIKEY_CONNECT_TIMEOUT:-5}"
readonly APIKEY_PARALLELISM="${APIKEY_PARALLELISM:-6}"
readonly COMMAND="${1:-all}"

readonly PLACEHOLDER_REGEX='^$|^\.+$|^[xX*]+$|^replace([-_ ]?me)?$|^your([-_ ]?.*)?$|^change([-_ ]?me)?$|^changeme$|^todo$|^tbd$|^null$|^none$|^undefined$|^example$|^dummy$|^test$|^secret$|^api[-_ ]?key$'

# Credential names accepted by the parser.
# In addition to *_API_KEY, some providers use *_TOKEN or account identifiers.
readonly CREDENTIAL_NAME_REGEX='^[A-Z][A-Z0-9_]*(API_KEY|TOKEN|ACCESS_TOKEN|SECRET_KEY|ACCOUNT_ID|CLIENT_SECRET)$'
readonly SANITIZE_NAME_REGEX='^[A-Z][A-Z0-9_]*_[A-Z0-9]+_KEY$'

# ------------------------------------------------------------------------------
# Provider validation registry
#
# TEST_METHODS:
#   bearer_models      Authorization: Bearer <key>, GET models endpoint
#   api_key_header     x-api-key: <key>
#   github_bearer      Authorization: Bearer <token>
#   gemini_query       ?key=<key> (required by Gemini API)
#   cloudflare         Bearer token + account id
#
# A status of HTTP 200/201/204 is VALID.
# HTTP 401/403 is INVALID.
# HTTP 429 is RATE_LIMITED and generally indicates the credential was accepted.
# Other statuses are reported as UNKNOWN unless provider-specific logic applies.
# ------------------------------------------------------------------------------

declare -Ar TEST_URLS=(
  [CEREBRAS_API_KEY]="https://api.cerebras.ai/v1/models"
  [CODESTRAL_API_KEY]="https://codestral.mistral.ai/v1/models"
  [DASHSCOPE_API_KEY]="https://dashscope.aliyuncs.com/compatible-mode/v1/models"
  [DEEPSEEK_API_KEY]="https://api.deepseek.com/models"
  [FIREWORKS_API_KEY]="https://api.fireworks.ai/inference/v1/models"
  [GEMINI_API_KEY]="https://generativelanguage.googleapis.com/v1beta/models"
  [GITHUB_MODELS_TOKEN]="https://models.github.ai/catalog/models"
  [GROQ_API_KEY]="https://api.groq.com/openai/v1/models"
  [MISTRAL_API_KEY]="https://api.mistral.ai/v1/models"
  [NVIDIA_NIM_API_KEY]="https://integrate.api.nvidia.com/v1/models"
  [OPENAI_API_KEY]="https://api.openai.com/v1/models"
  [OPENROUTER_API_KEY]="https://openrouter.ai/api/v1/models"
  [SAMBANOVA_API_KEY]="https://api.sambanova.ai/v1/models"
)

declare -Ar TEST_METHODS=(
  [CEREBRAS_API_KEY]="bearer_models"
  [CODESTRAL_API_KEY]="bearer_models"
  [DASHSCOPE_API_KEY]="bearer_models"
  [DEEPSEEK_API_KEY]="bearer_models"
  [FIREWORKS_API_KEY]="bearer_models"
  [GEMINI_API_KEY]="gemini_query"
  [GITHUB_MODELS_TOKEN]="github_bearer"
  [GROQ_API_KEY]="bearer_models"
  [MISTRAL_API_KEY]="bearer_models"
  [NVIDIA_NIM_API_KEY]="bearer_models"
  [OPENAI_API_KEY]="bearer_models"
  [OPENROUTER_API_KEY]="bearer_models"
  [SAMBANOVA_API_KEY]="bearer_models"
)

# ------------------------------------------------------------------------------
# Logging and cleanup
# ------------------------------------------------------------------------------

log() {
  printf '%s\n' "$*" >&2
}

info() {
  log "INFO: $*"
}

warn() {
  log "WARN: $*"
}

die() {
  log "ERROR: $*"
  exit 1
}

cleanup_files=()

cleanup() {
  local path
  for path in "${cleanup_files[@]:-}"; do
    [[ -n "$path" ]] && rm -rf -- "$path"
  done
  return 0
}

trap cleanup EXIT

make_temp() {
  local path
  path="$(mktemp)"
  chmod 600 "$path"
  cleanup_files+=("$path")
  printf '%s' "$path"
}

# ------------------------------------------------------------------------------
# Preconditions
# ------------------------------------------------------------------------------

require_tools() {
  local tool
  local required=(
    awk
    chmod
    cp
    curl
    date
    grep
    install
    mktemp
    sed
    sort
  )

  for tool in "${required[@]}"; do
    command -v "$tool" >/dev/null 2>&1 ||
      die "Required command not found: $tool"
  done
}

ensure_input_file() {
  [[ -f "$APIKEY_FILE" ]] || die "Credential file not found: $APIKEY_FILE"
  [[ -r "$APIKEY_FILE" ]] || die "Credential file is not readable: $APIKEY_FILE"
  chmod 600 "$APIKEY_FILE"
}

validate_numeric_settings() {
  [[ "$APIKEY_TIMEOUT" =~ ^[1-9][0-9]*$ ]] ||
    die "APIKEY_TIMEOUT must be a positive integer"

  [[ "$APIKEY_CONNECT_TIMEOUT" =~ ^[1-9][0-9]*$ ]] ||
    die "APIKEY_CONNECT_TIMEOUT must be a positive integer"

  [[ "$APIKEY_PARALLELISM" =~ ^[1-9][0-9]*$ ]] ||
    die "APIKEY_PARALLELISM must be a positive integer"
}

# ------------------------------------------------------------------------------
# String helpers
# ------------------------------------------------------------------------------

trim() {
  local value="$1"

  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  printf '%s' "$value"
}

unquote() {
  local value="$1"

  if [[ "$value" =~ ^\"(.*)\"$ ]]; then
    value="${BASH_REMATCH[1]}"
  elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
    value="${BASH_REMATCH[1]}"
  fi

  printf '%s' "$value"
}

escape_env_value() {
  local value="$1"

  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\r'/}"
  value="${value//$'\n'/\\n}"

  printf '%s' "$value"
}

sanitize_key_value() {
  local value="$1"

  value="${value//\'/}"
  value="${value//\"/}"
  value="${value//:/}"
  value="${value//\\/}"

  if [[ -z "$value" ]]; then
    value="KEY"
  fi

  printf '%s' "$value"
}

normalize_sanitize_line() {
  local original="$1"
  local working="$original"
  local leading=""
  local export_prefix=""
  local name
  local raw_value
  local value

  if [[ "$working" =~ ^([[:space:]]*) ]]; then
    leading="${BASH_REMATCH[1]}"
    working="${working:${#leading}}"
  fi

  if [[ "$working" =~ ^export[[:space:]]+ ]]; then
    export_prefix="export "
    working="${working:${#BASH_REMATCH[0]}}"
  fi

  if [[ "$working" != *=* ]]; then
    printf '%s' "$original"
    return 0
  fi

  name="$(trim "${working%%=*}")"

  if [[ ! "$name" =~ $SANITIZE_NAME_REGEX ]]; then
    printf '%s' "$original"
    return 0
  fi

  raw_value="${working#*=}"
  value="$(trim "$raw_value")"
  value="$(sanitize_key_value "$value")"

  printf '%s%s%s="%s"' "$leading" "$export_prefix" "$name" "$value"
}

csv_escape() {
  local value="$1"

  value="${value//\"/\"\"}"
  printf '"%s"' "$value"
}

mask_secret() {
  local value="$1"
  local length="${#value}"

  if (( length == 0 )); then
    printf '<empty>'
  elif (( length <= 8 )); then
    printf '********'
  else
    printf '%s…%s' "${value:0:4}" "${value: -4}"
  fi
}

secret_fingerprint() {
  local value="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$value" | sha256sum | awk '{print substr($1, 1, 12)}'
  elif command -v shasum >/dev/null 2>&1; then
    printf '%s' "$value" | shasum -a 256 | awk '{print substr($1, 1, 12)}'
  else
    printf 'unavailable'
  fi
}

is_credential_name() {
  local name="$1"
  [[ "$name" =~ $CREDENTIAL_NAME_REGEX ]]
}

is_placeholder() {
  local value="${1,,}"
  [[ "$value" =~ $PLACEHOLDER_REGEX ]]
}

looks_suspicious() {
  local value="$1"

  (( ${#value} < 8 )) && return 0
  [[ "$value" =~ [[:space:]] ]] && return 0
  [[ "$value" == *"<"* || "$value" == *">"* ]] && return 0

  return 1
}

# ------------------------------------------------------------------------------
# Parser
#
# Output records are tab-separated:
#   ENTRY        line_number  name  value
#   INVALID      line_number  original_line
#   INVALID_NAME line_number  name
# ------------------------------------------------------------------------------

read_entries() {
  local line
  local name
  local raw_value
  local value
  local line_number=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    ((line_number += 1))

    line="${line%$'\r'}"
    line="$(trim "$line")"

    [[ -z "$line" ]] && continue
    [[ "$line" == \#* ]] && continue

    if [[ "$line" == export[[:space:]]* ]]; then
      line="${line#export}"
      line="$(trim "$line")"
    fi

    if [[ "$line" != *=* ]]; then
      printf 'INVALID\t%s\t%s\n' "$line_number" "$line"
      continue
    fi

    name="$(trim "${line%%=*}")"
    raw_value="${line#*=}"
    value="$(unquote "$(trim "$raw_value")")"

    if ! is_credential_name "$name"; then
      printf 'INVALID_NAME\t%s\t%s\n' "$line_number" "$name"
      continue
    fi

    printf 'ENTRY\t%s\t%s\t%s\n' "$line_number" "$name" "$value"
  done < "$APIKEY_FILE"
}

# ------------------------------------------------------------------------------
# Sanitize / organize
# ------------------------------------------------------------------------------

sanitize_file() {
  local output_file
  local backup_file
  local timestamp
  local line

  output_file="$(make_temp)"
  timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  backup_file="${APIKEY_FILE}.backup.${timestamp}"

  cp -- "$APIKEY_FILE" "$backup_file"
  chmod 600 "$backup_file"

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$''}"
    normalize_sanitize_line "$line"
    printf '
'
  done < "$APIKEY_FILE" > "$output_file"

  install -m 600 "$output_file" "$APIKEY_FILE"

  info "Sanitized without deleting or reordering lines: $APIKEY_FILE"
  info "Backup created: $backup_file"
}

organize() {
  sanitize_file
}

# ------------------------------------------------------------------------------
# Lint
# ------------------------------------------------------------------------------

lint() {
  local parsed_file
  local seen_file
  local status=0
  local configured=0
  local not_set=0
  local suspicious=0
  local duplicates=0
  local invalid=0

  parsed_file="$(make_temp)"
  seen_file="$(make_temp)"

  read_entries > "$parsed_file"

  while IFS=$'\t' read -r record line_number name value; do
    case "$record" in
      ENTRY)
        if grep -Fxq "$name" "$seen_file"; then
          printf 'DUPLICATE    %-36s line %s\n' "$name" "$line_number"
          ((duplicates += 1))
          status=1
        else
          printf '%s\n' "$name" >> "$seen_file"
        fi

        if is_placeholder "$value"; then
          printf 'NOT_SET      %-36s %s\n' "$name" "$(mask_secret "$value")"
          ((not_set += 1))
          status=1
        elif looks_suspicious "$value"; then
          printf 'SUSPICIOUS   %-36s %s\n' "$name" "$(mask_secret "$value")"
          ((suspicious += 1))
          status=1
        else
          printf 'CONFIGURED   %-36s %s fingerprint=%s\n' \
            "$name" \
            "$(mask_secret "$value")" \
            "$(secret_fingerprint "$value")"
          ((configured += 1))
        fi
        ;;
      INVALID)
        printf 'INVALID      line %-4s malformed assignment\n' "$line_number"
        ((invalid += 1))
        status=1
        ;;
      INVALID_NAME)
        printf 'INVALID_NAME line %-4s %s\n' "$line_number" "$name"
        ((invalid += 1))
        status=1
        ;;
    esac
  done < "$parsed_file"

  printf '\n'
  printf 'Lint summary: configured=%d not_set=%d suspicious=%d duplicates=%d invalid=%d\n' \
    "$configured" "$not_set" "$suspicious" "$duplicates" "$invalid"

  return "$status"
}

# ------------------------------------------------------------------------------
# HTTP validation
# ------------------------------------------------------------------------------

normalize_curl_exit() {
  local exit_code="$1"

  case "$exit_code" in
    5|6)  printf 'DNS_ERROR' ;;
    7)    printf 'CONNECTION_FAILED' ;;
    28)   printf 'TIMEOUT' ;;
    35|51|58|60|66|77|80|82|83|90|91)
          printf 'TLS_ERROR' ;;
    *)    printf 'NETWORK_ERROR_%s' "$exit_code" ;;
  esac
}

classify_http_status() {
  local http_status="$1"

  case "$http_status" in
    200|201|202|204)
      printf 'VALID'
      ;;
    401|403)
      printf 'INVALID'
      ;;
    429)
      printf 'RATE_LIMITED'
      ;;
    404)
      printf 'ENDPOINT_NOT_FOUND'
      ;;
    500|502|503|504)
      printf 'PROVIDER_UNAVAILABLE'
      ;;
    000|'')
      printf 'UNREACHABLE'
      ;;
    *)
      printf 'UNKNOWN'
      ;;
  esac
}

validate_http_key() {
  local name="$1"
  local value="$2"
  local method="$3"
  local url="$4"
  local response_file
  local headers_file
  local http_status
  local curl_exit=0
  local result
  local detail

  response_file="$(make_temp)"
  headers_file="$(make_temp)"

  local -a curl_args=(
    --silent
    --show-error
    --location
    --connect-timeout "$APIKEY_CONNECT_TIMEOUT"
    --max-time "$APIKEY_TIMEOUT"
    --output "$response_file"
    --dump-header "$headers_file"
    --write-out '%{http_code}'
    --header 'Accept: application/json'
    --header 'User-Agent: z-platform-apikey-validator/1.0'
  )

  case "$method" in
    bearer_models)
      curl_args+=(--header "Authorization: Bearer ${value}")
      ;;
    api_key_header)
      curl_args+=(--header "x-api-key: ${value}")
      ;;
    github_bearer)
      curl_args+=(
        --header "Authorization: Bearer ${value}"
        --header 'X-GitHub-Api-Version: 2022-11-28'
      )
      ;;
    gemini_query)
      curl_args+=(--get --data-urlencode "key=${value}")
      ;;
    *)
      printf '%s\t%s\t%s\t%s\t%s\n' \
        "$name" "UNTESTED" "" "unsupported validation method" "$(secret_fingerprint "$value")"
      return 2
      ;;
  esac

  set +e
  http_status="$(curl "${curl_args[@]}" "$url")"
  curl_exit=$?
  set -e

  if (( curl_exit != 0 )); then
    result="$(normalize_curl_exit "$curl_exit")"
    detail="curl_exit=${curl_exit}"
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "$name" "$result" "000" "$detail" "$(secret_fingerprint "$value")"
    return 2
  fi

  result="$(classify_http_status "$http_status")"

  case "$result" in
    VALID)
      detail="credential accepted by read-only endpoint"
      ;;
    INVALID)
      detail="credential rejected by provider"
      ;;
    RATE_LIMITED)
      detail="provider returned rate limit; credential may be valid"
      ;;
    ENDPOINT_NOT_FOUND)
      detail="validation endpoint not available for this account/provider version"
      ;;
    PROVIDER_UNAVAILABLE)
      detail="provider returned server-side failure"
      ;;
    *)
      detail="provider returned an indeterminate response"
      ;;
  esac

  printf '%s\t%s\t%s\t%s\t%s\n' \
    "$name" "$result" "$http_status" "$detail" "$(secret_fingerprint "$value")"

  case "$result" in
    VALID|RATE_LIMITED)
      return 0
      ;;
    INVALID)
      return 1
      ;;
    *)
      return 2
      ;;
  esac
}

validate_cloudflare_key() {
  local token="$1"
  local account_id="$2"

  if is_placeholder "$account_id"; then
    printf '%s\t%s\t%s\t%s\t%s\n' \
      "CLOUDFLARE_API_TOKEN" \
      "UNTESTED" \
      "" \
      "CLOUDFLARE_ACCOUNT_ID is not configured" \
      "$(secret_fingerprint "$token")"
    return 2
  fi

  validate_http_key \
    "CLOUDFLARE_API_TOKEN" \
    "$token" \
    "bearer_models" \
    "https://api.cloudflare.com/client/v4/accounts/${account_id}/ai/models/search"
}

load_credential_map() {
  local parsed_file="$1"
  local output_file="$2"

  awk -F '\t' '
    $1 == "ENTRY" {
      values[$3] = $4
    }
    END {
      for (name in values) {
        print name "\t" values[name]
      }
    }
  ' "$parsed_file" > "$output_file"
}

lookup_value() {
  local map_file="$1"
  local name="$2"

  awk -F '\t' -v target="$name" '
    $1 == target {
      print substr($0, index($0, $2))
      exit
    }
  ' "$map_file"
}

test_keys_tsv() {
  local parsed_file
  local map_file
  local results_dir
  local account_id
  local name
  local value
  local method
  local url
  local active_jobs=0
  local index=0

  parsed_file="$(make_temp)"
  map_file="$(make_temp)"
  results_dir="$(mktemp -d)"
  chmod 700 "$results_dir"
  cleanup_files+=("$results_dir")

  read_entries > "$parsed_file"
  load_credential_map "$parsed_file" "$map_file"

  while IFS=$'\t' read -r name value; do
    ((index += 1))

    if is_placeholder "$value"; then
      printf '%s\t%s\t%s\t%s\t%s\n' \
        "$name" \
        "NOT_CONFIGURED" \
        "" \
        "empty or placeholder value" \
        "$(secret_fingerprint "$value")" \
        > "${results_dir}/$(printf '%06d' "$index").tsv"
      continue
    fi

    # Cloudflare requires both token and account id.
    if [[ "$name" == "CLOUDFLARE_API_TOKEN" ]]; then
      account_id="$(lookup_value "$map_file" "CLOUDFLARE_ACCOUNT_ID")"

      (
        validate_cloudflare_key "$value" "$account_id" \
          > "${results_dir}/$(printf '%06d' "$index").tsv"
      ) &
      ((active_jobs += 1))
    elif [[ -n "${TEST_URLS[$name]:-}" ]]; then
      method="${TEST_METHODS[$name]}"
      url="${TEST_URLS[$name]}"

      (
        validate_http_key "$name" "$value" "$method" "$url" \
          > "${results_dir}/$(printf '%06d' "$index").tsv"
      ) &
      ((active_jobs += 1))
    else
      printf '%s\t%s\t%s\t%s\t%s\n' \
        "$name" \
        "UNTESTED" \
        "" \
        "no safe read-only validation endpoint configured" \
        "$(secret_fingerprint "$value")" \
        > "${results_dir}/$(printf '%06d' "$index").tsv"
    fi

    if (( active_jobs >= APIKEY_PARALLELISM )); then
      wait -n || true
      ((active_jobs -= 1))
    fi
  done < "$map_file"

  wait || true

  find "$results_dir" -maxdepth 1 -type f -name '*.tsv' -print0 |
    sort -z |
    xargs -0 cat
}

test_keys() {
  local results_file
  local status=0
  local valid=0
  local invalid=0
  local rate_limited=0
  local unreachable=0
  local untested=0
  local other=0

  results_file="$(make_temp)"
  test_keys_tsv > "$results_file"

  while IFS=$'\t' read -r name result http_status detail fingerprint; do
    printf '%-15s %-36s HTTP %-3s fingerprint=%s\n' \
      "$result" \
      "$name" \
      "${http_status:--}" \
      "$fingerprint"

    case "$result" in
      VALID)
        ((valid += 1))
        ;;
      INVALID)
        ((invalid += 1))
        status=1
        ;;
      RATE_LIMITED)
        ((rate_limited += 1))
        ;;
      NOT_CONFIGURED|UNTESTED)
        ((untested += 1))
        ;;
      DNS_ERROR|CONNECTION_FAILED|TIMEOUT|TLS_ERROR|UNREACHABLE|NETWORK_ERROR_*)
        ((unreachable += 1))
        [[ "$status" -eq 0 ]] && status=2
        ;;
      *)
        ((other += 1))
        [[ "$status" -eq 0 ]] && status=2
        ;;
    esac
  done < "$results_file"

  printf '\n'
  printf 'Validation summary: valid=%d invalid=%d rate_limited=%d unreachable=%d untested=%d other=%d\n' \
    "$valid" "$invalid" "$rate_limited" "$unreachable" "$untested" "$other"

  return "$status"
}

# ------------------------------------------------------------------------------
# CSV report
# ------------------------------------------------------------------------------

write_report() {
  local results_file
  local report_dir
  local generated_at

  results_file="$(make_temp)"
  test_keys_tsv > "$results_file"

  report_dir="${APIKEY_REPORT%/*}"
  if [[ "$report_dir" != "$APIKEY_REPORT" ]]; then
    mkdir -p "$report_dir"
  fi

  generated_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  {
    printf 'generated_at,name,status,http_status,detail,fingerprint\n'

    while IFS=$'\t' read -r name result http_status detail fingerprint; do
      csv_escape "$generated_at"
      printf ','
      csv_escape "$name"
      printf ','
      csv_escape "$result"
      printf ','
      csv_escape "$http_status"
      printf ','
      csv_escape "$detail"
      printf ','
      csv_escape "$fingerprint"
      printf '\n'
    done < "$results_file"
  } > "$APIKEY_REPORT"

  chmod 600 "$APIKEY_REPORT"
  info "Validation report written: $APIKEY_REPORT"
}

# ------------------------------------------------------------------------------
# Help
# ------------------------------------------------------------------------------

usage() {
  cat <<EOF
Usage:
  $SCRIPT_NAME sanitize
  $SCRIPT_NAME organize
  $SCRIPT_NAME lint
  $SCRIPT_NAME test
  $SCRIPT_NAME report
  $SCRIPT_NAME all
  $SCRIPT_NAME help

Environment:
  APIKEY_FILE              Credential file (default: .apikey)
  APIKEY_REPORT            CSV report path (default: apikey-validation-report.csv)
  APIKEY_TIMEOUT           Total request timeout seconds (default: 15)
  APIKEY_CONNECT_TIMEOUT   Connection timeout seconds (default: 5)
  APIKEY_PARALLELISM       Concurrent validation requests (default: 6)

Behavior:
  sanitize and organize preserve every line and only rewrite *_*_KEY values.
  The characters ', ", :, and backslash are removed. Empty results become KEY.

Examples:
  APIKEY_FILE=.apikey ./$SCRIPT_NAME sanitize
  APIKEY_FILE=.apikey ./$SCRIPT_NAME organize
  APIKEY_FILE=.apikey ./$SCRIPT_NAME lint
  APIKEY_FILE=.apikey ./$SCRIPT_NAME test
  APIKEY_FILE=.apikey APIKEY_REPORT=reports/apikey.csv ./$SCRIPT_NAME report
  APIKEY_FILE=.apikey ./$SCRIPT_NAME all
EOF
}

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------

main() {
  require_tools
  validate_numeric_settings

  case "$COMMAND" in
    help|-h|--help)
      usage
      ;;
    sanitize|organize)
      ensure_input_file
      sanitize_file
      ;;
    lint)
      ensure_input_file
      lint
      ;;
    test)
      ensure_input_file
      test_keys
      ;;
    report)
      ensure_input_file
      write_report
      ;;
    all)
      ensure_input_file
      sanitize_file

      printf '\n== Lint ==\n'
      lint || true

      printf '\n== Remote validation ==\n'
      test_keys || true

      printf '\n== CSV report ==\n'
      write_report
      ;;
    *)
      usage >&2
      die "Unknown command: $COMMAND"
      ;;
  esac
}

main "$@"