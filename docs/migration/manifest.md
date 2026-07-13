# Migration Manifest

Source repository: `cvsz/zeaz-platform`

## Phase 0 — Foundation

| Item | Target | Action | Status |
|---|---|---|---|
| Repository policies | root | Recreate security-first policy | complete |
| Workspace configuration | root | Create clean pnpm workspace | complete |
| Architecture and migration docs | docs | Create baseline documentation | complete |

## Phase 1 — AI foundation

| Item | Target | Action | Status |
|---|---|---|---|
| ZAI Coder application boundary | `apps/zaicoder` | Establish packaging, safe configuration and gateway contract | complete |
| AI gateway boundary | `services/ai-gateway` | Establish ownership and safe runtime configuration | complete |
| Streaming, MCP and model preflight runtime | `apps/zaicoder/backend` | Migrate tested isolated modules and regression tests | complete |
| Gateway-backed CLI | `apps/zaicoder/backend` | Add OpenAI-compatible client, command entry point and unit tests | complete |
| Browser gateway proxy and terminal shell | `apps/zaicoder/web` | Add server-side gateway proxy, input validation and basic browser UI | complete |
| Browser response streaming | `apps/zaicoder/web` | Add end-to-end SSE proxying and browser delta rendering | complete |
| Browser file and workspace capabilities | `apps/zaicoder/web` | Import file upload and project-context behavior after component audit | pending |

## Candidate migrations

| Legacy source | Target | Selection rule | Status |
|---|---|---|---|
| `apps/zchat` | `apps/zchat` | Retain UI only; replace direct provider keys with platform gateway | pending |
| `apps/zai-stack` | `services/agent-orchestrator` | Extract policy and job-routing runtime | pending |
| `apps/zai-factory` | `tools/zai-factory` | Retain generators and templates only | pending |
| `apps/zow` | `apps/zow` + `services/workspace-runtime` | Split UI from sandbox/runtime | pending |
| `apps/zwallet` | `apps/zwallet` + `services/billing-ledger` | Keep UI/ledger adapters; exclude signing and production provider config | pending |

A runtime component is copied only after its dependency list, test command, secret scan, license status, and rollback plan are recorded.
