# Z.A.R.V.I.S. Orchestrator

The first Z.A.R.V.I.S. vertical slice converts a text or voice transcript into a strictly read-only GitHub repository status query, returns a speech-ready summary, and emits a structured audit event.

## Boundary

```text
ZARVIS Console / ZVoice
        |
        | POST /v1/commands
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

The browser never receives `GITHUB_TOKEN`. The only registered tool is `github.repository.status`; unknown or mutating tool names fail closed.

## Run

```bash
pnpm --filter @z-platform/zarvis-orchestrator start
```

Environment variables:

| Variable | Default | Purpose |
|---|---:|---|
| `PORT` | `8094` | HTTP listen port |
| `HOST` | `0.0.0.0` | HTTP listen address |
| `GITHUB_TOKEN` | unset | Optional server-side token for private repositories or higher rate limits |
| `ZARVIS_GITHUB_TIMEOUT_MS` | `5000` | GitHub request timeout |

## API

### `GET /healthz`

Returns service health.

### `GET /v1/tools`

Returns the read-only tool catalog.

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
