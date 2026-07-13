# Staging Readiness Review

Production deployment is blocked until every item is checked and signed off by the operator.

## CI and artifacts

- [ ] CI tests pass.
- [ ] Secret scanning passes.
- [ ] Dependency check passes.
- [ ] SBOM artifact generated.
- [ ] Provenance verification passes.

## Identity and access

- [ ] Cloudflare Access policies mapped.
- [ ] Service tokens stored in approved secret manager.
- [ ] Tenant claim mapping verified.
- [ ] Browser cannot access service credentials.

## Service readiness

- [ ] Health endpoints respond for every deployed service.
- [ ] Structured logs are visible.
- [ ] Metrics dashboards exist.
- [ ] Trace propagation verified.
- [ ] Backups configured and restore tested.

## Safety boundaries

- [ ] AI Gateway is the only holder of provider credentials.
- [ ] Billing Ledger has no wallet/card authority.
- [ ] Workspace Runtime blocks shell/deploy without approval.
- [ ] Agent Orchestrator blocks unapproved mutating tools.
- [ ] ZWallet adapter rejects signing, card, KYC, MPC, and swap payloads.
