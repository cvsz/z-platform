# Phase 6 Evidence Matrix

This matrix maps Phase 6 requirements to implementation, workflow, artifact, environment, and remaining approval evidence.

Status definitions:

- **Verified — repository:** implementation and automated tests are present.
- **Verified — Compose:** deployed verification passed in the isolated repository-controlled topology.
- **Pending — external:** requires operator-selected external accounts, infrastructure, devices, or human review.
- **Pending — production approval:** requires explicit release approval after all external evidence is recorded.

| Requirement | Implementation or merge evidence | Workflow or artifact evidence | Environment | Status |
|---|---|---|---|---|
| CI tests and dependency policy | PR #5 and subsequent verification merges | Run `29291429851` | GitHub Actions | Verified — repository |
| Secret-pattern and browser credential scan | PR #5, PR #7, PR #10 | Runs `29291429851`, `29292145378` | GitHub Actions | Verified — repository |
| SPDX SBOM and provenance | PR #5 | SBOM artifacts `8295182927`, `8295182600`; provenance on run `29291429851` | GitHub Actions | Verified — repository |
| Seven-service health topology | PR #10, merge `d8207aa1a7880899c1fcea4de5e6903fc140805a` | Smoke artifact `8295434594` | Isolated Compose | Verified — Compose |
| Durable agent job, queue, audit, workspace state | PR #5, PR #6 | Restart and persistence checks in final smoke | Isolated Compose | Verified — Compose |
| Agent approval, execute, cancel, fail, retry, audit | PR #7, PR #9, PR #10 | Run `29292145378` | Isolated Compose | Verified — Compose |
| Workspace Runtime approval boundaries | PR #7 | Staging smoke evidence | Isolated Compose | Verified — Compose |
| Billing Ledger idempotency and duplicate rejection | PR #7 | Staging smoke evidence | Isolated Compose | Verified — Compose |
| ZWallet prohibited capability rejection | PR #10 | Run `29292145378` | Isolated Compose | Verified — Compose |
| ZChat automated accessibility/mobile/session checks | PR #10, PR #11 | Run `29292145378` and subsequent race fix | Isolated Compose | Verified — Compose |
| Backup export and restore | PR #5, PR #7 | Isolated deployed smoke | Isolated Compose | Verified — Compose |
| External backup target restore | Operator-selected target required | None yet | External staging | Pending — external |
| Structured logs and Prometheus metrics | PR #5, PR #7 | Isolated deployed smoke | Isolated Compose | Verified — Compose |
| Dashboard, distributed traces, alert delivery | Platform selection and deployment required | None yet | External staging | Pending — external |
| AI non-streaming completion | Gateway evidence request `79a7ce8b-4d50-4ba9-972d-a5d219293b72` | Status `200`, `proxy_success` | Local/staging provider account | Verified — Compose |
| AI streaming and file upload | Approved upstream account required | None yet | External staging | Pending — external |
| Multi-provider failover contracts | PR #12 | Deterministic unit and integration tests | Repository | Verified — repository |
| Multi-provider external verification | Agent Control Panel UI and Redis Pool Gateway | Pool rotation and quotas verified | Isolated Compose | Verified — Compose |
| Provider credentials remain server-side | Gateway architecture and automated browser scans | Runs `29291429851`, `29292145378` | Repository/Compose | Verified — Compose |
| Actual production browser bundle and HAR inspection | Deployed browser and routing required | None yet | External staging | Pending — external |
| Cloudflare Access mapping | Agent Control Worker proxy logic and wrangler config | Worker logic deployed locally | Isolated Compose | Verified — Compose |
| External identity and production claim mapping | Tenant/subject header boundary exists | Authoritative IdP mapping absent | External staging | Pending — external |
| Production secret manager | Local and GitHub Environment handling documented | Vendor and access policy absent | Production | Pending — external |
| Managed DB, queue, object storage, region | Adapter contracts and durable local provider exist | Managed-service evidence absent | Production | Pending — external |
| Human keyboard, screen-reader, and target-device QA | Automated static checks exist | Human test record absent | External staging | Pending — external |
| Billing currency, tax, jurisdiction, processor | Safety boundary exists | Business/legal decision absent | Production | Pending — external |
| Staging reviewer and review time | Review controls exist | Named completed review absent | External staging | Pending — external |
| Incident owner, escalation, watch window | Incident runbook exists | Named operational record absent | Production | Pending — external |
| Production release approval | Production environment requires approval | Explicit release SHA approval absent | Production | Pending — production approval |
| CI evidence drift for current `main` head | `validate-release-evidence.yml` restored; manifest `releaseSha` cleared | New CI run required for `624183524fd3edc9666ddce7c64acafa1130fa7e` | GitHub Actions | IMPLEMENTED — requires passing `validate.yml` run on current `main` |

## Release selection rule

A commit may be selected as a production release candidate only when:

1. Its own CI, dependency, secret-scan, SBOM, and provenance results are recorded.
2. External staging tests reference that exact commit or immutable image digest.
3. The staging reviewer records identity and review time.
4. Incident ownership, escalation, watch window, and rollback target are recorded.
5. A production approving operator explicitly approves that exact release.

Prior evidence remains valid for the commits and artifacts it identifies, but it must not be silently transferred to a newer `main` head.