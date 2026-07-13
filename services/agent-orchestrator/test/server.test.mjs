import assert from "node:assert/strict";
import test from "node:test";

import { createAgentOrchestratorServer } from "../server.mjs";

const env = { Z_PLATFORM_SERVICE_TOKEN: "service-token" };

async function request(server, path, options = {}) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, options);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function authHeaders(extra = {}) {
  return { Authorization: "Bearer service-token", "Content-Type": "application/json", ...extra };
}

function testServer() {
  let nextId = 1;
  return createAgentOrchestratorServer({
    env,
    idGenerator: () => `job-${nextId++}`,
    now: () => "2026-07-13T00:00:00.000Z",
  });
}

test("health reports runtime status without auth", async () => {
  const response = await request(testServer(), "/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "agent-orchestrator",
    storage: "memory",
    execution_enabled: false,
  });
});

test("job routes require service token", async () => {
  const response = await request(testServer(), "/v1/jobs", {
    method: "POST",
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("creates pending approval jobs", async () => {
  const response = await request(testServer(), "/v1/jobs", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      tenant_id: "tenant-1",
      task: "run migration check",
      tool_grants: ["github:read"],
      idempotency_key: "idem-1",
    }),
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    id: "job-1",
    tenant_id: "tenant-1",
    task: "run migration check",
    tool_grants: ["github:read"],
    status: "pending_approval",
    idempotency_key: "idem-1",
    created_at: "2026-07-13T00:00:00.000Z",
  });
});

test("returns duplicate job for same tenant and idempotency key", async () => {
  const server = testServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const payload = {
      tenant_id: "tenant-1",
      task: "run migration check",
      tool_grants: ["github:read"],
      idempotency_key: "idem-1",
    };
    const first = await fetch(`http://127.0.0.1:${port}/v1/jobs`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const second = await fetch(`http://127.0.0.1:${port}/v1/jobs`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...payload, task: "different task" }),
    });
    const firstJob = await first.json();
    const secondJob = await second.json();

    assert.equal(first.status, 202);
    assert.equal(second.status, 200);
    assert.deepEqual(secondJob, firstJob);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("approves pending jobs and prevents duplicate approval", async () => {
  const server = testServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const created = await fetch(`http://127.0.0.1:${port}/v1/jobs`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-1",
        task: "run migration check",
        tool_grants: ["github:read"],
        idempotency_key: "idem-1",
      }),
    });
    const job = await created.json();

    const approved = await fetch(`http://127.0.0.1:${port}/v1/jobs/${job.id}/approve`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ approved_by: "operator-1" }),
    });
    assert.equal(approved.status, 200);
    assert.deepEqual(await approved.json(), {
      ...job,
      status: "approved",
      approved_by: "operator-1",
      approved_at: "2026-07-13T00:00:00.000Z",
    });

    const duplicate = await fetch(`http://127.0.0.1:${port}/v1/jobs/${job.id}/approve`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ approved_by: "operator-2" }),
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: "Job is not awaiting approval" });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("fetches jobs by id", async () => {
  const server = testServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const created = await fetch(`http://127.0.0.1:${port}/v1/jobs`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: "tenant-1",
        task: "run migration check",
        tool_grants: [],
        idempotency_key: "idem-1",
      }),
    });
    const job = await created.json();

    const fetched = await fetch(`http://127.0.0.1:${port}/v1/jobs/${job.id}`, { headers: authHeaders() });
    assert.equal(fetched.status, 200);
    assert.deepEqual(await fetched.json(), job);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
