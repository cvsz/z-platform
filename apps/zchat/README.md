# ZChat

ZChat is the platform chat surface migrated from `cvsz/zeaz-platform/apps/zchat`.

This version keeps the browser UI thin and routes model calls through the platform AI Gateway. Browser code must never contain upstream provider keys, direct provider base URLs, or tenant-wide service credentials.

The current shell is a conversation client rather than a single-submit form: it renders a transcript, keeps a browser-local conversation history sidebar, persists the active conversation in browser storage, supports a per-conversation system prompt, offers browser-local prompt templates, exports the active conversation as markdown or JSON, streams assistant output when the gateway supports it, and still keeps all model calls on the server side. Assistant replies support a safe markdown subset for headings, lists, quotes, code fences, inline code, and http(s) links.

## Runtime

- `GET /health` reports service status, gateway configuration, and session TTL.
- `GET /api/models` loads the AI Gateway model catalog for the browser model selector.
- `POST /api/chat` accepts `{ "prompt": "...", "model": "optional", "conversation_id": "optional", "system_prompt": "optional" }` and forwards an OpenAI-compatible request to the AI Gateway.
- `POST /api/chat/stream` forwards streaming chat requests, including the pinned system prompt, and returns server-sent events from the AI Gateway.
- `POST /api/logout` clears browser storage via `Clear-Site-Data`.
- `GET /` serves the static accessible chat shell with transcript, history sidebar, prompt templates, export controls, composer, model picker, new chat, retry, clear, and logout controls.

All model calls include tenant, conversation, request, and usage-correlation headers for platform identity and observability. Provider credentials remain server-side in the AI Gateway.

## Required environment

- `Z_PLATFORM_AI_GATEWAY_URL`: AI Gateway base URL. Both `http://gateway:8400` and `http://gateway:8400/v1` are accepted.
- `Z_PLATFORM_SERVICE_TOKEN`: service token used only by this server-side proxy.
- `ZCHAT_SESSION_TTL_SECONDS` optional. When set, requests with expired `X-Session-Started-At` are rejected.
- `HOST` optional, defaults to `127.0.0.1`.
- `PORT` optional, defaults to `3021`.

## Validation

Run `npm test` in this directory to check health, gateway-only chat forwarding, model catalog loading, streaming forwarding, tenant scoping, conversation IDs, usage correlation, session expiry, logout, browser storage persistence, conversation history navigation, pinned system prompts, prompt template persistence, export formatting, stream parsing, safe markdown rendering, and gateway URL normalization.

## Migration limits

The UI is intentionally minimal and platform-owned. Production deployments still need the selected platform identity/session provider and end-to-end accessibility/mobile QA in the deployed environment.
