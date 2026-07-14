#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
workdir="$(mktemp -d)"
trap 'rm -rf -- "$workdir"' EXIT

cat > "$workdir/.apikey" <<'EOF'
# comment
ZETA_SERVICE_KEY='zeta-value'
ALPHA_SERVICE_KEY="alpha-value"
MIXED_SERVICE_KEY='"mixed-value"'
IGNORED_TOKEN="not-a-key"
DUPLICATE_SERVICE_KEY="old-value"
DUPLICATE_SERVICE_KEY='new-value'
EOF

APIKEY_FILE="$workdir/.apikey" "$repo_root/scripts/normalize-apikey.sh"

cat > "$workdir/expected" <<'EOF'
ALPHA_SERVICE_KEY="alpha-value"
DUPLICATE_SERVICE_KEY="new-value"
MIXED_SERVICE_KEY="mixed-value"
ZETA_SERVICE_KEY="zeta-value"
EOF

diff -u "$workdir/expected" "$workdir/.apikey"
[[ "$(stat -c '%a' "$workdir/.apikey")" == "600" ]]
compgen -G "$workdir/.apikey.backup.*" >/dev/null

printf 'normalize-apikey tests passed\n'
