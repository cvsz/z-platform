# Staging Readiness Review

Production deployment is blocked until every item is checked and signed off by the operator.

## CI and artifacts

- [ ] CI tests pass.
- [ ] Secret scanning passes.
- [ ] Dependency check passes.
- [ ] SBOM artifact generated.
- [ ] Provenance verification passes.
- [ ] GitHub Actions result and artifact URLs are recorded for the release commit.

## GitHub Environments

- [ ] `ci` environment exists and contains no production secrets.
- [ ] `staging` environment exists with required reviewers.
- [ ] `staging` deployment branches are restricted to `main` or protected branches.
- [ ] `staging` environment secrets are staging-only and are not committed to the repository.
- [ ] `production` environment exists with operator approval required.
- [ ] `production` deployment branches are restricted to `main` or the operator-approved release branch.
- [x] Production traffic remains disabled until this checklist is signed off.

## Identity and access

- [ ] Cloudflare Access policies mapped.
- [ ] Service tokens stored in approved secret manager.
- [ ] Tenant claim mapping verified.
- [ ] Browser cannot access service credentials.
- [ ] GitHub App installation token handling accepts both stateful opaque and stateless JWT-format `ghs_` tokens.

## Service readiness

- [ ] Health endpoints respond for every deployed service.
- [ ] Structured logs are visible.
- [ ] Metrics dashboards exist.
- [ ] Trace propagation verified.
- [ ] Backups configured and restore tested.
- [ ] Staging smoke tests cover gateway chat, streaming, file upload, workspace metadata, model catalog, provider adapters, agent lifecycle, workspace runtime approvals, billing ledger, and ZWallet denial paths.

## Safety boundaries

- [ ] AI Gateway is the only holder of provider credentials.
- [ ] Billing Ledger has no wallet/card authority.
- [ ] Workspace Runtime blocks shell/deploy without approval.
- [ ] Agent Orchestrator blocks unapproved mutating tools.
- [ ] ZWallet adapter rejects signing, card, KYC, MPC, and swap payloads.

## Sign-off record

- [x] Release commit SHA recorded.
- [ ] Workflow run result recorded.
- [ ] Staging reviewer recorded.
- [ ] Production approving operator recorded.
- [ ] Rollback SHA and verification commands recorded.
- [ ] Incident owner and post-launch watch window recorded.

## Execution record

- Execution authorized by repository operator through GitHub Issue #1.
- Baseline release candidate: `6079f078e5055c9fdf8bf2313d935028e4b5709b`.
- Readiness execution started on 2026-07-14.
- This documentation commit intentionally triggers the `validate` workflow on `main`.
- No credentials, provider endpoints, production identifiers, or infrastructure authority were added.
- Environment creation, protected-environment reviewers, provider configuration, deployed-service checks, backup restore, and production approval remain operator-controlled and must be verified with external evidence before their checkboxes are completed.
