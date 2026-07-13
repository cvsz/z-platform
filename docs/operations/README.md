# Operations Documentation

This directory contains production operations controls, runbooks, and readiness gates for `z-platform`.

## Primary production document

- [Production master document](production-master.md)

## Runbooks and reviews

- [Cloudflare Access service policies](cloudflare-access.md)
- [GitHub App token format readiness](github-app-token-format.md)
- [Observability and health](observability.md)
- [Backup and restore runbook](backups.md)
- [Incident runbook](incident-runbook.md)
- [Staging readiness review](staging-readiness.md)

Production traffic remains blocked until the production master document and staging readiness review are satisfied by the operator.
