# Agent System Rules

## Language & Communication Guidelines
- **Primary Response Language:** Always communicate, explain, and write documentation/comments in **Thai** (ภาษาไทย).
- **Code & Configuration:** All source code, terminal commands, configuration files (JSON, YAML, ENV, etc.), variable names, and code syntax MUST remain in **English**.
- **Technical Terms:** Keep standard software architecture and programming jargon in English (e.g., *refactor*, *middleware*, *dependency injection*) to maintain accuracy.

## Response Behavior
1. **Explanations:** Provide all explanations, step-by-step guidance, and trade-off analyses in **Thai**.
2. **Code Blocks:** Write clean, executable code entirely in **English**. Do not translate programming keywords, variables, or API routes into Thai.
3. **Inline Comments:** Write comments within code blocks in **Thai** if they explain logic to the developer, but keep the code itself standard English.

## Repository Operating Rules
- Read this root `AGENTS.md`, `README.md`, contribution guidance, and repository-native configuration before making changes.
- If a nested `AGENTS.md` exists, treat the nearest file as the more specific instruction set for that subtree while preserving these root rules unless explicitly overridden.
- Preserve the existing architecture, public interfaces, naming conventions, formatting, and repository style unless the task explicitly requires a change.
- Prefer the smallest safe diff that fully solves the requested problem. Do not rewrite unrelated code or generated/vendor files.
- Never commit credentials, tokens, private keys, production secrets, personal data, or sensitive runtime output. Use documented secret/env mechanisms instead.
- Do not disable tests, security checks, type checks, lint rules, branch protections, or validation gates merely to make CI pass.
- Use repository-native build, test, lint, type-check, security, migration, and packaging commands whenever available.
- Before claiming a task complete, verify the relevant tests/checks and report what actually passed, what was not run, and any remaining blocker.

## Production Readiness
- Do not claim `production-ready`, `enterprise-ready`, `secure`, or `complete` without concrete evidence from the repository and validation results.
- For production-impacting changes, consider security, backward compatibility, observability, rollback, migrations, backup/restore, failure handling, and operational documentation.
- Treat authentication, authorization, payments, secrets, infrastructure, data migration, destructive operations, and externally visible API contracts as high-risk changes requiring extra validation.

## Git & Change Safety
- Do not force-push, rewrite shared history, delete unrelated branches/tags, or perform destructive Git operations unless the user explicitly authorizes that exact action.
- Keep commits focused and descriptive. Avoid mixing unrelated refactors with functional fixes.
- Do not merge failing changes or bypass required checks. If checks are unavailable, say so rather than assuming success.
- Preserve existing user work and project-specific instructions. When requirements conflict, follow the more specific repository rule or explicit user instruction and document the trade-off.

---

# Agent Instructions

This file defines repository instructions for automated coding agents working in `z-platform`.

## Mission

Help evolve `z-platform` as a clean, security-first successor to `cvsz/zeaz-platform` while preserving explicit platform boundaries, gateway-only AI access, durable orchestration, and production readiness gates.

## Required reading

Before changing code, read the relevant files:

- `README.md`
- `docs/project/project-overview.md`
- `docs/requirements/master-requirements.md`
- `docs/architecture/README.md`
- `docs/migration/execution-plan.md`
- `docs/migration/manifest.md`
- `docs/operations/production-master.md`
- `SECURITY.md`

## Non-negotiable rules

- Do not commit secrets, provider keys, service tokens, wallet keys, MPC shares, card data, KYC payloads, or production identifiers.
- Do not expose upstream provider credentials to browsers, IDE clients, generated projects, logs, traces, or tests.
- Keep AI provider access behind `services/ai-gateway`.
- Do not install files, scripts, or configurations outside the `z-platform` directory (e.g., avoid `/opt`, `/usr/local`, or `$HOME/.config`). The stack must remain standalone.
- Keep mutating agent jobs behind explicit approval state and scoped tool grants.
- Keep workspace shell and deployment behind explicit `shell` or `deploy` approval grants.
- Keep ZWallet limited to billing-ledger adapter behavior; reject signing, cards, KYC, MPC, and swaps.
- Do not apply production infrastructure from an agent without operator approval.

## Work style

- Prefer small, reviewable changes.
- Match existing package style and tests.
- Add or update tests for success, failure, authorization, timeout, and denial paths when behavior changes.
- Update docs when architecture, operations, migration status, requirements, or security boundaries change.
- Keep generated files reproducible and free of secret-bearing paths.

## Validation expectations

Run the relevant package tests locally when available. GitHub Actions must remain the release gate for CI, validation, secret scanning, dependency policy, SBOM generation, and provenance verification.

## Production changes

Production-affecting work must reference:

- `docs/operations/production-master.md`
- `docs/operations/staging-readiness.md`
- `docs/requirements/master-requirements.md`

Production traffic remains blocked until operator approval is recorded outside automated agent execution.
