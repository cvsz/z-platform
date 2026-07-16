#!/usr/bin/env bash
set -Eeuo pipefail

REPO="${REPO:-cvsz/z-platform}"
GITHUB_API_VERSION="${GITHUB_API_VERSION:-2026-03-10}"
PREVENT_SELF_REVIEW="${PREVENT_SELF_REVIEW:-true}"
STAGING_BRANCH_POLICY="${STAGING_BRANCH_POLICY:-protected}"
STAGING_BRANCH_NAME="${STAGING_BRANCH_NAME:-main}"
PRODUCTION_BRANCH_POLICY="${PRODUCTION_BRANCH_POLICY:-main}"
PRODUCTION_BRANCH_NAME="${PRODUCTION_BRANCH_NAME:-main}"

usage() {
  cat <<'EOF'
Usage:
  scripts/configure-github-environments.sh \
    --staging-reviewer user:LOGIN|team:SLUG \
    [--staging-reviewer ...] \
    --production-reviewer user:LOGIN|team:SLUG \
    [--production-reviewer ...]

Environment variables:
  REPO                    Repository in OWNER/REPO form. Default: cvsz/z-platform
  GITHUB_API_VERSION      GitHub API version header. Default: 2026-03-10
  PREVENT_SELF_REVIEW     true or false. Default: true
  STAGING_BRANCH_POLICY   protected or main-only. Default: protected
  STAGING_BRANCH_NAME     Deployment branch name when using main-only. Default: main
  PRODUCTION_BRANCH_POLICY protected or main-only. Default: main
  PRODUCTION_BRANCH_NAME  Deployment branch name when using main-only. Default: main

Selectors:
  user:LOGIN              Resolve a GitHub user by login and use that user ID.
  team:SLUG               Resolve a GitHub team slug in the repository owner org.

The script only configures environment protection rules. It does not set secrets.
EOF
}

die() {
  echo "error: $*" >&2
  exit 2
}

require_gh() {
  command -v gh >/dev/null || die "GitHub CLI (gh) is required"
  gh auth status >/dev/null
}

require_jq() {
  command -v jq >/dev/null || die "jq is required"
}

json_escape() {
  jq -Rn --arg v "$1" '$v'
}

resolve_reviewer() {
  local selector="$1"
  local kind="${selector%%:*}"
  local value="${selector#*:}"
  [[ "$selector" == *:* ]] || die "reviewer selector must be user:LOGIN or team:SLUG: $selector"
  [[ -n "$value" ]] || die "reviewer selector is missing a value: $selector"

  case "$kind" in
    user)
      gh api "users/$value" --jq '.id'
      ;;
    team)
      local owner="${REPO%%/*}"
      gh api "orgs/$owner/teams/$value" --jq '.id'
      ;;
    *)
      die "unknown reviewer selector type: $kind"
      ;;
  esac
}

branch_policy_json() {
  local mode="$1"
  case "$mode" in
    protected)
      printf '{"protected_branches":true,"custom_branch_policies":false}'
      ;;
    main|main-only)
      printf '{"protected_branches":false,"custom_branch_policies":true}'
      ;;
    *)
      die "branch policy must be protected or main-only: $mode"
      ;;
  esac
}

set_environment_payload() {
  local environment_name="$1"
  local branch_policy_mode="$2"
  local branch_policy_name="$3"

  local reviewers_json="[]"
  shift 3
  if (($# > 0)); then
    local reviewer_ids=()
    local selector reviewer_id
    for selector in "$@"; do
      reviewer_id="$(resolve_reviewer "$selector")"
      reviewer_ids+=("{\"type\":\"${selector%%:*}\",\"id\":${reviewer_id}}")
    done
    reviewers_json="[$(IFS=,; echo "${reviewer_ids[*]}")]"
  fi

  local branch_policy_json_value
  branch_policy_json_value="$(branch_policy_json "$branch_policy_mode")"

  local payload
  payload="$(jq -n \
    --argjson wait_timer 0 \
    --argjson prevent_self_review "$PREVENT_SELF_REVIEW" \
    --argjson reviewers "$reviewers_json" \
    --argjson deployment_branch_policy "$branch_policy_json_value" \
    '{wait_timer:$wait_timer,prevent_self_review:$prevent_self_review,reviewers:$reviewers,deployment_branch_policy:$deployment_branch_policy}')"

  gh api \
    -X PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: ${GITHUB_API_VERSION}" \
    "repos/${REPO}/environments/${environment_name}" \
    --input <(printf '%s' "$payload") >/dev/null
  echo "configured environment: $environment_name"

  if [[ "$branch_policy_mode" == main || "$branch_policy_mode" == main-only ]]; then
    gh api "repos/${REPO}/environments/${environment_name}/deployment-branch-policies" --jq '.branch_policies[].id' |
      while IFS= read -r policy_id; do
        [[ -n "$policy_id" ]] || continue
        gh api -X DELETE "repos/${REPO}/environments/${environment_name}/deployment-branch-policies/${policy_id}" >/dev/null
      done

    gh api \
      -X POST \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: ${GITHUB_API_VERSION}" \
      "repos/${REPO}/environments/${environment_name}/deployment-branch-policies" \
      -f name="$branch_policy_name" >/dev/null
    echo "configured branch policy: ${environment_name} -> ${branch_policy_name}"
  fi
}

main() {
  local staging_reviewers=()
  local production_reviewers=()
  while (($# > 0)); do
    case "$1" in
      --staging-reviewer)
        [[ $# -ge 2 ]] || die "--staging-reviewer requires a selector"
        staging_reviewers+=("$2")
        shift 2
        ;;
      --production-reviewer)
        [[ $# -ge 2 ]] || die "--production-reviewer requires a selector"
        production_reviewers+=("$2")
        shift 2
        ;;
      -h|--help)
        usage
        return 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
  done

  require_gh
  require_jq

  gh api -X PUT -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: ${GITHUB_API_VERSION}" "repos/${REPO}/environments/ci" \
    --input <(printf '%s' '{"wait_timer":0,"prevent_self_review":false,"reviewers":[],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":false}}') >/dev/null
  echo "configured environment: ci"

  (( ${#staging_reviewers[@]} > 0 )) || die "at least one staging reviewer must be supplied"
  set_environment_payload "staging" "$STAGING_BRANCH_POLICY" "$STAGING_BRANCH_NAME" "${staging_reviewers[@]}"

  (( ${#production_reviewers[@]} > 0 )) || die "at least one production reviewer must be supplied"
  set_environment_payload "production" "$PRODUCTION_BRANCH_POLICY" "$PRODUCTION_BRANCH_NAME" "${production_reviewers[@]}"

  cat <<EOF
Done.
  Repo: ${REPO}
  Staging branch policy: ${STAGING_BRANCH_POLICY}
  Staging branch name: ${STAGING_BRANCH_NAME}
  Production branch policy: ${PRODUCTION_BRANCH_POLICY}
  Production branch name: ${PRODUCTION_BRANCH_NAME}
  Prevent self review: ${PREVENT_SELF_REVIEW}
EOF
}

main "$@"
