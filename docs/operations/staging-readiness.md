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

Current `main` SHA: `923c3a190fbf626faae076bf5faa43a4d03a9703` (PR #45 merge, 2026-07-15).

| Claim | Status | Evidence | Limitations |
|---|---|---|---|
| Node and Python tests and dependency audits | VERIFIED | `CI` run `29420810124`, success, 2026-07-15, GitHub Actions | Repository-local CI evidence only. |
| Secret and browser credential scans | VERIFIED | `validate` run `29420810446`, `secret-patterns` job success, 2026-07-15 | The overall workflow failed in deployed smoke. |
| Compose configuration and image builds | VERIFIED | `validate` run `29420810446`, `compose` job success, 2026-07-15 | Build success is not deployed health evidence. |
| SPDX SBOM | VERIFIED | `validate` run `29420810446`; `z-platform-sbom` ID `8345118355`, digest `sha256:a690b1bb472eab7418738ae077b7b4b130196311fffd9e7ecb42ec0b40faa1ed`; `z-platform-sbom.spdx.json` ID `8345117963`, digest `sha256:a4b895ac079c0ca38c6e53557fe1b0b85bd032851ff9aff7bad547aac917ccca` | Artifacts are bound only to `923c3a1`. |
| Dependency and provenance policy | VERIFIED | `operations` run `29420810135`, `dependency-and-provenance` success, 2026-07-15 | Valid only for `923c3a1`. |
| Release-evidence SHA binding | VERIFIED | `validate-release-evidence` run `29420810333`, success, 2026-07-15 | Does not make a failed release candidate eligible. |
| Seven-service deployed smoke | BLOCKED | `validate` run `29420810446`, `deployed-smoke` failed; no smoke artifact was produced | `923c3a1` is not eligible as a release candidate. |
| AI Gateway startup remediation | IMPLEMENTED | Gateway start script, lockfile-based dedicated image, startup contract tests, and local Compose health validation on this branch | Local smoke did not produce a result; passing PR-head CI and a deployed-smoke artifact are required before VERIFIED. |

Prior evidence remains valid only for its recorded immutable SHAs. It must not be assigned to `923c3a1` or this branch.

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

The rollback target for this slice is `923c3a190fbf626faae076bf5faa43a4d03a9703`. Rolling back removes only the Gateway startup remediation; it does not enable production or external traffic.

```bash
git checkout 923c3a190fbf626faae076bf5faa43a4d03a9703
docker compose down -v
docker compose up -d --build --wait
docker compose ps
```

## Safety gate

- **DISABLED** - Production deployment and external traffic.
- **DISABLED** - Agent external traffic (`AGENT_EXTERNAL_TRAFFIC_ENABLED=false`).
- **DISABLED** - Production release without protected Environment review and explicit operator approval.
