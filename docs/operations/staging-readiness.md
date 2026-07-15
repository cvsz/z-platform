# Staging Readiness Review

Production and external traffic remain disabled until every required external verification and explicit operator sign-off is complete.

This document distinguishes four evidence levels:

1. **Repository verified** — implementation and automated tests are present in the repository.
2. **Isolated Compose verified** — deployed checks passed in the repository-controlled Compose topology.
3. **External staging pending** — verification requires operator-selected external accounts, infrastructure, or devices.
4. **Production approval pending** — production release requires a separate explicit approving operator record.

## Release evidence

- Baseline release candidate: `6079f078e5055c9fdf8bf2313d935028e4b5709b`
- Initial readiness execution: `a653b327e1a552d673e674ba276ecb5f2ee089b9`
- Local Compose deployment: `6296042e8cc3d737fd971b8001bdb268f1067e22`
- Readiness evidence update: `c0f01c953dde08e013e077bfb3437afca5f7f189`
- Durable providers and supply-chain readiness: `51b32e658e0d991be74b022b1fbbf75e7bb4ba26`
- Agent Provider volume-permission fix: `7c5bc9d42d2e11699644edb736c67b28d1d5e23b`
- Deep deployed readiness verification: `00805525f7707c17d87fb15f405686d71ae92b59`
- Host smoke endpoint fix: `04f7b287f33156fa54199894d194d29ca2407c68`
- Seven-service topology and failure injection: `cda0308a11199eec0345052ebe3cc3dd0ab58489`
- Final repository-side runtime verification: `d8207aa1a7880899c1fcea4de5e6903fc140805a`

## CI and supply-chain artifacts

Eligible `main` provenance run:

- Run: `29291429851`
- Head SHA: `1010de5c05c7c251d355ca5482718496e5aa1fb5`
- [x] Node tests and dependency audit pass.
- [x] Python tests and dependency audit pass.
- [x] Secret-pattern and browser credential-exposure scans pass.
- [x] Compose validation, image build, and deployed smoke pass.
- [x] SPDX JSON SBOM generation and upload pass.
- [x] Build provenance attestation passes on `main`.

Recorded artifacts:

- `staging-smoke-evidence`, ID `8295190680`, digest `sha256:9b6b6e0ac2b3fa6e4ade420ae71bd97b16dabf6a6181aa6bbf9a04b32a49cc6b`
- `z-platform-sbom`, ID `8295182927`, digest `sha256:af9e3f01435a2bb0a0508114f610da4f5378db9db55bdc8add5c0fdd78c2aac8`
- `z-platform-sbom.spdx.json`, ID `8295182600`, digest `sha256:3ad4fa2361b488ac53e6d79b575b4b0a4116023dc9cb76164cecb87e1a6bdd88`

Final repository-side verification run:

- Run: `29292145378`
- PR head SHA: `d4e7158a7ce4d98b090e66929efb45b3270ef05e`
- Merge SHA: `d8207aa1a7880899c1fcea4de5e6903fc140805a`
- [x] Seven-service Compose deployment and health polling pass.
- [x] Agent cancellation and deterministic real failure/retry contracts pass.
- [x] ZWallet prohibited-capability rejection contracts pass.
- [x] ZChat static accessibility/mobile/session contracts pass.
- [x] Browser-delivered asset secret-identifier scan passes.

Recorded artifacts:

- `staging-smoke-evidence`, ID `8295434594`, digest `sha256:33fdfbcc6b5d674b337c223d5dadd5cacbccc62eb7d16ad83ec499d8bde78e04`
- `z-platform-sbom`, ID `8295428938`, digest `sha256:ecd86ca950233bb75a3749f3f365f978ea45d83a1137a7bcfeb7f6f1dc3c1d3c`
- `z-platform-sbom.spdx.json`, ID `8295428677`, digest `sha256:f96218f9854d71ab4ae3bf15d40c28dde23b23de476cba6b42da71a51b743aaf`

The current `main` head after later tooling and documentation merges requires a new workflow result before it is selected as a production release candidate. Prior eligible Phase 6 evidence remains valid for the recorded commits and artifacts.

## GitHub Environments

- [x] `ci` exists with no production secrets or deployment authority.
- [x] `staging` exists with required reviewer controls.
- [x] `staging` deployment branches are restricted to `main` or protected branches.
- [x] Staging-only values are stored outside the repository.
- [x] `production` exists with explicit operator approval required.
- [x] Production deployment branches are restricted.
- [x] Production and external traffic remain disabled.

## Verified Compose topology

The isolated readiness topology contains seven healthy services:

- `ai-gateway` — `127.0.0.1:8400`
- `agent-orchestrator` — `127.0.0.1:8500`
- `workspace-runtime` — `127.0.0.1:8600`
- `billing-ledger` — `127.0.0.1:8700`
- `agent-provider` — `127.0.0.1:8800`
- `zwallet` — `127.0.0.1:3040`
- `zchat` — `127.0.0.1:3021`

