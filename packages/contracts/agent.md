# Agent Job Contracts v1

## agent.job.requested.v1

```json
{"id":"string","tenant_id":"string","task":"string","tool_grants":["read_project"],"idempotency_key":"string"}
```

A job starts in `pending_approval`. Tool grants must be explicit and are deny-by-default.

## agent.job.approved.v1

```json
{"id":"string","approved_by":"string","approved_at":"RFC3339 timestamp"}
```

Approval permits execution only when a separately configured worker and durable queue are available.

## agent.job.completed.v1

```json
{"id":"string","status":"completed|failed|cancelled","audit_correlation_id":"string"}
```
