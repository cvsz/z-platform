# Migration Manifest

Source repository: `cvsz/zeaz-platform`

## Phase 0 — Foundation

| Item | Target | Action | Status |
|---|---|---|---|
| Repository policies | root | Recreate security-first policy | complete |
| Workspace configuration | root | Create clean pnpm workspace | complete |
| Architecture and migration docs | docs | Create baseline documentation | complete |

## Candidate migrations

| Legacy source | Target | Selection rule | Status |
|---|---|---|---|
| `apps/zaicoder` | `apps/zaicoder` | Migrate tested web/API components after dependency audit | pending |
| `apps/zchat` | `apps/zchat` | Retain UI only; replace direct provider keys with platform gateway | pending |
| `apps/zai-stack` | `services/agent-orchestrator` | Extract policy and job-routing runtime | pending |
| `apps/zai-factory` | `tools/zai-factory` | Retain generators and templates only | pending |
| `apps/zow` | `apps/zow` + `services/workspace-runtime` | Split UI from sandbox/runtime | pending |
| `apps/zwallet` | `apps/zwallet` + `services/billing-ledger` | Keep UI/ledger adapters; exclude signing and production provider config | pending |

A candidate is copied only after its dependency list, test command, secret scan, license status, and rollback plan are recorded.
