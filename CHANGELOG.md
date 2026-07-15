# Changelog

All notable changes to `z-platform` should be documented in this file.

This project follows a human-readable changelog style. Dates use `YYYY-MM-DD`.

## Unreleased

### Added

- AI Gateway container startup contract tests covering the start command, health route, fail-closed authentication, and authorization-log redaction.
- Current-head evidence record for `923c3a190fbf626faae076bf5faa43a4d03a9703`, preserving its failed deployed-smoke classification and immutable SBOM metadata.
- Current-head evidence synchronization for `2db36e428fa95457e0559dabc224b7d8ff10d289`, including its passing SHA-bound deployed-smoke and SBOM artifacts while keeping unresolved security alerts blocked.
- Immutable release-evidence validation that binds recorded, approved, and observed revisions to the exact release-candidate commit.
- Migration feature matrix, execution records, and validation report for the release-evidence slice.
- Project overview documentation under `docs/project`.
- Master requirements documentation under `docs/requirements`.
- Production master document and operations index under `docs/operations`.
- Platform operations workflow for dependency checks, SBOM generation, and provenance verification.
- CI coverage for migrated Node and Python runtimes.
- AI Gateway, ZAI Coder, ZChat, agent orchestration, workspace runtime, billing ledger, and ZWallet migration boundaries.
- **Agent Control Panel:** Full-stack UI for managing multi-provider API keys and automatic rotation logic.
- **AI Gateway Redis Pool:** Multi-provider rotation pool, failure injection limits, and fallback strategies.
- **AI Gateway Streaming & Uploads:** Native server-sent events (SSE) streaming support and binary payload pass-through.
- **Cloudflare Edge Worker:** Initial proxy script and `wrangler.toml` for authentication and routing at the edge.
- **Browser Credential Isolation:** Automated verification scripts ensure `sk-` keys and `Z_PLATFORM_SERVICE_TOKEN` are completely blocked from frontend bundles.
- **Human Client QA & Identity Provider:** Automated static checks for screen-reader/accessibility support, responsive layouts, and Cloudflare Access external identity integration in ZChat.
- **Observability Stack:** Added automated verification script `verify-observability-stack.mjs` to validate Prometheus metrics collection, Grafana health, and Jaeger distributed trace propagation.
- **Evidence drift sync and SHA-binding gate:** Restored `validate-release-evidence.yml` CI workflow removed in PR #44; cleared stale `releaseSha` from `staging-readiness-manifest.json`; added rollback candidates for PRs #43 and #44; recorded the then-current `main` head (`624183524fd3edc9666ddce7c64acafa1130fa7e`). The current-head record now supersedes that drift notice.
- **Compose Service Discovery Fix:** Fixed `redis` network configurations in `compose.yml` to use `z-platform-internal` network, enabling proper DNS resolution and database connection for the `ai-gateway` service.

### Security

- Resolve CodeQL findings for workspace path containment, AI Gateway rate limiting, default-deny CORS, and Cloudflare installer authorization-header logging; override transitive PostCSS to patched version `8.5.19`.
- Kept production and external traffic disabled while making Gateway runtime dependency installation explicit and scoped to that image.
- Release evidence copied from another commit is rejected before approval or deployment recording.
- Documented gateway-only provider access and browser secret isolation.
- Documented explicit approval gates for agent tools, workspace shell, workspace deploy, infrastructure, and production traffic.
- Documented denial of wallet signing, cards, KYC, MPC, and swaps from AI and billing paths.

## 0.1.0 - 2026-07-13

### Added

- Initial security-first platform foundation extracted incrementally from `cvsz/zeaz-platform`.
- Baseline migration manifest, execution plan, architecture docs, CI, and operations runbooks.
