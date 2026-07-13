# Agent Orchestrator

This service owns asynchronous agent-job lifecycle, approval policy, scoped worker execution, retry/cancellation, and audit correlation.

It receives only job references and scoped tool grants. It must not receive wallet signing authority, provider API keys, browser credentials, payment-card data, MPC material, or production infrastructure authority.

## Runtime

- `GET /health` reports service status. It is intentionally unauthenticated and does not expose tenant, job, or provider details.
- `POST /v1/jobs` creates an idempotent job in `pending_approval` state and emits `agent.job.requested.v1`.
- `POST /v1/jobs/:id/approve` records explicit approval, validates grants against requested grants, enqueues execution, and emits `agent.job.approved.v1`.
- `POST /v1/jobs/:id/cancel` moves non-terminal jobs to `cancelled` and emits terminal audit.
- `POST /v1/jobs/:id/retry` re-enqueues failed jobs while the retry limit allows it.
- `POST /v1/worker/run-next` executes the next approved queued job in the sandbox worker runtime.
- `GET /v1/jobs/:id` returns a submitted job.

All non-health endpoints require `Authorization: Bearer <Z_PLATFORM_SERVICE_TOKEN>`.

## Storage, queue, and audit adapters

The runtime is adapter-based:

- `MemoryJobStore` implements the durable job-store contract used by the service.
- `MemoryQueueAdapter` implements enqueue/dequeue semantics and deduplicates job attempts.
- `MemoryAuditSink` captures versioned lifecycle events for the observability pipeline boundary.
- `SandboxedWorkerRuntime` executes only approved scoped tool grants and records per-tool status.

Production deployments should replace the memory adapters with database, queue, and observability implementations that preserve the same method contracts.

## Approval policy

Requested tool grants are deny-by-default. Approval may grant only tools that were requested with the same tool name, scope, and mutability flag. Mutating jobs therefore require an explicit matching mutating grant before they can be queued or executed.

## Validation

Run `npm test` in this directory to check health reporting, service-token authorization, job creation, tenant-scoped idempotency, approval lifecycle, scoped grant rejection, queued execution, sandbox worker audit output, cancellation, retry, and job lookup.

## Current limits

The checked-in adapters are local in-memory implementations for deterministic tests and migration safety. Production still needs operator selection of the database, queue backend, observability sink, identity provider, and sandbox runtime isolation mechanism before external traffic is enabled.
