# Staging Readiness Review

Production and external traffic remain **DISABLED**. Issue #1 remains open until external staging evidence and explicit operator approval are recorded for the same immutable release SHA.

## Status definitions

- **VERIFIED** - backed by repository, CI, artifact, or isolated deployed evidence.
- **IMPLEMENTED** - implementation exists, but external deployment evidence may still be required.
- **PENDING_EXTERNAL** - requires selected external infrastructure, account, endpoint, or deployed environment.
- **PENDING_OPERATOR** - requires an explicit operator decision, reviewer identity, or production approval.
- **BLOCKED** - cannot be completed until the named dependency is supplied.
- **DISABLED** - intentionally disabled by the safety gate.

## Current-head evidence

Current `main` SHA: `2db36e428fa95457e0559dabc224b7d8ff10d289` (2026-07-15).

| Claim | Status | Evidence | Limitations |
|---|---|---|---|
| Node and Python tests and dependency audits | VERIFIED | `CI` run `29425990792`, success, 2026-07-15, GitHub Actions | Repository-local CI evidence only. |
| Secret and browser credential scans | VERIFIED | `validate` run `29425992713`, `secret-patterns` job `87388407955`, success, 2026-07-15 | Pattern checks do not supersede CodeQL or Dependabot findings. |
| Compose configuration and image builds | VERIFIED | `validate` run `29425992713`, `compose` job `87388408351`, success, 2026-07-15 | Build success is not external staging evidence. |
| SPDX SBOM | VERIFIED | `validate` run `29425992713`; `z-platform-sbom` ID `8347268150`, digest `sha256:aa9cca3bfb86be6f368019d1ce7b4d5930b5d4596d03d716c48e6ddb03d02c29`; `z-platform-sbom.spdx.json` ID `8347267792`, digest `sha256:e98b7e6284dc6458db6ae4b0db89acd57208eaa04c19c7cd5d9a21d578354bbf` | Artifacts are bound only to `2db36e4`. |
| Dependency and provenance policy | VERIFIED | `operations` run `29425992683`, success; `sbom-spdx-json` ID `8347266561`, digest `sha256:2ccbea7d556d8c5d1de538db418697db453f16d35ebacc8fbb32de7c1f5a11a6`, 2026-07-15 | Valid only for `2db36e4`. |
| Seven-service deployed smoke | VERIFIED | `validate` run `29425992713`, job `87388407954`, success; `staging-smoke-evidence` ID `8347285839`, digest `sha256:6d51c96fdd373274d428217f8e8860b32ebecda442414474c35c92ca5b612ef6` | Isolated Compose evidence only; not external staging. |
| Main security-alert state | BLOCKED | CodeQL alerts 1-5 and Dependabot alert 1 are open against `main`, inspected 2026-07-15 | Passing workflows do not make unresolved findings eligible for release. |
| Security-alert remediation | IMPLEMENTED | Path containment, rate limiting, default-deny CORS, command-argument omission, and PostCSS override plus deterministic local tests on this branch | PR-head CodeQL, dependency audit, validation, and immutable artifacts are still required before VERIFIED. |

## CodeQL Advanced z-runner slice

| Claim | Status | Evidence | Limitations |
|---|---|---|---|
| Workflow and runner update | IMPLEMENTED | `CodeQL Advanced` now runs on the self-hosted `z-runner` lane and loads `.github/codeql/codeql-config.yml`, which adds the `security-and-quality` query suite; `scripts/test/codeql-workflow.test.mjs` checks the workflow shape | PR-head CodeQL execution on the exact SHA and alert-closure evidence on the self-hosted runner remain **PENDING_EXTERNAL**. |

Prior evidence remains valid only for its recorded immutable SHAs. It must not be assigned to this branch or a later release candidate.

## Prior immutable evidence

