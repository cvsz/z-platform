#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

# Organize and validate credentials without printing complete secret values.
# Usage: APIKEY_FILE=.apikey ./scripts/apikey-manager.sh {organize|lint|test|report|all|help}

readonly APIKEY_FILE="${APIKEY_FILE:-.apikey}"
readonly APIKEY_REPORT="${APIKEY_REPORT:-apikey-validation-report.csv}"
readonly APIKEY_TIMEOUT="${APIKEY_TIMEOUT:-15}"
readonly APIKEY_CONNECT_TIMEOUT="${APIKEY_CONNECT_TIMEOUT:-5}"
readonly COMMAND="${1:-all}"
readonly NAME_RE='^[A-Z][A-Z0-9_]*(API_KEY|TOKEN|ACCESS_TOKEN|SECRET_KEY|ACCOUNT_ID|CLIENT_SECRET)$'
readonly PLACEHOLDER_RE='^$|^\.+$|^[xX*]+$|^replace([-_ ]?me)?$|^your([-_ ]?.*)?$|^change([-_ ]?me)?$|^todo$|^tbd$|^null$|^none$|^undefined$|^example$|^dummy$|^test$|^secret$|^api[-_ ]?key$'

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
  [GEMINI_API_KEY]="query"
  [GITHUB_MODELS_TOKEN]="github"
)

tmp_paths=()
cleanup() {
  local path
  for path in "${tmp_paths[@]:-}"; do
    if [[ -n "$path" ]]; then rm -rf -- "$path"; fi
  done
  return 0
}
trap cleanup EXIT

log() { printf '%s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
make_tmp() { local p; p="$(mktemp)"; chmod 600 "$p"; tmp_paths+=("$p"); printf '%s' "$p"; }
trim() { local v="$1"; v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"; printf '%s' "$v"; }
unquote() { local v="$1"; if [[ "$v" =~ ^\"(.*)\"$ || "$v" =~ ^\'(.*)\'$ ]]; then v="${BASH_REMATCH[1]}"; fi; printf '%s' "$v"; }
escape_env() { local v="$1"; v="${v//\\/\\\\}"; v="${v//\"/\\\"}"; v="${v//$'\r'/}"; v="${v//$'\n'/\\n}"; printf '%s' "$v"; }
mask() { local v="$1"; if (( ${#v} <= 8 )); then printf '********'; else printf '%s…%s' "${v:0:4}" "${v: -4}"; fi; }
is_placeholder() { local v="${1,,}"; [[ "$v" =~ $PLACEHOLDER_RE ]]; }

require_tools() {
  local t
  for t in awk chmod cp curl date grep install mktemp sed sort uniq; do
    command -v "$t" >/dev/null 2>&1 || die "Missing command: $t"
  done
}

ensure_file() {
  [[ -f "$APIKEY_FILE" ]] || die "Credential file not found: $APIKEY_FILE"
  chmod 600 "$APIKEY_FILE"
}

read_entries() {
  local line name value raw line_no=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    ((line_no += 1))
    line="${line%$'\r'}"; line="$(trim "$line")"
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" == export[[:space:]]* ]]; then line="$(trim "${line#export}")"; fi
    if [[ "$line" != *=* ]]; then printf 'INVALID\t%s\t%s\n' "$line_no" "$line"; continue; fi
    name="$(trim "${line%%=*}")"; raw="${line#*=}"; value="$(unquote "$(trim "$raw")")"
    if [[ ! "$name" =~ $NAME_RE ]]; then printf 'INVALID_NAME\t%s\t%s\n' "$line_no" "$name"; continue; fi
    printf 'ENTRY\t%s\t%s\t%s\n' "$line_no" "$name" "$value"
  done < "$APIKEY_FILE"
}

organize() {
  local parsed out backup stamp
  parsed="$(make_tmp)"; out="$(make_tmp)"; read_entries > "$parsed"
  if grep -qE '^(INVALID|INVALID_NAME)' "$parsed"; then
    log "WARN: malformed or unsupported lines were excluded"
  fi
  {
    printf '# API credentials\n# Never commit this file or its backups.\n\n'
    awk -F '\t' '$1=="ENTRY" {v[$3]=$4} END {for (k in v) print k "\t" v[k]}' "$parsed" |
      sort -t $'\t' -k1,1 |
      while IFS=$'\t' read -r name value; do printf '%s="%s"\n' "$name" "$(escape_env "$value")"; done
  } > "$out"
  stamp="$(date -u '+%Y%m%dT%H%M%SZ')"; backup="${APIKEY_FILE}.backup.${stamp}"
  cp -- "$APIKEY_FILE" "$backup"; chmod 600 "$backup"; install -m 600 "$out" "$APIKEY_FILE"
  log "Organized: $APIKEY_FILE"; log "Backup: $backup"
}

lint() {
  local parsed seen status=0 configured=0 unset_count=0 suspicious=0 duplicates=0 invalid=0
  parsed="$(make_tmp)"; seen="$(make_tmp)"; read_entries > "$parsed"
  while IFS=$'\t' read -r kind line_no name value; do
    case "$kind" in
      ENTRY)
        if grep -Fxq "$name" "$seen"; then printf 'DUPLICATE    %-36s line %s\n' "$name" "$line_no"; ((duplicates+=1)); status=1; else printf '%s\n' "$name" >> "$seen"; fi
        if is_placeholder "$value"; then printf 'NOT_SET      %-36s\n' "$name"; ((unset_count+=1)); status=1
        elif (( ${#value} < 8 )) || [[ "$value" =~ [[:space:]] ]]; then printf 'SUSPICIOUS   %-36s %s\n' "$name" "$(mask "$value")"; ((suspicious+=1)); status=1
        else printf 'CONFIGURED   %-36s %s\n' "$name" "$(mask "$value")"; ((configured+=1)); fi
        ;;
      INVALID|INVALID_NAME) printf '%-12s line %-4s %s\n' "$kind" "$line_no" "$name"; ((invalid+=1)); status=1 ;;
    esac
  done < "$parsed"
  printf '\nLint summary: configured=%d not_set=%d suspicious=%d duplicates=%d invalid=%d\n' "$configured" "$unset_count" "$suspicious" "$duplicates" "$invalid"
  return "$status"
}

classify_http() {
  case "$1" in
    200|201|202|204) printf VALID ;;
    401|403) printf INVALID ;;
    429) printf RATE_LIMITED ;;
    404) printf ENDPOINT_NOT_FOUND ;;
    500|502|503|504) printf PROVIDER_UNAVAILABLE ;;
    000|'') printf UNREACHABLE ;;
    *) printf UNKNOWN ;;
  esac
}

validate_one() {
  local name="$1" value="$2" url="$3" method="${TEST_METHODS[$name]:-bearer}" body headers code rc=0 status detail
  body="$(make_tmp)"; headers="$(make_tmp)"
  local -a args=(--silent --show-error --location --connect-timeout "$APIKEY_CONNECT_TIMEOUT" --max-time "$APIKEY_TIMEOUT" --output "$body" --dump-header "$headers" --write-out '%{http_code}' --header 'Accept: application/json' --header 'User-Agent: z-platform-apikey-validator/1.0')
  case "$method" in
    bearer) args+=(--header "Authorization: Bearer ${value}") ;;
    github) args+=(--header "Authorization: Bearer ${value}" --header 'X-GitHub-Api-Version: 2022-11-28') ;;
    query) args+=(--get --data-urlencode "key=${value}") ;;
  esac
  set +e; code="$(curl "${args[@]}" "$url")"; rc=$?; set -e
  if (( rc != 0 )); then
    case "$rc" in 5|6) status=DNS_ERROR;; 7) status=CONNECTION_FAILED;; 28) status=TIMEOUT;; 35|51|58|60|66|77|80|82|83|90|91) status=TLS_ERROR;; *) status="NETWORK_ERROR_${rc}";; esac
    printf '%s\t%s\t000\tcurl_exit=%s\n' "$name" "$status" "$rc"; return 2
  fi
  status="$(classify_http "$code")"; detail="read-only validation endpoint"
  printf '%s\t%s\t%s\t%s\n' "$name" "$status" "$code" "$detail"
  [[ "$status" == VALID || "$status" == RATE_LIMITED ]] && return 0
  [[ "$status" == INVALID ]] && return 1
  return 2
}

