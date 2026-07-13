# Z Platform Execution Plan

## Objective

Create a clean, secure platform successor to `cvsz/zeaz-platform` without bulk-copying legacy architecture, secrets, deployment identifiers, or unsafe financial capabilities.

## Operating rules

- Preserve the legacy repository as the migration source of record.
- Every migration is independently buildable, testable, reversible, and documented.
- Provider credentials remain server-side.
- AI agents never receive wallet signing, card data, MPC shares, or production infrastructure authority.
- Infrastructure plans may be generated, but deployment requires explicit operator approval.

## Phase 1 — AI foundation

### Completed

- ZAI Coder Python runtime primitives: streaming render gate, secure MCP payload builder, model preflight.
- Gateway-backed CLI.
- Browser terminal, server-side gateway proxy, response streaming, and file upload proxy.
- AI Gateway service skeleton with service-token authentication and upstream isolation.
- AI Gateway request IDs, structured error codes, redacted audit events, and cancellation propagation.
- Generic OpenAI-compatible attachment reference translation for platform file references.
- Shared AI contracts.
- ZAI Coder web file-backed workspace metadata boundary with owner fields, retention timestamps, and uploaded-file links.
- AI Gateway attachment adapter registry with OpenAI-compatible and Anthropic message-shape translators plus unit coverage.
- AI Gateway upstream provider selection wired into chat attachment translation.
- Hugging Face free/local model catalog exposed through the AI Gateway model list endpoint.
- AI Gateway upload adapter registry with OpenAI-compatible binary/content pass-through, safe filename normalization, and unsupported-provider failure handling.
- ZAI Coder web workspace metadata adapter boundary with tenant owner enforcement and explicit retention cleanup hooks.
- ZAI Coder web scheduled workspace cleanup runner with structured cleanup output.
- ZAI Coder web production workspace metadata adapter with HTTP durable metadata service wiring.
- Repository-local test workflows for Node and Python runtimes covering gateway-only ZAI Coder paths, model catalog, provider adapters, workspace metadata, uploads, streaming, and failure paths.

### Remaining

- Verify GitHub Actions result visibility after the next workflow run is reported by GitHub.

**Done when:** ZAI Coder web and CLI use only the gateway; browser clients never receive provider secrets; tests cover chat, streaming, file upload, workspace metadata, model catalog, provider attachment adapters, and failure paths.

## Phase 2 — Agent orchestration

### Completed

- Defined `agent.job.requested.v1`, `agent.job.approved.v1`, and `agent.job.completed.v1` contracts with JSON schemas and validation tests.
- Implemented the agent orchestrator job-store, queue, approval, sandbox worker, cancellation, retry, and audit adapter boundaries with lifecycle tests.
- Added operator-approved production provider adapters for job storage, queueing, observability audit export, identity approval checks, and sandbox execution before external traffic.

### Remaining

- Verify production provider endpoints in the selected staging environment before setting `AGENT_EXTERNAL_TRAFFIC_ENABLED=true`.

**Done when:** an agent job can be submitted, approved, executed with scoped tools, cancelled, retried idempotently, and audited.

## Phase 3 — ZChat migration

1. Import only the presentation and conversation-state layers.
2. Replace direct model/provider configuration with the AI Gateway model catalog.
3. Use platform identity and tenant scopes.
4. Add shared conversation IDs and usage correlation.
5. Validate streaming, accessibility, mobile layout, and logout/session expiry.

**Done when:** ZChat works against the platform gateway and no browser configuration can contain an upstream key.

## Phase 4 — Generator and workspace migration

1. Move audited templates from ZAI Factory into `tools/zai-factory`.
2. Define template manifests, validation, and generated-file ownership.
3. Split ZOW into user-facing workspace UI and isolated execution runtime.
4. Prohibit generated deployments and shell execution without an explicit approval policy.

**Done when:** a generator produces a validated project in a sandbox with reproducible output and no secret-bearing files.

## Phase 5 — Usage and billing boundary

1. Emit immutable `ai.usage.recorded.v1` events from the AI Gateway.
2. Validate idempotency keys before creating ledger entries.
3. Implement credits, limits, and invoice intents in `services/billing-ledger`.
4. Integrate with `apps/zwallet` only through audited adapters.
5. Keep wallet signing, swaps, cards, KYC, and MPC out of the AI request path.

**Done when:** usage can be reconciled to an idempotent ledger record without access to signing authority or payment-card data.

## Phase 6 — Platform operations

1. Add CI for Node and Python lint, unit tests, dependency checks, and secret scanning.
2. Add SBOM generation and artifact provenance.
3. Define Cloudflare Access service-to-service policies.
4. Add health checks, structured logs, metrics, traces, backups, and incident runbooks.
5. Run staging readiness review before any production deployment.

**Done when:** every service has health checks, least-privilege identity, observability, rollback notes, and a passing CI gate.

## Required operator decisions

- Identity provider and tenant model.
- Queue/database/object-storage vendors and retention periods.
- Approved upstream AI providers and model policy.
- Billing currency, tax, payment processor, and jurisdiction requirements.
- Cloudflare environment, domain routing, and secret-management location.
- Production deployment approval for each environment.

## Validation gate for every pull request

1. Scope matches a single migration item.
2. No credentials or real production identifiers.
3. Unit tests and lint pass for changed runtime.
4. Input validation, authorization, timeout, and failure paths are tested.
5. Migration manifest and runbook are updated.
6. Financial, infrastructure, or destructive changes have explicit operator approval.
