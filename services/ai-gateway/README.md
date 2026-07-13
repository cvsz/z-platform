# AI Gateway

The AI Gateway is the only platform service allowed to hold upstream model-provider credentials.

## Responsibilities

- Validate client identity, tenant scope and model entitlement.
- Route approved requests to local or cloud model providers.
- Enforce quotas, rate limits and tool policy.
- Emit redacted audit and usage events.
- Stream compatible responses to ZAI Coder, ZChat and IDE clients.

## Runtime

- `GET /health` reports service status and upstream configuration without exposing secrets.
- `POST /v1/chat/completions` forwards OpenAI-compatible chat requests to the configured upstream.
- `POST /v1/files` forwards file uploads and preserves the `X-Filename` header.

All non-health routes require `Authorization: Bearer <Z_PLATFORM_SERVICE_TOKEN>`.

Every response includes `X-Request-Id`. Clients may provide `X-Request-Id`; otherwise the gateway generates one. Error responses are structured as `{ "error": "...", "code": "...", "request_id": "..." }`.

## Required environment

- `Z_PLATFORM_SERVICE_TOKEN`: internal service token accepted from platform clients.
- `UPSTREAM_BASE_URL`: upstream provider base URL. Both `http://provider` and `http://provider/v1` are accepted.
- `UPSTREAM_API_KEY`: upstream provider credential held only by the gateway.
- `HOST` optional, defaults to `127.0.0.1`.
- `PORT` optional, defaults to `8400`.

## Validation

Run `npm test` in this directory to check health, service-token authorization, request IDs, structured errors, audit events, upstream URL normalization, provider credential forwarding, file upload headers, and upstream failure handling.

## Prohibited responsibilities

- Storing browser-provided provider credentials.
- Wallet signing or payment-card processing.
- Executing arbitrary agent tools without an approved job policy.
