# Migration Execution Records

## 2026-07-16 — CodeQL Advanced self-hosted runner lane

- Base revision: `1f44d9588fe4a42370f3477eea22a70e1e4cbd22`
- Scope: one repository-local CodeQL workflow slice.
- Implementation: updated `CodeQL Advanced` to run on the self-hosted `z-runner` lane and to load a repository CodeQL config that adds the `security-and-quality` query suite.
- Compatibility: the security workflow still analyzes the same repository languages and does not alter runtime application code, provider access, or production gates.
- Security: no credentials, service tokens, or production identifiers were added; the change only moves analysis to the designated CI runner and broadens query coverage.
- Tests: `scripts/test/codeql-workflow.test.mjs` now checks the runner label, config-file binding, and query-suite selection.
- Limitations: repository-local validation only; PR-head CodeQL execution, artifact binding, and alert-closure evidence on the self-hosted runner remain pending.

## 2026-07-15 — Immutable release evidence binding

- Base revision: `f5be49853ec9311c81f9e62892b4d7f2db4bc254`
- Scope: one Phase 6 release-safety vertical slice.
- Implementation: added a dependency-free validator that requires `commitSha`, `approvedCommitSha`, and `observedCommitSha` to equal the exact release-candidate SHA.
- Compatibility: existing release templates and runtime interfaces are unchanged.
- Security: no provider SDKs, credentials, external traffic, deployment, or financial authority added.
- Tests: positive exact-match case plus stale, placeholder, missing-field, and invalid-argument regressions.
