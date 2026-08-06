# Z.A.R.V.I.S. Contracts

Versioned contracts for the Z.A.R.V.I.S. command, result, and audit boundaries.

## Schemas

- `schemas/zarvis.command.requested.v1.schema.json`
- `schemas/zarvis.command.completed.v1.schema.json`
- `schemas/zarvis.audit.tool-executed.v1.schema.json`

## Rules

- Clients submit transcripts, not provider or GitHub credentials.
- `github.repository.status` is the only tool admitted in the first vertical slice.
- Tool access is declared `read_only` in both the catalog and audit event.
- The command response carries a speech-ready result, not raw audio.
- Every successful or failed tool execution emits an audit event.
- Future mutating tools require a distinct versioned contract and approval state machine; they cannot be added by reinterpreting these schemas.
