# AI Gateway

The AI Gateway is the only service boundary for upstream model-provider credentials. Browser clients and IDE clients must never receive provider API keys.

## Anthropic Messages API

`POST /v1/messages` is service-token authenticated and **disabled by default**.

Required operator-controlled settings:

- `ANTHROPIC_MESSAGES_ENABLED=true` — leave unset/false until staging verification, provider quota/budget controls, usage accounting, and explicit operator approval are recorded.
- `ANTHROPIC_ALLOWED_MODELS_JSON` — required non-empty JSON array of exact approved model IDs; missing, malformed, duplicate, or non-matching model configuration fails closed before provider key lookup.
- `AI_PROVIDER_KEYS_JSON` — server-side provider key seed; never commit or expose it.
- `Z_PLATFORM_SERVICE_TOKEN` — service-to-service bearer token.
- `ANTHROPIC_UPSTREAM_BASE_URL` — optional HTTPS base URL; defaults to `https://api.anthropic.com/v1`. URL credentials, query strings, fragments, and non-HTTPS schemes are rejected.
- `ANTHROPIC_VERSION` — optional date-formatted API version; defaults to `2023-06-01`.
- `ANTHROPIC_BETA` — optional bounded beta header value.

The route validates `model`, `max_tokens` (hard-capped at 32,768 per request), `messages`, and `stream`; requires an exact model allowlist; does not retry provider POST requests; applies a 120-second upstream timeout; aborts on client disconnect; quarantines rate-limited/invalid keys without logging their values; and returns generic provider errors. It forwards only a validated `request-id` response header. Responses use `Cache-Control: no-store`; streaming is proxied through the gateway.

The feature gate must remain off until an operator has verified provider/model allowlists, spend quotas, request-size policy, usage accounting, observability redaction, staging behavior, and rollback. This code change does not authorize production traffic or provider spend.

## Tests

Run `npm test --prefix services/ai-gateway`. The Anthropic contract tests use synthetic provider keys and a stubbed HTTPS upstream; they do not contact Anthropic or incur provider spend.
