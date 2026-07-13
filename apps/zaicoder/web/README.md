# ZAI Coder Web

This package is the browser-facing ZAI Coder shell. It must route all AI requests through the platform AI Gateway and must never expose upstream provider credentials to browser code.

## Runtime

- `POST /api/chat` forwards non-streaming chat requests to the AI Gateway.
- `POST /api/chat/stream` forwards streaming chat requests and returns server-sent events.
- `POST /api/files` forwards file uploads to the AI Gateway. When `X-Workspace-Id` is present, the uploaded platform file reference is linked into that workspace metadata record.
- `POST /api/workspaces` creates or updates local workspace metadata with `workspace_id`, `owner`, and `retention_days`.
- `GET /api/workspaces/:id` returns the stored workspace metadata or `404` when it does not exist.
- Static browser assets are served from `public/`.

## Required environment

- `Z_PLATFORM_AI_GATEWAY_URL`: AI Gateway base URL. Both `http://gateway:8400` and `http://gateway:8400/v1` are accepted.
- `Z_PLATFORM_SERVICE_TOKEN`: service token used only by the server-side proxy.
- `ZAICODER_WORKSPACE_STORE` optional, defaults to `.zaicoder-workspaces`.
- `HOST` optional, defaults to `127.0.0.1`.
- `PORT` optional, defaults to `3010`.

## Workspace metadata

Workspace metadata is stored as file-backed JSON for the Phase 1 boundary. The store validates workspace IDs, records an owner field, clamps retention to a maximum of 365 days, stores `created_at`, `updated_at`, and `expires_at`, and tracks uploaded file references with `added_at` timestamps.

Example create/update request:

```json
{
  "workspace_id": "demo-workspace",
  "owner": "tenant-1",
  "retention_days": 30
}
```

## Validation

Run `npm test` in this directory to check chat validation, gateway URL normalization, streaming forwarding, file upload forwarding, workspace metadata persistence, retention validation, and invalid input handling.

## Current limits

File uploads currently return platform file references and can be linked to local workspace metadata. Provider-specific attachment translation, production durable workspace storage, tenant identity enforcement, and retention cleanup jobs remain Phase 1 follow-up work.
