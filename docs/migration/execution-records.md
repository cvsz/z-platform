# Migration Execution Records

## 2026-07-15 — Immutable release evidence binding

- Base revision: `f5be49853ec9311c81f9e62892b4d7f2db4bc254`
- Scope: one Phase 6 release-safety vertical slice.
- Implementation: added a dependency-free validator that requires `commitSha`, `approvedCommitSha`, and `observedCommitSha` to equal the exact release-candidate SHA.
- Compatibility: existing release templates and runtime interfaces are unchanged.
- Security: no provider SDKs, credentials, external traffic, deployment, or financial authority added.
- Tests: positive exact-match case plus stale, placeholder, missing-field, and invalid-argument regressions.
