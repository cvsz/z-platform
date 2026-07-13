import assert from "node:assert/strict";

const token = process.env.Z_PLATFORM_SERVICE_TOKEN;
if (!token) throw new Error("Z_PLATFORM_SERVICE_TOKEN is required");

// Smoke tests run from the host/CI runner, not from the Compose network.
// Keep these endpoint overrides separate from service-to-service variables such
// as BILLING_LEDGER_URL, which may legitimately contain Docker DNS names.
const bases = {
  gateway: process.env.STAGING_SMOKE_AI_GATEWAY_URL || "http://127.0.0.1:8400",
  agent: process.env.STAGING_SMOKE_AGENT_ORCHESTRATOR_URL || "http://127.0.0.1:8500",
  workspace: process.env.STAGING_SMOKE_WORKSPACE_RUNTIME_URL || "http://127.0.0.1:8600",
  billing: process.env.STAGING_SMOKE_BILLING_LEDGER_URL || "http://127.0.0.1:8700",
  provider: process.env.STAGING_SMOKE_AGENT_PROVIDER_URL || "http://127.0.0.1:8800",
};

async function request(base, path, { method = "GET", body, auth = true, expected } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (expected !== undefined) assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${text}`);
  return { status: response.status, payload };
}

for (const [name, base] of Object.entries(bases)) {
  const { payload } = await request(base, "/health", { auth: false, expected: 200 });
  assert.equal(payload.status, "ok", `${name} health must be ok`);
}

// Authentication and approval boundaries.
await request(bases.workspace, "/v1/shell", { method: "POST", auth: false, body: {}, expected: 401 });
await request(bases.workspace, "/v1/shell", { method: "POST", body: { command: "pwd" }, expected: 403 });
await request(bases.workspace, "/v1/deploy", { method: "POST", body: { target: "staging" }, expected: 403 });
const shell = await request(bases.workspace, "/v1/shell", {
  method: "POST",
  body: { command: "pwd", approval: { state: "approved", grants: ["shell"] } },
  expected: 202,
});
assert.equal(shell.payload.status, "accepted");

// Billing usage idempotency and duplicate rejection semantics.
const usageKey = `smoke-${Date.now()}`;
const usage = {
  usage_id: usageKey,
  idempotency_key: usageKey,
  tenant_id: "readiness-smoke",
  subject_id: "ci",
  model: "smoke/model",
  input_tokens: 1,
  output_tokens: 1,
};
const firstUsage = await request(bases.billing, "/v1/usage", { method: "POST", body: usage, expected: 201 });
assert.equal(firstUsage.payload.duplicate, false);
const duplicateUsage = await request(bases.billing, "/v1/usage", { method: "POST", body: usage, expected: 200 });
assert.equal(duplicateUsage.payload.duplicate, true);
assert.equal(duplicateUsage.payload.record.usage_id, usageKey);

// Durable agent lifecycle: submit, idempotent submit, approve, execute and audit.
const idempotencyKey = `agent-${Date.now()}`;
const submitted = await request(bases.agent, "/v1/jobs", {
  method: "POST",
  body: {
    tenant_id: "readiness-smoke",
    task: "Validate readiness lifecycle",
    idempotency_key: idempotencyKey,
    tool_grants: [{ tool: "workspace.read", scope: "*", mutating: false }],
    requested_by: { type: "service", id: "readiness-smoke" },
  },
  expected: 202,
});
assert.equal(submitted.payload.status, "pending_approval");
const jobId = submitted.payload.id;

const duplicateSubmit = await request(bases.agent, "/v1/jobs", {
  method: "POST",
  body: {
    tenant_id: "readiness-smoke",
    task: "Validate readiness lifecycle",
    idempotency_key: idempotencyKey,
    tool_grants: [{ tool: "workspace.read", scope: "*", mutating: false }],
  },
  expected: 200,
});
assert.equal(duplicateSubmit.payload.id, jobId);

const approved = await request(bases.agent, `/v1/jobs/${jobId}/approve`, {
  method: "POST",
  body: {
    approved_by: "readiness-reviewer",
    tool_grants: [{ tool: "workspace.read", scope: "*", mutating: false }],
    constraints: { sandbox: "restricted", network: "deny-by-default" },
  },
  expected: 200,
});
assert.equal(approved.payload.status, "approved");

const executed = await request(bases.agent, "/v1/worker/run-next", { method: "POST", body: {}, expected: 200 });
assert.equal(executed.payload.id, jobId);
assert.equal(executed.payload.status, "succeeded");

const fetched = await request(bases.agent, `/v1/jobs/${jobId}`, { expected: 200 });
assert.equal(fetched.payload.status, "succeeded");
const events = await request(bases.provider, "/events", { expected: 200 });
const jobEvents = events.payload.events.filter((event) => event.job_id === jobId).map((event) => event.event_type);
assert.deepEqual(jobEvents, ["agent.job.requested.v1", "agent.job.approved.v1", "agent.job.completed.v1"]);

// Durable workspace metadata, cleanup and backup/restore.
const workspaceId = `workspace-${Date.now()}`;
await request(bases.provider, `/workspaces/${workspaceId}`, {
  method: "PUT",
  body: { tenant_id: "readiness-smoke", status: "active" },
  expected: 200,
});
const workspace = await request(bases.provider, `/workspaces/${workspaceId}`, { expected: 200 });
assert.equal(workspace.payload.tenant_id, "readiness-smoke");
const backup = await request(bases.provider, "/backup/export", { expected: 200 });
assert.ok(backup.payload.workspaces[workspaceId]);
await request(bases.provider, "/backup/restore", { method: "POST", body: backup.payload, expected: 200 });
const restored = await request(bases.provider, `/workspaces/${workspaceId}`, { expected: 200 });
assert.equal(restored.payload.status, "active");

const metrics = await request(bases.provider, "/metrics", { auth: false, expected: 200 });
assert.match(metrics.payload, /z_platform_agent_jobs_total/);
assert.match(metrics.payload, /z_platform_agent_audit_events_total/);

console.log(JSON.stringify({
  status: "passed",
  services: Object.keys(bases),
  checks: [
    "health",
    "authentication",
    "workspace-approval-denial",
    "billing-idempotency",
    "agent-submit-idempotency-approve-execute-audit",
    "workspace-metadata",
    "backup-export-restore",
    "metrics",
  ],
  job_id: jobId,
  workspace_id: workspaceId,
}, null, 2));