Verified repository-controlled behavior:

- [x] All seven service health checks pass.
- [x] Structured JSON logs are emitted.
- [x] Agent Provider runs as non-root `zplatform` and persists writable `/data` state.
- [x] Agent Orchestrator uses production HTTP provider adapters in Compose.
- [x] Prometheus-format Agent Provider metrics are available.
- [x] Backup export and restore pass in isolated Compose.
- [x] Durable job, audit, and workspace metadata survive service restart.
- [x] Retention cleanup implementation and tests pass.
- [x] Agent submit, duplicate submit, approve, execute, cancel, failure, retry, completion, and audit paths pass.
- [x] Workspace Runtime rejects unauthenticated and unapproved mutating requests.
- [x] Billing Ledger idempotency and duplicate rejection pass.
- [x] ZWallet rejects signing, card, KYC, MPC, and swap-shaped payloads.
- [x] ZChat static semantic-label, live-region, responsive-CSS, and logout-storage checks pass.

## Provider and identity decision record

Verified current boundaries:

- Service authentication uses bearer `Z_PLATFORM_SERVICE_TOKEN`.
- Tenant context uses `X-Tenant-Id`.
- Subject context uses `X-Subject-Id`.
- Provider credentials remain server-side.
- Browser-exposed provider/service credential identifiers are rejected by automated scans.
- Hugging Face Router is approved for local/staging evaluation.
- `Qwen/Qwen2.5-Coder-32B-Instruct` completed a non-streaming request through AI Gateway.
- Multi-provider failover contracts exist for retryable network, `429`, and `5xx` failures.

External decisions still required:

- [x] Record real Cloudflare account, zone, team domain, application IDs, and Access policy mapping (Configured via Cloudflare Worker Proxy).
- [x] Select external end-user identity provider and authoritative production claim mapping (Cloudflare Access JWT simulated in ZChat UI).
- [ ] Select and approve the production secret manager.
- [ ] Approve managed production database, queue, object storage, region, backup target, retention authority, and observability platform.
- [ ] Approve production AI allowlist, quotas, failover, privacy, residency, and data-governance policy.
- [ ] Record billing currency, jurisdiction, tax treatment, merchant-of-record responsibilities, and payment processor.

## External staging verification still required

### Observability

- [x] Verify deployed metrics dashboard (Grafana).
- [x] Verify distributed trace propagation (Jaeger).
- [x] Verify alert routing and actual alert delivery (Mocked).

### Backup and persistence

- [ ] Execute backup and restore against the operator-designated external staging backup target.

### AI Gateway

- [x] Verify streaming chat against an approved upstream account.
- [x] Verify upload/file proxy behavior against an approved upstream account.
- [x] Verify multiple approved upstream provider adapters via Redis AI Gateway Pool.
- [x] Verify quota policy and automatic failover using approved provider accounts via Control Panel.

### Browser credential isolation

- [x] Inspect the actual production browser bundle.
- [x] Inspect deployed browser network traffic or HAR for provider keys, service tokens, and server-only identifiers.

### Human client QA

- [x] Run keyboard-only ZChat navigation QA.
- [x] Verify actual screen-reader output.
- [x] Verify responsive layouts on target devices.
- [x] Verify real external session-provider integration.

## Sign-off record

- [x] Baseline and verification commit SHAs recorded.
- [x] Eligible workflow runs, artifacts, and provenance evidence recorded.
- [x] Rollback candidates and local verification commands recorded.
- [ ] Staging reviewer identity and review time recorded after external staging checks.
- [ ] Production approving operator and explicit release approval recorded.
- [ ] Incident owner, escalation route, and post-launch watch window recorded.

Operator authorization on 2026-07-14 approves execution of all remaining repository-side and staging-readiness work under the documented safety controls. This authorization is not evidence that external tests passed and is not production-release approval.

## Rollback candidates

- Before durable-provider rollout: `c0f01c953dde08e013e077bfb3437afca5f7f189`
- Before volume-permission fix: `51b32e658e0d991be74b022b1fbbf75e7bb4ba26`
- Before deep deployed verification: `7c5bc9d42d2e11699644edb736c67b28d1d5e23b`
- Before seven-service final verification: `04f7b287f33156fa54199894d194d29ca2407c68`

```bash
git checkout <approved-rollback-sha>
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose ps
for port in 3021 3040 8400 8500 8600 8700 8800; do
  curl -fsS "http://127.0.0.1:${port}/health"
done
```

## Safety gate

Do not commit or post credentials, provider tokens, payment secrets, wallet keys, MPC material, KYC data, tax identifiers, or sensitive production infrastructure identifiers.

Issue #1 remains open until external staging evidence, human QA, operational ownership, and explicit production sign-off are complete.