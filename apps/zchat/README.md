# ZChat

ZChat is the platform chat surface migrated from `cvsz/zeaz-platform/apps/zchat`.

This version keeps the browser UI thin and routes model calls through the platform AI Gateway. Browser code must never contain upstream provider keys, direct provider base URLs, or tenant-wide service credentials.

## Runtime

- `GET /health` reports service status and whether the gateway is configured.
- `POST /api/chat` accepts `{ "prompt": "...", "model": "optional" }` and forwards an OpenAI-compatible request to the AI Gateway.
- `GET /` serves the static chat shell.

## Required environment

- `Z_PLATFORM_AI_GATEWAY_URL`
- `Z_PLATFORM_SERVICE_TOKEN`
- `HOST` optional, defaults to `127.0.0.1`
- `PORT` optional, defaults to `3021`

## Migration limits

The current boundary does not yet include platform identity, conversation persistence, streaming, usage correlation, or logout/session-expiry handling. Those items remain in Phase 3 of the migration plan.
