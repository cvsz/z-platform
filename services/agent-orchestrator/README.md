# Agent Orchestrator

This service owns asynchronous agent-job lifecycle, approval policy, and audit correlation.

It receives only job references and scoped tool grants. It must not receive wallet signing authority, provider API keys, browser credentials, payment-card data, MPC material, or production infrastructure authority.

## Runtime

- `GET /health` reports service status. It is intentionally unauthenticated and does not expose tenant, job, or provider details.
- `POST /v1/jobs` creates an idempotent job in `pending_approval` state.
- `POST /v1/jobs/:id/approve` records an explicit approval actor.
- `GET /v1/jobs/:id` returns a submitted job.

All non-health endpoints require `Authorization: Bearer <Z_PLATFORM_SERVICE_TOKEN>`.

## Current limits

The current implementation uses in-memory storage and does not execute workers. Durable queue storage, cancellation, retry policy, sandboxed execution, and audit export remain Phase 2 migration work.
