# Staging Readiness Review

Production deployment is blocked until every item is checked and signed off by the operator.

## CI and artifacts

- [ ] CI tests pass.
- [ ] Secret scanning passes.
- [ ] Dependency check passes.
- [ ] SBOM artifact generated.
- [ ] Provenance verification passes.
- [ ] GitHub Actions result and artifact URLs are recorded for the release commit.

## GitHub Environments

- [ ] `ci` environment exists and contains no production secrets.
- [ ] `staging` environment exists with required reviewers.
- [ ] `staging` deployment branches are restricted to `main` or protected branches.
- [ ] `staging` environment secrets are staging-only and are not committed to the repository.
- [ ] `production` environment exists with operator approval required.
- [ ] `production` deployment branches are restricted to `main` or the operator-approved release branch.
- [x] Production traffic remains disabled until this checklist is signed off.

## Provider and identity decision record

- Identity provider: no external end-user identity provider has been selected. Local service-to-service calls use `Z_PLATFORM_SERVICE_TOKEN` bearer authentication.
- Tenant model: tenant and subject context are supplied using `X-Tenant-Id` and `X-Subject-Id`; authoritative claim mapping remains pending.
- Cloudflare: account, zone, team domain, Access applications, and policy mapping remain unconfigured and must not be inferred.
- Secret management: local execution uses an uncommitted `.env`; GitHub Environment secrets are the repository-level staging mechanism. A production secret manager remains unselected.
- Data providers: Agent Orchestrator currently uses in-memory job store, queue, and audit adapters. No durable production database, queue, or object store has been approved.
- Sandbox: Workspace Runtime is deployed locally with approval-gated shell/deploy boundaries. The Agent Orchestrator production `/execute` sandbox provider contract is not yet implemented.
- Observability: structured JSON service logs are available through Docker Compose. Metrics, traces, dashboards, and alerts remain unconfigured.
- Backup and retention: no durable local state is used by the current Compose baseline; production backup, restore, retention, and deletion policy remain undecided.
- AI provider: Hugging Face Router is verified for local/staging testing through the OpenAI-compatible API. `Qwen/Qwen2.5-Coder-32B-Instruct` completed a successful non-streaming request. Production provider approval, allowlist, quotas, failover, and data-governance policy remain pending.
- Billing: Billing Ledger is non-wallet and non-card-authoritative. Currency, legal entity/jurisdiction, tax rules, invoicing policy, and payment processor remain undecided.

## Identity and access

- [ ] Cloudflare Access policies mapped.
- [ ] Service tokens stored in approved production secret manager.
- [ ] Tenant claim mapping verified.
- [ ] Browser cannot access service credentials.
- [ ] GitHub App installation token handling accepts both stateful opaque and stateless JWT-format `ghs_` tokens.

## Service readiness

- [x] Health endpoints respond for every service in the local Compose deployment.
- [x] Structured JSON logs are visible for the local Compose deployment.
- [ ] Metrics dashboards exist.
- [ ] Trace propagation verified.
- [ ] Backups configured and restore tested.
- [ ] Staging smoke tests cover gateway chat, streaming, file upload, workspace metadata, model catalog, provider adapters, agent lifecycle, workspace runtime approvals, billing ledger, and ZWallet denial paths.

### Local Compose evidence — 2026-07-14

Healthy services and loopback bindings:

- AI Gateway: `127.0.0.1:8400`, `/health` returned `status=ok`, `upstream_configured=true`.
- Agent Orchestrator: `127.0.0.1:8500`, `/health` returned `storage=memory`, `execution_enabled=true`, `external_traffic_enabled=false`.
- Workspace Runtime: `127.0.0.1:8600`, `/health` returned `sandbox=approval-gated`.
- Billing Ledger: `127.0.0.1:8700`, `/health` returned `wallet_authority=false`, `card_data=false`.

AI Gateway verification:

- Authenticated model catalog request succeeded.
- Direct Hugging Face Router model discovery succeeded.
- Non-streaming chat using `Qwen/Qwen2.5-Coder-32B-Instruct` returned `Z Platform gateway OK`.
- Gateway emitted `proxy_success` with request ID `79a7ce8b-4d50-4ba9-972d-a5d219293b72` and status `200`.
- Streaming, upload, multi-provider adapter behavior, quota failover, and Billing Ledger persistence remain unverified.
- A separate `openai/gpt-oss-20b` request reached the provider but later received HTTP `402` after included provider credits were depleted; this is an external quota condition, not a gateway health failure.

## Safety boundaries

- [ ] AI Gateway is verified as the only holder of provider credentials across deployed browser clients.
- [x] Billing Ledger reports no wallet/card authority in the local deployment.
- [ ] Workspace Runtime denial behavior for shell/deploy without approval is tested.
- [ ] Agent Orchestrator blocks unapproved mutating tools in deployed lifecycle tests.
- [ ] ZWallet adapter rejects signing, card, KYC, MPC, and swap payloads.

## Sign-off record

- [x] Release commit SHA recorded.
- [ ] Workflow run result recorded.
- [ ] Staging reviewer recorded.
- [ ] Production approving operator recorded.
- [ ] Rollback SHA and verification commands recorded.
- [ ] Incident owner and post-launch watch window recorded.

## Execution record

- Execution authorized by repository operator through GitHub Issue #1.
- Baseline release candidate: `6079f078e5055c9fdf8bf2313d935028e4b5709b`.
- Local Compose deployment merged in commit `6296042e8cc3d737fd971b8001bdb268f1067e22`.
- Readiness execution started on 2026-07-14.
- Production/external traffic remains disabled.
- No credentials, provider tokens, payment secrets, wallet keys, or production identifiers are recorded in this document.
- CI result visibility, external identity/Cloudflare configuration, durable providers, backup restore, full smoke tests, and production approval remain blocked pending verifiable evidence.
