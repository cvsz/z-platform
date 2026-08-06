#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.zarvis.local"
COMPOSE_FILE="${ROOT_DIR}/compose.zarvis-local.yml"

command -v docker >/dev/null 2>&1 || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose plugin is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "compose.zarvis-local.yml uses host networking and requires Linux/Ubuntu." >&2
  echo "On Windows/macOS, run the Node service directly as documented in services/zarvis-action-gateway/README.md." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  umask 077
  cat >"${ENV_FILE}" <<EOF
ZARVIS_ACTION_PORT=8098
ZARVIS_ACTION_WORKER_INTERVAL_MS=1000
ZARVIS_LOCAL_OWNER_TOKEN=$(openssl rand -hex 32)
ZARVIS_ACTION_WORKER_TOKEN=$(openssl rand -hex 32)
EOF
  chmod 600 "${ENV_FILE}"
  echo "Created ${ENV_FILE} with independent local secrets."
else
  chmod 600 "${ENV_FILE}"
  echo "Using existing ${ENV_FILE}."
fi

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

for _ in $(seq 1 30); do
  if curl --fail --silent "http://127.0.0.1:8098/healthz" >/dev/null; then
    echo "Z.A.R.V.I.S. Local Action Console is ready: http://127.0.0.1:8098"
    echo "Enter ZARVIS_LOCAL_OWNER_TOKEN from .env.zarvis.local in the unlock field."
    exit 0
  fi
  sleep 1
done

echo "Local action gateway did not become healthy." >&2
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" logs --no-color
exit 1