| Evidence | Status | Release SHA | Command or workflow | Artifact | Environment | Limitation |
|---|---|---|---|---|---|---|
| Eligible main provenance run | VERIFIED | `1010de5c05c7c251d355ca5482718496e5aa1fb5` | `validate` run `29291429851` | `staging-smoke-evidence` ID `8295190680`, digest `sha256:9b6b6e0ac2b3fa6e4ade420ae71bd97b16dabf6a6181aa6bbf9a04b32a49cc6b`; SBOM IDs `8295182927`, `8295182600` | GitHub Actions / isolated Compose | Not evidence for later commits. |
| Final repository runtime verification | VERIFIED | PR head `d4e7158a7ce4d98b090e66929efb45b3270ef05e`; merge `d8207aa1a7880899c1fcea4de5e6903fc140805a` | `validate` run `29292145378` | `staging-smoke-evidence` ID `8295434594`, digest `sha256:33fdfbcc6b5d674b337c223d5dadd5cacbccc62eb7d16ad83ec499d8bde78e04` | GitHub Actions / isolated Compose | Not evidence for later commits. |

## Repository and isolated Compose baseline

- **VERIFIED** - Seven-service topology: `ai-gateway`, `agent-orchestrator`, `workspace-runtime`, `billing-ledger`, `agent-provider`, `zwallet`, and `zchat`.
- **VERIFIED** - Health checks, structured logs, Agent Provider metrics, non-root durable provider storage, backup/restore, and restart persistence for their recorded immutable evidence commits.
- **VERIFIED** - Agent submit, duplicate submit, approval, execution, cancellation, deterministic failure, retry, completion, and audit paths for their recorded immutable evidence commits.
- **VERIFIED** - Workspace Runtime authentication and approval denials, Billing Ledger idempotency, ZWallet prohibited-capability rejection, and ZChat static accessibility/mobile/session checks for their recorded immutable evidence commits.
- **IMPLEMENTED** - AI Gateway streaming, upload, and multi-provider/failover harnesses exist; approved external-account execution evidence is still required.

## PENDING_EXTERNAL

- **PENDING_EXTERNAL** - Real Cloudflare account, zone, team domain, application, and Access policy mapping.
- **PENDING_EXTERNAL** - Operator-designated external backup target and successful isolated restore evidence.
- **PENDING_EXTERNAL** - Deployed metrics dashboard, distributed traces, alert routing, and delivered-alert evidence.
- **PENDING_EXTERNAL** - Streaming, upload/file proxy, multi-provider, and quota/failover verification through approved upstream accounts.
- **PENDING_EXTERNAL** - Actual deployed browser bundle and HAR/network credential-isolation evidence.
- **PENDING_EXTERNAL** - Human keyboard, screen-reader, target-device responsive, and external session-provider QA evidence.
- **PENDING_EXTERNAL** - Managed production data services and selected staging endpoints.

## PENDING_OPERATOR

- **PENDING_OPERATOR** - Authoritative external identity provider and production claim mapping.
- **PENDING_OPERATOR** - Production secret manager and workload-identity policy.
- **PENDING_OPERATOR** - Production database, queue, object storage, region, retention authority, observability platform, and backup target selections.
- **PENDING_OPERATOR** - Production AI allowlist, quotas, failover, privacy, residency, and data-governance policy.
- **PENDING_OPERATOR** - Billing currency, jurisdiction, tax treatment, merchant-of-record responsibilities, and payment processor.
- **PENDING_OPERATOR** - Staging reviewer identity and review time for the exact release SHA.
- **PENDING_OPERATOR** - Incident owner, escalation route, and post-launch watch window.
- **PENDING_OPERATOR** - Explicit production approval by an authorized operator for the exact release SHA.

## Rollback

The rollback target for this slice is `2db36e428fa95457e0559dabc224b7d8ff10d289`. Rolling back removes only the security-alert remediations; it does not enable production or external traffic.

```bash
git checkout 2db36e428fa95457e0559dabc224b7d8ff10d289
docker compose down -v
docker compose up -d --build --wait
docker compose ps
```

## Safety gate

- **DISABLED** - Production deployment and external traffic.
- **DISABLED** - Agent external traffic (`AGENT_EXTERNAL_TRAFFIC_ENABLED=false`).
- **DISABLED** - Production release without protected Environment review and explicit operator approval.
