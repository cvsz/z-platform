# Staging Readiness Review

Production and external traffic remain **DISABLED**. Issue #1 remains open until external staging evidence and explicit operator approval are recorded for the same immutable release SHA.

Environment bootstrap for `ci`, `staging`, and `production` is handled by `scripts/configure-github-environments.sh`. It imports populated keys from the loaded env overlays into the relevant GitHub environment variables and secrets, does not invent reviewers, and does not bypass protected-environment rules.

## Status definitions

- **VERIFIED** - backed by repository, CI, artifact, or isolated deployed evidence.
- **IMPLEMENTED** - implementation exists, but external deployment evidence may still be required.
- **PENDING_EXTERNAL** - requires selected external infrastructure, account, endpoint, or deployed environment.
- **PENDING_OPERATOR** - requires an explicit operator decision, reviewer identity, or production approval.
- **BLOCKED** - cannot be completed until the named dependency is supplied.
- **DISABLED** - intentionally disabled by the safety gate.

## Current-head evidence

Current `main` SHA: `634135b8c9ec9f166e67c68433b8d767fa7fb265` (2026-07-16).

| Claim | Status | Evidence | Limitations |
|---|---|---|---|
| Node and Python tests and dependency audits | VERIFIED | `validate` run `29468958977`, jobs `node` and `python`, success, 2026-07-16, GitHub Actions | Repository-local CI evidence only. |
| Secret and browser credential scans | VERIFIED | `validate` run `29468958977`, `secret-patterns` job, success, 2026-07-16 | Pattern checks do not supersede CodeQL or Dependabot findings. |
| Compose configuration and image builds | VERIFIED | `validate` run `29468958977`, `compose` job, success, 2026-07-16 | Build success is not external staging evidence. |
| SPDX SBOM | VERIFIED | `validate` run `29468958977`; `z-platform-sbom` ID `8364711825`; `z-platform-sbom.spdx.json` ID `8364710149` | Artifact digests were not re-fetched in this pass; artifacts are bound only to `634135b8c9ec9f166e67c68433b8d767fa7fb265`. |
| Dependency and provenance policy | VERIFIED | `operations` run `29468958979`, success; `sbom-spdx-json` ID `8364198676`, 2026-07-16 | Artifact digest was not re-fetched in this pass; valid only for `634135b8c9ec9f166e67c68433b8d767fa7fb265`. |
| Seven-service deployed smoke | VERIFIED | `validate` run `29468958977`, `deployed-smoke` job, success; `staging-smoke-evidence` ID `8364578530` | Isolated Compose evidence only; not external staging. |
| Main security-alert state | IMPLEMENTED | CodeQL Advanced run `29468958931` passed on `634135b8c9ec9f166e67c68433b8d767fa7fb265`; Dependabot alert state was not re-fetched with authenticated API access | Passing workflows do not by themselves prove alert closure. |
| AI Gateway disconnect-aware upstream cancellation | IMPLEMENTED | Branch-local gateway factory, disconnect abort handling, and deterministic client-disconnect regression test on this branch | PR-head workflow, immutable artifact binding, and any external staging evidence are still pending. |
| Supabase read-only Data API bridge | IMPLEMENTED | Phase 6 API authenticated `/supabase/read` route with env-based URL, anon-key, and table selection; route-level success and failure-path tests on this branch | Real Supabase project/table evidence and external staging execution are still **PENDING_EXTERNAL**. |

## Remote-tracking main drift

Remote `origin/main` SHA: `0f181f19b2a53473af96fa5790c1191d4ddc4ae9` (merge PR #55, 2026-07-16).

| Claim | Status | Evidence | Limitations |
|---|---|---|---|
| GitHub environment helper and operator review-field import | IMPLEMENTED | `bash -n scripts/configure-github-environments.sh`; `node --test scripts/test/configure-github-environments-script.test.mjs scripts/test/current-head-evidence-sync.test.mjs`; the helper imports `STAGING_REVIEWER`, `INCIDENT_OWNER`, `ESCALATION_ROUTE`, `WATCH_WINDOW`, `PRODUCTION_REVIEWER`, and `PRODUCTION_APPROVER` from the loaded overlays | Repository-local validation only; CI, SBOM, provenance, and immutable artifact evidence for the exact `0f181f19...` SHA still need revalidation. |

## CodeQL Advanced self-hosted runner slice

| Claim | Status | Evidence | Limitations |
|---|---|---|---|
| Workflow and runner update | IMPLEMENTED | `CodeQL Advanced` now runs on the available self-hosted Linux/X64 lane, loads `.github/codeql/codeql-config.yml`, provisions Node/pnpm/Go/Python toolchains before CodeQL init, and adds the `security-and-quality` query suite; `scripts/test/codeql-workflow.test.mjs` checks the workflow shape and setup ordering | PR-head CodeQL execution on the exact SHA and alert-closure evidence on the self-hosted runner remain **PENDING_EXTERNAL**. |

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
