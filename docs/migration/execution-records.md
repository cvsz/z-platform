# Migration Execution Records

## 2026-07-15 — AI Gateway disconnect-aware upstream cancellation

- Base revision: `36fc7f594c933137a1d8da2855bac752fb2f03b3`
- Scope: one repository-local AI Gateway slice.
- Implementation: wrapped the gateway in an exportable factory, propagated client disconnects to the upstream fetch through `AbortController`, and stopped retrying once the request closed.
- Compatibility: service-token auth, exact-origin CORS, provider routing, and existing gateway request contracts remain unchanged.
- Tests: `pnpm --dir services/ai-gateway test`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm keys:check`, `docker compose config --quiet`, and `docker compose build ai-gateway`.
- Limitations: repository-local validation only; no external staging, operator approval, or production readiness is claimed.

## 2026-07-15 — Immutable release evidence binding

- Base revision: `f5be49853ec9311c81f9e62892b4d7f2db4bc254`
- Scope: one Phase 6 release-safety vertical slice.
- Implementation: added a dependency-free validator that requires `commitSha`, `approvedCommitSha`, and `observedCommitSha` to equal the exact release-candidate SHA.
- Compatibility: existing release templates and runtime interfaces are unchanged.
- Security: no provider SDKs, credentials, external traffic, deployment, or financial authority added.
- Tests: positive exact-match case plus stale, placeholder, missing-field, and invalid-argument regressions.
