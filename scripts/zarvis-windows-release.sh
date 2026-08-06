#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-0.1.$(date +%Y%m%d%H%M)}"
WORKFLOW="zarvis-windows.yml"
REPOSITORY="${ZARVIS_GITHUB_REPOSITORY:-cvsz/z-platform}"

log() { printf '[ZARVIS-WINDOWS] %s\n' "$*"; }
die() { printf '[ZARVIS-WINDOWS][ERROR] %s\n' "$*" >&2; exit 1; }

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]] ||
  die "Version must be SemVer-like, for example 0.1.0"

command -v git >/dev/null 2>&1 || die "git is required"
command -v gh >/dev/null 2>&1 || die "GitHub CLI is required"
gh auth status >/dev/null 2>&1 || die "GitHub CLI is not authenticated"

cd "$ROOT_DIR"
[[ -z "$(git status --porcelain)" ]] || die "Repository has uncommitted changes"
git fetch origin --prune --tags
git switch main
git pull --ff-only origin main

log "Dispatching private Windows build $VERSION"
gh workflow run "$WORKFLOW" \
  --repo "$REPOSITORY" \
  --ref main \
  -f version="$VERSION" \
  -f publish_release=true

sleep 3
run_id="$(
  gh run list \
    --repo "$REPOSITORY" \
    --workflow "$WORKFLOW" \
    --branch main \
    --event workflow_dispatch \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId'
)"
[[ -n "$run_id" && "$run_id" != null ]] || die "Could not resolve workflow run"

log "Watching workflow run $run_id"
gh run watch "$run_id" --repo "$REPOSITORY" --exit-status

tag="zarvis-windows-v${VERSION}"
gh release view "$tag" --repo "$REPOSITORY" >/dev/null
log "Private release ready: $tag"
printf '\nWindows install:\n'
printf '  gh release download %q --repo %q --pattern %q\n' \
  "$tag" "$REPOSITORY" 'ZARVIS-Setup-*-win-x64.exe'
