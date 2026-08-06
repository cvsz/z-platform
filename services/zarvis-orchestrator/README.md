# Z.A.R.V.I.S. Orchestrator

The first Z.A.R.V.I.S. vertical slice converts a text or voice transcript into a strictly read-only GitHub repository status query, returns a speech-ready summary, and emits a structured audit event.

This service is a single-user private assistant permanently bound to GitHub user ID `4076926` (`cvsz`). The owner ID is an immutable source-code invariant and cannot be replaced through environment variables.

## Boundary

```text
Trusted identity edge
        |
        | fixed owner assertion + edge secret
        v
ZARVIS Console
        |
        | fixed owner service identity + service token
        v
ZARVIS Orchestrator
        |
        | fixed-host HTTPS GET
        v
GitHub REST API
        |
        v
speech-ready result + audit event
```

The browser never receives `GITHUB_TOKEN`, the edge secret, or the console-to-orchestrator service token. The only registered tool is `github.repository.status`; unknown or mutating tool names fail closed.

## Run

```bash
export ZARVIS_ORCHESTRATOR_SERVICE_TOKEN='<at-least-32-random-bytes>'
pnpm --filter @z-platform/zarvis-orchestrator start
```

Environment variables:

| Variable | Default | Purpose |
|---|---:|---|
| `PORT` | `8094` | HTTP listen port |
| `HOST` | `0.0.0.0` | HTTP listen address |
| `GITHUB_TOKEN` | unset | Optional server-side token for private repositories or higher rate limits |
| `ZARVIS_GITHUB_TIMEOUT_MS` | `5000` | GitHub request timeout |
| `ZARVIS_ORCHESTRATOR_SERVICE_TOKEN` | required | Authenticates the private console to the orchestrator; minimum 32 bytes |

There is intentionally no `ZARVIS_OWNER_GITHUB_ID` configuration variable. The owner is fixed to `4076926`.

## API

### `GET /healthz`

Returns service health without exposing owner metadata.

### Protected routes

`GET /v1/tools` and `POST /v1/commands` require both:

```text
x-zarvis-owner-id: 4076926
x-zarvis-service-token: <matching service token>
```

Any missing or incorrect value returns `403 owner_access_denied`. Caller-supplied `x-user-id` and `x-tenant-id` values are ignored. Audit records always use:

```text
user_id: github:4076926
tenant_id: owner-4076926
```

### `POST /v1/commands`

```json
{
  "schema_version": "zarvis.command.requested.v1",
  "session_id": "session-1",
  "input": {
    "modality": "voice",
    "text": "ตรวจสถานะ GitHub cvsz/z-platform",
    "locale": "th-TH"
  }
}
```

The response includes normalized repository metadata, `speech.text` for TTS, and the immutable audit event identifier.
