# Migration Validation Report

## Release governance operator-signoff coverage

Date: 2026-07-16

| Gate | Result | Evidence |
|---|---|---|
| Scope | pass | One repository-local operator-signoff slice only. |
| Governance records | pass | `docs/operations/phase-6-operator-inputs.md`, `docs/release/operational-ownership.md`, and `docs/release/production-release-record.md` now explicitly bind the operator-owned approval path to the final release workflow. |
| Deterministic coverage | pass | `scripts/test/operator-governance.test.mjs` and `scripts/test/deployment-readiness-workflows.test.mjs` pass. |
| Template validation | pass | `node scripts/validate-release-templates.mjs` passed in this worktree. |

This slice is repository-local. It makes the remaining `PENDING_OPERATOR` items explicit and auditable, but it does not fabricate any reviewer, incident, or approval values.

## Supabase read-only Phase 6 API bridge

Date: 2026-07-16

| Gate | Result | Evidence |
|---|---|---|
| Scope | pass | One repository-local Supabase bridge slice only. |
| Auth boundary | pass | `/supabase/read` requires the existing Phase 6 bearer token and returns 401 without it. |
| Read-only data path | pass | The Phase 6 API reads a Supabase Data API table with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_TABLE`; the anon key is not exposed to the browser. |
| Failure handling | pass | Missing config, invalid base URL, invalid table name, upstream 403, non-array payload, and out-of-range limit cases are covered deterministically. |
| Format and tests | pass | `python3 -m pytest services/phase6-api/tests/test_supabase_read.py services/phase6-api/tests/test_github_webhook.py`, `docker compose config --quiet`, and `git diff --check` passed in this worktree. |

This slice remains repository-local until an approved Supabase project and table are exercised as external evidence for the exact release candidate SHA.

## AI Gateway disconnect-aware upstream cancellation

Date: 2026-07-15

| Gate | Result | Evidence |
|---|---|---|
| Scope | pass | One repository-local AI Gateway slice only. |
| Disconnect handling | pass | The gateway aborts the upstream request when the client disconnects and does not retry after close. |
| Deterministic coverage | pass | Added a real-socket regression test for client disconnects plus existing startup-contract coverage. |
| Format, lint, typecheck, build | pass | `pnpm --dir services/ai-gateway test`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed in this worktree. |
| Compose validation | pass | `docker compose config --quiet` and `docker compose build ai-gateway` passed in this worktree. |

This slice remains repository-local. It does not claim external staging, operator approval, or production readiness.

## Immutable release evidence binding

Date: 2026-07-15

| Gate | Result | Evidence |
|---|---|---|
| Scope | pass | One release-safety vertical slice only. |
| Backward compatibility | pass | Existing templates, schemas, services, and CLI contracts are unchanged. |
| Provider isolation | pass | No provider SDK or credential path added. |
| Unit coverage | pass by inspection; CI pending | Node tests cover exact, stale, malformed, placeholder, and missing evidence. |
| Format | CI pending | Changed JavaScript and JSON follow repository formatting conventions. |
| Lint | CI pending | No new dependency or lint suppression. |
| Typecheck | CI pending | Runtime is dependency-free JavaScript and does not modify typed packages. |
| Tests | CI pending | Root `pnpm test` includes `scripts/test/*.test.mjs`. |

The pull request is the authoritative source for CI results. Evidence must not be promoted to a release record until checks pass for the exact PR head commit.

## CodeQL Advanced workflow toolchain hardening

Date: 2026-07-16

| Gate | Result | Evidence |
|---|---|---|
| Scope | pass | One repository-local workflow-hardening slice only. |
| Toolchain setup | pass | `CodeQL Advanced` now provisions Node, pnpm, Go, and Python before `github/codeql-action/init@v4` on the available self-hosted Linux/X64 lane. |
| Deterministic coverage | pass | `scripts/test/codeql-workflow.test.mjs` asserts the runner labels, config binding, setup ordering, and `security-and-quality` query suite. |
| Format and workflow validation | pass | `python3` YAML parse of `.github/workflows/codeql.yml`, `node --test scripts/test/codeql-workflow.test.mjs`, and repo pre-push checks passed in this worktree. |

This slice is repository-local. PR-head CodeQL execution, alert-closure evidence, and immutable artifact binding still depend on GitHub Actions for the exact commit SHA.

## CI pnpm Node 24 alignment

Date: 2026-07-16

| Gate | Result | Evidence |
|---|---|---|
| Scope | pass | One repository-local workflow compatibility slice only. |
| Toolchain alignment | pass | `ci`, `validate`, and `CodeQL Advanced` now provision Node 24 before `pnpm install`, matching the pinned `pnpm@11.4.0` requirement. |
| Deterministic coverage | pass | `scripts/test/workflow-pnpm-setup.test.mjs` and `scripts/test/codeql-workflow.test.mjs` now assert the Node 24 setup step alongside the existing pnpm workflow checks. |
| Format and workflow validation | pass | `node --test scripts/test/workflow-pnpm-setup.test.mjs scripts/test/codeql-workflow.test.mjs` passed, and `CI=true pnpm install --ignore-scripts --store-dir /tmp/pnpm-store` completed in a clean worktree. |

This slice remains repository-local. It removes the Node 20 / pnpm 11 mismatch that caused `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` during dependency installation, but it does not claim external staging, operator approval, or production readiness.
