# Release Governance

Phase A establishes the human-readable governance records and machine-readable YAML templates used to move a release from pending staging verification to an explicitly approved production deployment.

## Records

- [Staging environment inventory](staging-environment-inventory.md)
- [External verification checklist](external-verification-checklist.md)
- [Staging review record](staging-review-record.md)
- [Operational ownership](operational-ownership.md)
- [Production release record](production-release-record.md)
- [Release state machine](release-state-machine.md)

## YAML templates

Templates are stored under `.github/release-templates/`:

- `staging-inventory.yaml`
- `external-verification.yaml`
- `staging-review.yaml`
- `operational-ownership.yaml`
- `production-release-record.yaml`

These templates are governance records, not Kubernetes Custom Resources. Phase B will add schemas and automated validation. Until then, placeholders must be replaced, secrets must remain external, image references must be digest-pinned, and every state transition must carry auditable evidence.

## Current gates

- `PENDING_EXTERNAL` remains until real external staging infrastructure is deployed and verified.
- `PENDING_OPERATOR` remains until reviewer, incident, rollback, release, and approval ownership is recorded.
- `READY_FOR_RELEASE` requires both `VERIFIED_EXTERNAL` and `APPROVED_OPERATOR` for the same immutable candidate.
- Production deployment additionally requires an explicit `GO` decision bound to the approved commit and image digests.