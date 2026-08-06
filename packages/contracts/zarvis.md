# Z.A.R.V.I.S. Contracts

Versioned contracts for the Z.A.R.V.I.S. command, result, audit, durable session, task, and approval boundaries.

## Schemas

- `schemas/zarvis.command.requested.v1.schema.json`
- `schemas/zarvis.command.completed.v1.schema.json`
- `schemas/zarvis.audit.tool-executed.v1.schema.json`
- `schemas/zarvis.session.event.v1.schema.json`
- `schemas/zarvis.task.requested.v1.schema.json`
- `schemas/zarvis.task.approval.v1.schema.json`
- `schemas/zarvis.task.snapshot.v1.schema.json`

## Command and session rules

- Clients submit transcripts, never provider, GitHub, edge, or service credentials.
- `github.repository.status` remains the only synchronous command tool and is strictly read-only.
- A client-supplied `command_id` is the command idempotency key.
- Reusing a `command_id` with identical content returns the stored response with `replayed: true`.
- Reusing a `command_id` with different content fails with `409 idempotency_conflict`.
- Session history is append-only and records accepted, completed, or failed command transitions.
- Tool execution emits a separate allowlisted audit event.
- Session deletion is an explicit owner privacy action and requires a matching confirmation value.

## Durable task rules

- Task identity is permanently `github:4076926` in tenant `owner-4076926`.
- Task steps form an ordered DAG; dependencies may reference only earlier unique step IDs.
- The task registry admits only `github.repository.status` and `zarvis.repository.summary` in this slice.
- Every task step is read-only; a `mutating: true` request fails closed.
- `idempotency_key` may replay only the identical canonical plan.
- Approval requires the exact SHA-256 plan digest and one-time nonce before expiry.
- The worker checks approval expiry again before any tool call.
- Pause, resume, cancel, retry, checkpoint, and terminal state transitions are versioned and audited.
- Mutating tools require later capability, preview, approval, execution, and rollback contracts; they cannot be enabled by reinterpreting these schemas.
