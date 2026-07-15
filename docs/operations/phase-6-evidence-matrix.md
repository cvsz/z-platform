# Phase 6 Evidence Matrix

This matrix maps Phase 6 requirements to implementation, workflow, artifact, environment, and remaining approval evidence.

Status definitions use the issue #1 semantics: **VERIFIED**, **IMPLEMENTED**, **PENDING_EXTERNAL**, **PENDING_OPERATOR**, **BLOCKED**, and **DISABLED**.

| Requirement | Implementation or merge evidence | Workflow or artifact evidence | Environment | Status |
|---|---|---|---|---|
| CI tests and dependency policy | PR #5 and subsequent verification merges | Run `29291429851` | GitHub Actions | VERIFIED |
| Secret-pattern and browser credential scan | PR #5, PR #7, PR #10 | Runs `29291429851`, `29292145378` | GitHub Actions | VERIFIED |
| SPDX SBOM and provenance | PR #5 | SBOM artifacts `8295182927`, `8295182600`; provenance on run `29291429851` | GitHub Actions | VERIFIED |
| Seven-service health topology | PR #10, merge `d8207aa1a7880899c1fcea4de5e6903fc140805a` | Smoke artifact `8295434594` | Isolated Compose | VERIFIED |
| Durable agent job, queue, audit, workspace state | PR #5, PR #6 | Restart and persistence checks in final smoke | Isolated Compose | VERIFIED |
| Agent approval, execute, cancel, fail, retry, audit | PR #7, PR #9, PR #10 | Run `29292145378` | Isolated Compose | VERIFIED |
| Workspace Runtime approval boundaries | PR #7 | Staging smoke evidence | Isolated Compose | VERIFIED |
| Billing Ledger idempotency and duplicate rejection | PR #7 | Staging smoke evidence | Isolated Compose | VERIFIED |
| ZWallet prohibited capability rejection | PR #10 | Run `29292145378` | Isolated Compose | VERIFIED |
| ZChat automated accessibility/mobile/session checks | PR #10, PR #11 | Run `29292145378` and subsequent race fix | Isolated Compose | VERIFIED |
| Backup export and restore | PR #5, PR #7 | Isolated deployed smoke | Isolated Compose | VERIFIED |
| External backup target restore | Operator-selected target required | None yet | External staging | PENDING_EXTERNAL |
| Structured logs and Prometheus metrics | PR #5, PR #7 | Isolated deployed smoke | Isolated Compose | VERIFIED |
| Dashboard, distributed traces, alert delivery | Platform selection and deployment required | None yet | External staging | PENDING_EXTERNAL |
| AI non-streaming completion | Gateway evidence request `79a7ce8b-4d50-4ba9-972d-a5d219293b72` | Status `200`, `proxy_success` | Local/staging provider account | VERIFIED |
| AI streaming and file upload | Approved upstream account required | None yet | External staging | PENDING_EXTERNAL |
| Multi-provider failover contracts | PR #12 | Deterministic unit and integration tests | Repository | VERIFIED |
| Multi-provider external verification | Agent Control Panel UI and Redis Pool Gateway | Real approved-account evidence absent | External staging | PENDING_EXTERNAL |
| Provider credentials remain server-side | Gateway architecture and automated browser scans | Runs `29291429851`, `29292145378` | Repository/Compose | VERIFIED |
| Actual production browser bundle and HAR inspection | Deployed browser and routing required | None yet | External staging | PENDING_EXTERNAL |
| Cloudflare Access mapping | Agent Control Worker proxy logic and wrangler config | External account and policy mapping absent | External staging | PENDING_EXTERNAL |
| External identity and production claim mapping | Tenant/subject header boundary exists | Authoritative IdP mapping absent | External staging | PENDING_OPERATOR |
| Production secret manager | Local and GitHub Environment handling documented | Vendor and access policy absent | Production | PENDING_OPERATOR |
| Managed DB, queue, object storage, region | Adapter contracts and durable local provider exist | Managed-service evidence absent | Production | PENDING_OPERATOR |
| Human keyboard, screen-reader, and target-device QA | Automated static checks exist | Human test record absent | External staging | PENDING_EXTERNAL |
| Billing currency, tax, jurisdiction, processor | Safety boundary exists | Business/legal decision absent | Production | PENDING_OPERATOR |
| Staging reviewer and review time | Review controls exist | Named completed review absent | External staging | PENDING_OPERATOR |
| Incident owner, escalation, watch window | Incident runbook exists | Named operational record absent | Production | PENDING_OPERATOR |
| Production release approval | Production environment requires approval | Explicit release SHA approval absent | Production | PENDING_OPERATOR |
| Current `main` evidence (`2db36e428fa95457e0559dabc224b7d8ff10d289`) | Seven-service topology and release gates | Runs `29425990792`, `29425992713`, `29425992683`, and `29425992884` pass; smoke artifact `8347285839`; SBOM IDs `8347268150`, `8347267792`, `8347266561` | GitHub Actions / isolated Compose | VERIFIED |
| Current `main` security eligibility | CodeQL and Dependabot scanning | CodeQL alerts 1-5 and Dependabot alert 1 remain open | GitHub security scanning | BLOCKED |
| CodeQL Advanced z-runner lane | Self-hosted runner and broader query suite configuration | Workflow-shape regression test covers `runs-on: [self-hosted, linux, x64, z-runner]` and `security-and-quality` config loading | Repository / self-hosted runner | IMPLEMENTED |
| Security-alert remediation | Path containment, rate limiting, default-deny CORS, command-argument omission, patched PostCSS resolution | Deterministic local success, denial, and security tests pass; PR-head workflows pending | Repository / isolated Compose | IMPLEMENTED |

## Release selection rule

A commit may be selected as a production release candidate only when:

1. Its own CI, dependency, secret-scan, SBOM, and provenance results are recorded.
2. External staging tests reference that exact commit or immutable image digest.
3. The staging reviewer records identity and review time.
4. Incident ownership, escalation, watch window, and rollback target are recorded.
5. A production approving operator explicitly approves that exact release.

Prior evidence remains valid for the commits and artifacts it identifies, but it must not be silently transferred to a newer `main` head.
