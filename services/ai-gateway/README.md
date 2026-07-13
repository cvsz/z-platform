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
- `GET /v1/models` returns the curated Hugging Face free/local model catalog in an OpenAI-compatible list shape.
- `POST /v1/chat/completions` forwards chat requests to the configured upstream and translates platform attachments through the configured provider adapter.
- `POST /v1/files` forwards file uploads and preserves the `X-Filename` header.

All non-health routes require `Authorization: Bearer <Z_PLATFORM_SERVICE_TOKEN>`.

Every response includes `X-Request-Id`. Clients may provide `X-Request-Id`; otherwise the gateway generates one. Error responses are structured as `{ "error": "...", "code": "...", "request_id": "..." }`.

Client disconnects and upstream aborts are treated as cancellations. The gateway propagates cancellation to the upstream request and records a redacted `request_cancelled` audit event.

## Hugging Face model catalog

The bundled catalog exposes open-license Hugging Face model IDs with the `hf:` prefix, for example `hf:Qwen/Qwen2.5-7B-Instruct`, `hf:openai/gpt-oss-20b`, and `hf:microsoft/Phi-3-small-8k-instruct`.

Catalog entries are metadata only. They do not deploy infrastructure or grant free hosted inference by themselves. Operators must point `UPSTREAM_BASE_URL` at an approved local runtime, self-hosted Text Generation Inference/vLLM server, Ollama/llama.cpp-compatible service, or Hugging Face endpoint.

## Attachment translation

Chat clients may send platform attachment references as `attachments: [{ "id": "...", "name": "..." }]`. The gateway validates the references, removes the client-facing `attachments` field before upstream forwarding, and stores the references in `metadata.z_platform.attachments`.

`UPSTREAM_PROVIDER` selects the attachment message-shape adapter. Supported values are `openai-compatible`, `openai`, and `anthropic`. OpenAI-compatible providers receive a textual file-reference context on the final user message. Anthropic-style providers receive an appended user content block.

Provider-specific binary/content upload adapters remain explicit follow-up work for each approved upstream provider.

## Required environment

- `Z_PLATFORM_SERVICE_TOKEN`: internal service token accepted from platform clients.
- `UPSTREAM_BASE_URL`: upstream provider base URL. Both `http://provider` and `http://provider/v1` are accepted.
- `UPSTREAM_API_KEY`: upstream provider credential held only by the gateway.
- `UPSTREAM_PROVIDER` optional, defaults to `openai-compatible`.
- `HOST` optional, defaults to `127.0.0.1`.
- `PORT` optional, defaults to `8400`.

## Validation

Run `npm test` in this directory to check health, service-token authorization, Hugging Face model catalog responses, request IDs, structured errors, audit events, attachment reference translation, upstream provider selection, upstream URL normalization, provider credential forwarding, file upload headers, upstream failure handling, and cancellation propagation.

## Prohibited responsibilities

- Storing browser-provided provider credentials.
- Wallet signing or payment-card processing.
- Executing arbitrary agent tools without an approved job policy.
