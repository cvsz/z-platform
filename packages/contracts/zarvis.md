# Z.A.R.V.I.S. Contracts

Versioned contracts for the Z.A.R.V.I.S. command, result, audit, and durable session boundaries.

## Schemas

- `schemas/zarvis.command.requested.v1.schema.json`
- `schemas/zarvis.command.completed.v1.schema.json`
- `schemas/zarvis.audit.tool-executed.v1.schema.json`
- `schemas/zarvis.session.event.v1.schema.json`

## Rules

- Clients submit transcripts, never provider, GitHub, edge, or service credentials.
- `github.repository.status` remains the only admitted tool and is strictly read-only.
- A client-supplied `command_id` is the idempotency key.
- Reusing a `command_id` with identical content returns the stored response with `replayed: true`.
- Reusing a `command_id` with different content fails with `409 idempotency_conflict`.
- Session history is append-only and records accepted, completed, or failed command transitions.
- Tool execution emits a separate allowlisted audit event.
- Session deletion is an explicit owner privacy action and requires a matching confirmation value.
- Future mutating tools require a distinct approval state machine and versioned contracts; they cannot be added by reinterpreting these schemas.