test_tsv() {
  local parsed map name value
  parsed="$(make_tmp)"; map="$(make_tmp)"; read_entries > "$parsed"
  awk -F '\t' '$1=="ENTRY" {v[$3]=$4} END {for (k in v) print k "\t" v[k]}' "$parsed" | sort > "$map"
  while IFS=$'\t' read -r name value; do
    if is_placeholder "$value"; then printf '%s\tNOT_CONFIGURED\t\tempty or placeholder value\n' "$name"
    elif [[ -n "${TEST_URLS[$name]:-}" ]]; then validate_one "$name" "$value" "${TEST_URLS[$name]}" || true
    else printf '%s\tUNTESTED\t\tno safe read-only validation endpoint configured\n' "$name"; fi
  done < "$map"
}

test_keys() {
  local result name status code detail rc=0
  result="$(make_tmp)"; test_tsv > "$result"
  while IFS=$'\t' read -r name status code detail; do
    printf '%-22s %-36s HTTP %s\n' "$status" "$name" "${code:--}"
    [[ "$status" == INVALID ]] && rc=1
    case "$status" in DNS_ERROR|CONNECTION_FAILED|TIMEOUT|TLS_ERROR|UNREACHABLE|NETWORK_ERROR_*|UNKNOWN|ENDPOINT_NOT_FOUND|PROVIDER_UNAVAILABLE) [[ "$rc" -eq 0 ]] && rc=2;; esac
  done < "$result"
  return "$rc"
}

csv_escape() { local v="${1//\"/\"\"}"; printf '"%s"' "$v"; }
write_report() {
  local result generated dir name status code detail
  result="$(make_tmp)"; test_tsv > "$result"; generated="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"; dir="${APIKEY_REPORT%/*}"; [[ "$dir" != "$APIKEY_REPORT" ]] && mkdir -p "$dir"
  { printf 'generated_at,name,status,http_status,detail\n'; while IFS=$'\t' read -r name status code detail; do csv_escape "$generated"; printf ','; csv_escape "$name"; printf ','; csv_escape "$status"; printf ','; csv_escape "$code"; printf ','; csv_escape "$detail"; printf '\n'; done < "$result"; } > "$APIKEY_REPORT"
  chmod 600 "$APIKEY_REPORT"; log "Report: $APIKEY_REPORT"
}

usage() {
  cat <<EOF
Usage: ${0##*/} {organize|lint|test|report|all|help}
Environment: APIKEY_FILE, APIKEY_REPORT, APIKEY_TIMEOUT, APIKEY_CONNECT_TIMEOUT
EOF
}

main() {
  require_tools
  case "$COMMAND" in
    help|-h|--help) usage ;;
    organize) ensure_file; organize ;;
    lint) ensure_file; lint ;;
    test) ensure_file; test_keys ;;
    report) ensure_file; write_report ;;
    all) ensure_file; organize; printf '\n== Lint ==\n'; lint || true; printf '\n== Validation ==\n'; test_keys || true; printf '\n== Report ==\n'; write_report ;;
    *) usage >&2; die "Unknown command: $COMMAND" ;;
  esac
}

main "$@"
