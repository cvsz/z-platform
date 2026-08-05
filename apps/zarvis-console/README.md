# Z.A.R.V.I.S. Console

A browser command center for the first Z.A.R.V.I.S. vertical slice.

- Accepts typed commands and optional browser speech recognition.
- Sends only the transcript and session metadata to the same-origin console server.
- Proxies requests to `services/zarvis-orchestrator`.
- Uses browser speech synthesis for the speech-ready response.
- Displays the repository result and audit event identifier.
- Never exposes `GITHUB_TOKEN` or provider credentials to browser JavaScript.

## Run

Start the orchestrator first, then the console:

```bash
pnpm --filter @z-platform/zarvis-orchestrator start
ZARVIS_ORCHESTRATOR_URL=http://127.0.0.1:8094 \
  pnpm --filter @z-platform/zarvis-console start
```

Open `http://127.0.0.1:8095`.

Browser speech recognition is an optional convenience. Typed commands remain the deterministic supported path, and browser audio is not uploaded by this application.
