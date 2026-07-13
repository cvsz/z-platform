# ZAI Coder Web

This package is the browser-facing ZAI Coder shell. It must route all AI requests through the platform AI Gateway and must never expose upstream provider credentials to browser code.

## Runtime

- `POST /api/chat` forwards non-streaming chat requests to the AI Gateway.
- `POST /api/chat/stream` forwards streaming chat requests and returns server-sent events.
- `POST /api/files` forwards file uploads to the AI Gateway.
- Static browser assets are served from `public/`.

## Required environment

- `Z_PLATFORM_AI_GATEWAY_URL`: AI Gateway base URL. Both `http://gateway:8400` and `http://gateway:8400/v1` are accepted.
- `Z_PLATFORM_SERVICE_TOKEN`: service token used only by the server-side proxy.
- `HOST` optional, defaults to `127.0.0.1`.
- `PORT` optional, defaults to `3010`.

## Validation

Run `npm test` in this directory to check chat validation, gateway URL normalization, streaming forwarding, file upload forwarding, and invalid input handling.

## Current limits

File uploads currently return platform file references only. Provider-specific attachment translation, workspace ownership, retention policy, and persistent project metadata remain Phase 1 follow-up work.
