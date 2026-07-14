# zctl

`zctl` is the guarded Docker Compose lifecycle and source-control CLI for `z-platform`.

Implemented commands:

- `start`, including `--service`, `--build`, and `--wait`
- `stop`, preserving data by default
- `restart`, including `--recreate` and `--wait`
- `build`, including `--service`, `--no-cache`, `--pull`, `--push`, and SBOM generation
- `update`, using fetch plus fast-forward-only merge
- `status`, `health`, `logs`, `doctor`, and `version`

Safety controls:

- operation locking under `.zctl/operation.lock`
- mode-0600 JSON audit records under `.zctl/audit`
- service allow-list validation through `docker compose config --services`
- dirty-tree rejection for build and update
- no reset, clean, rebase, or force-push operations
- staging and production reject local image builds and destructive purge
- OCI revision, source, created, and version labels on service images
- SPDX JSON SBOM output under `.zctl/sbom`

Build and test:

```bash
cd tools/zctl
go test ./...
go vet ./...
go build -o ../../bin/zctl ./cmd/zctl
```

Examples:

```bash
bin/zctl doctor
bin/zctl start --profile local --wait
bin/zctl build --service ai-gateway --pull
bin/zctl build --no-cache
bin/zctl update --branch main --dry-run
bin/zctl update --branch main
bin/zctl update --branch main --restart
bin/zctl health --json
bin/zctl logs --service ai-gateway --follow
bin/zctl stop --profile local --purge --confirm-destroy
```

`build` requires a clean Git tree. By default it also requires `syft` and writes one SPDX JSON SBOM per Compose image. Use `--skip-sbom` only for explicitly accepted local development workflows.

`update` performs:

```text
verify clean tree
→ git fetch --prune origin <branch>
→ verify remote is a descendant of HEAD
→ git merge --ff-only origin/<branch>
→ frozen dependency synchronization
→ optional Compose rebuild/restart
```

`--stash` is available for operator-requested temporary stashing. The stash is restored after the operation. Database migration, governed release upgrade, backup, and rollback remain Phase 3 scope.
