# Z Platform Execution Plan

## Objective

Create a clean, secure platform successor to `https://github.com/cvsz/z-platform` without bulk-copying legacy architecture, secrets, deployment identifiers, or unsafe financial capabilities.

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

### Completed

- Imported only the thin presentation and conversation-state layers into the platform-owned ZChat shell.
- Replaced direct model/provider configuration with the AI Gateway model catalog.
- Added tenant scope headers, shared conversation IDs, request IDs, and usage correlation.
- Added streaming proxy support, logout/session-expiry handling, and accessible responsive UI structure with test coverage.

### Remaining

- Run deployed-environment accessibility, mobile layout, and session-provider QA after the operator selects the platform identity provider.

**Done when:** ZChat works against the platform gateway and no browser configuration can contain an upstream key.

## Phase 4 — Generator and workspace migration

### Completed

- Moved audited generator/template boundaries into `tools/zai-factory` with a safe node-service template.
- Defined template manifests, validation, and generated-file ownership checks.
- Split ZOW into a user-facing workspace UI/proxy and isolated `services/workspace-runtime` execution boundary.
- Prohibited generated deployments and shell execution unless an explicit approval policy grants `deploy` or `shell`.

### Remaining

- Run operator review of additional legacy templates before adding them to `tools/zai-factory/templates`.

**Done when:** a generator produces a validated project in a sandbox with reproducible output and no secret-bearing files.

## Phase 5 — Usage and billing boundary

### Completed

- Added immutable `ai.usage.recorded.v1` usage contract and server-side AI Gateway emission.
- Added idempotent usage recording before ledger entries are accepted.
- Implemented credits and invoice intents in `services/billing-ledger`.
- Integrated `apps/zwallet` only through audited billing-ledger adapters.
- Blocked wallet signing, swaps, cards, KYC, MPC shares, and payment-provider credentials from the AI request path and ZWallet adapter boundary.

### Remaining

- Operator selection of billing currency, tax rules, payment processor, and jurisdiction before production payment collection.

**Done when:** usage can be reconciled to an idempotent ledger record without access to signing authority or payment-card data.

## Phase 6 — Platform operations

### Completed

- Added CI coverage for migrated Node and Python runtimes, dependency policy checks, secret scanning, and service-specific test gates.
- Added SBOM generation and provenance verification workflow artifacts.
- Defined Cloudflare Access service-to-service policy requirements.
- Added health, structured logging, metrics, trace, backup, restore, and incident runbooks.
- Added staging readiness review checklist before any production deployment.

### Remaining

- Operator must execute staging readiness review against the selected Cloudflare, identity, secret-management, observability, backup, and deployment environments.

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
