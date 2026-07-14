# Phase 6 external verification suite

This suite executes the fourteen external and human-verification gates required by Issue #1. It does not synthesize or infer successful evidence.

## GitHub Environment configuration

The `staging` environment must define:

- Secret `PHASE6_EXTERNAL_SUITE_CONFIG_JSON`: completed configuration based on `docs/operations/phase6-external-suite.example.json`.
- Optional secret `STAGING_BEARER_TOKEN`: bearer credential used by configured HTTPS probes.
- Variable `STAGING_REVIEWER`: GitHub login of the accountable staging reviewer.

Do not commit the completed configuration when it contains private staging URLs, request bodies, or operational details.

## Verification modes

- `probe`: performs a real HTTPS request and verifies status and optional response text.
- `command`: executes a repository-controlled verification command. Exit code zero is required. Evidence stores command/output digests, not command output.
- `scan`: reads the configured bundle or HAR files and rejects credential identifiers and configured forbidden patterns.
- `attestation`: accepts an external verification only with an explicit reviewer and a non-placeholder evidence reference.
- Human checks (`zchat.keyboard`, `zchat.screen_reader`, `zchat.responsive`) require reviewer identity, timestamp, evidence reference, and substantive notes.

## Required checks

1. Observability dashboard
2. Distributed traces
3. Alert delivery
4. External backup restore
5. AI streaming
6. AI upload/file proxy
7. Multi-provider
8. Quota/failover
9. Browser bundle scan
10. HAR/network scan
11. Keyboard QA
12. Screen-reader QA
13. Responsive device QA
14. External session-provider QA

## Execution

Set the protected configuration:

```bash
gh secret set PHASE6_EXTERNAL_SUITE_CONFIG_JSON \
  --repo cvsz/z-platform \
  --env staging \
  < /secure/phase6-external-suite.json
```

Dispatch against one immutable release SHA:

```bash
gh workflow run phase6-external-suite.yml \
  --repo cvsz/z-platform \
  --ref main \
  -f release_sha="$(git rev-parse origin/main)"
```

The workflow uploads and attests `phase6-external-evidence-<release-sha>`. A successful workflow is valid only for the exact checked-out SHA.

## Safety properties

- HTTPS is mandatory for probes.
- Placeholder evidence is rejected.
- Probe endpoints are represented in evidence only by an origin fingerprint.
- Command output is represented only by SHA-256 digests.
- Human QA cannot be auto-verified.
- Production traffic and production approval remain separate gates.
