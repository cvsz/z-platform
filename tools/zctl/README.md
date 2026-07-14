# zctl

`zctl` is the guarded Docker Compose lifecycle CLI for `z-platform`.

Phase 1 implements:

- `start`, including `--service`, `--build`, and `--wait`
- `stop`, preserving data by default
- `restart`, including `--recreate` and `--wait`
- `status`, `health`, `logs`, `doctor`, and `version`
- operation locking under `.zctl/operation.lock`
- mode-0600 JSON audit records under `.zctl/audit`
- service allow-list validation through `docker compose config --services`
- profile-based destructive-operation guards

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
bin/zctl start --service ai-gateway --build
bin/zctl health --json
bin/zctl logs --service ai-gateway --follow
bin/zctl restart --service agent-orchestrator --wait
bin/zctl stop
bin/zctl stop --profile local --purge --confirm-destroy
```

Staging and production profiles reject purge. Phase 1 intentionally excludes Git update, dependency synchronization, database migration, and release upgrade operations.
