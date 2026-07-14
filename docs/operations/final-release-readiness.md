# Final release readiness

`final-release-readiness.yml` is the only workflow allowed to close Issue #1 automatically.

It is fail-closed and binds all completion evidence to one immutable release SHA:

1. checks out the requested SHA;
2. materializes protected staging configuration and deployed browser evidence;
3. enforces real-only input policy;
4. executes all fourteen Phase 6 checks;
5. requires `VERIFIED`, exactly fourteen checks, and a matching release SHA;
6. uploads and attests staging evidence;
7. enters the protected `production` environment for explicit approval;
8. uploads and attests production approval evidence;
9. comments on and closes the configured readiness issue only after both jobs succeed.

The workflow cannot manufacture endpoints, credentials, backup operations, browser artifacts, or human QA. Missing or non-real inputs stop execution before finalization.

Run only from `main` after all staging environment secrets and variables are configured:

```bash
gh workflow run final-release-readiness.yml \
  --repo cvsz/z-platform \
  --ref main \
  -f release_sha="$(git rev-parse origin/main)" \
  -f issue_number=1
```

Production traffic enablement remains a separate deployment action. Closing the readiness issue records approval and evidence; it does not itself alter routing or deploy workloads.
