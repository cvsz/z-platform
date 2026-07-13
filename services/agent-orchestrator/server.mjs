import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

const defaultHost = process.env.HOST || "127.0.0.1";
const defaultPort = Number(process.env.PORT || 8500);
const TERMINAL = new Set(["succeeded", "failed", "cancelled", "expired"]);

export class AgentOrchestratorError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function authorized(request, env) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const expected = env.Z_PLATFORM_SERVICE_TOKEN;
  if (!token || !expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function body(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 100000) throw new AgentOrchestratorError("Request body is too large", 413);
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AgentOrchestratorError("Request body must be valid JSON", 400);
  }
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new AgentOrchestratorError(`${name} is required`, 400);
  return value.trim();
}

function normalizeToolGrant(value) {
  if (typeof value === "string") {
    return { tool: value, scope: "*", mutating: !/:read$|\.read$/.test(value) };
  }
  if (!value || typeof value !== "object") throw new AgentOrchestratorError("tool grant is invalid", 400);
  return {
    tool: requireString(value.tool, "tool"),
    scope: requireString(value.scope ?? "*", "scope"),
    mutating: Boolean(value.mutating),
  };
}

function normalizeToolGrants(value, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) throw new AgentOrchestratorError("tool_grants must be an array", 400);
  if (!allowEmpty && value.length === 0) throw new AgentOrchestratorError("tool_grants must not be empty", 400);
  return value.map(normalizeToolGrant);
}

function grantKey(grant) {
  return `${grant.tool}\n${grant.scope}\n${grant.mutating}`;
}

function assertApprovedGrants(requested, approved) {
  const requestedKeys = new Set(requested.map(grantKey));
  for (const grant of approved) {
    if (!requestedKeys.has(grantKey(grant))) throw new AgentOrchestratorError("approved tool grant was not requested", 400);
  }
  const mutating = approved.filter((grant) => grant.mutating);
  if (mutating.length > 0 && approved.length === 0) throw new AgentOrchestratorError("mutating jobs require explicit approval grants", 400);
}

function buildEvent(type, job, now, extra = {}) {
  return {
    event_id: randomUUID(),
    event_type: type,
    event_version: "v1",
    occurred_at: now(),
    tenant_id: job.tenant_id,
    job_id: job.id,
    correlation_id: job.correlation_id,
    ...extra,
  };
}

export class MemoryJobStore {
  constructor({ jobs = new Map() } = {}) {
    this.jobs = jobs;
  }

  async findById(id) {
    return this.jobs.get(id) || null;
  }

  async findByIdempotency(tenantId, idempotencyKey) {
    return [...this.jobs.values()].find((job) => job.tenant_id === tenantId && job.idempotency_key === idempotencyKey) || null;
  }

  async save(job) {
    this.jobs.set(job.id, structuredClone(job));
    return structuredClone(job);
  }
}

export class MemoryQueueAdapter {
  constructor() {
    this.items = [];
  }

  async enqueue(item) {
    if (this.items.some((queued) => queued.job_id === item.job_id && queued.attempt === item.attempt)) return item;
    this.items.push(structuredClone(item));
    return item;
  }

  async dequeue() {
    return this.items.shift() || null;
  }

  size() {
    return this.items.length;
  }
}

export class MemoryAuditSink {
  constructor() {
    this.events = [];
  }

  async emit(event) {
    this.events.push(structuredClone(event));
    return event;
  }
}

export class SandboxedWorkerRuntime {
  constructor({ allowedTools = {}, now = () => new Date().toISOString() } = {}) {
    this.allowedTools = allowedTools;
    this.now = now;
  }

  async execute(job) {
    const auditCalls = [];
    for (const grant of job.approved_tool_grants) {
      const implementation = this.allowedTools[grant.tool];
      if (!implementation) {
        auditCalls.push({ tool: grant.tool, scope: grant.scope, mutating: grant.mutating, status: "skipped" });
        continue;
      }
      await implementation({ job, grant });
      auditCalls.push({ tool: grant.tool, scope: grant.scope, mutating: grant.mutating, status: "succeeded" });
    }
    return {
      status: "succeeded",
      result_refs: [{ type: "agent-result", id: `${job.id}-attempt-${job.attempt}` }],
      usage: { input_tokens: 0, output_tokens: 0, runtime_ms: 0 },
      audit: { worker_id: "sandbox-worker", attempt: job.attempt, tool_calls: auditCalls },
      completed_at: this.now(),
    };
  }
}

export class AgentOrchestrator {
  constructor({ store = new MemoryJobStore(), queue = new MemoryQueueAdapter(), audit = new MemoryAuditSink(), worker = new SandboxedWorkerRuntime(), idGenerator = randomUUID, now = () => new Date().toISOString() } = {}) {
    this.store = store;
    this.queue = queue;
    this.audit = audit;
    this.worker = worker;
    this.idGenerator = idGenerator;
    this.now = now;
  }

  async submit(input) {
    const tenantId = requireString(input.tenant_id, "tenant_id");
    const objective = requireString(input.objective ?? input.task, "task");
    const idempotencyKey = requireString(input.idempotency_key, "idempotency_key");
    const duplicate = await this.store.findByIdempotency(tenantId, idempotencyKey);
    if (duplicate) return { status: 200, job: duplicate };

    const job = {
      id: this.idGenerator(),
      tenant_id: tenantId,
      objective,
      task: objective,
      requested_tool_grants: normalizeToolGrants(input.tool_grants_requested ?? input.tool_grants),
      tool_grants: normalizeToolGrants(input.tool_grants_requested ?? input.tool_grants),
      input_refs: Array.isArray(input.input_refs) ? input.input_refs : [],
      status: "pending_approval",
      approval_state: "pending",
      idempotency_key: idempotencyKey,
      correlation_id: input.correlation_id,
      attempt: 0,
      max_retries: Number(input.max_retries ?? input.execution_policy?.max_retries ?? 1),
      timeout_seconds: Number(input.timeout_seconds ?? input.execution_policy?.timeout_seconds ?? 900),
      created_at: this.now(),
      updated_at: this.now(),
    };
    const saved = await this.store.save(job);
    await this.audit.emit(buildEvent("agent.job.requested.v1", saved, this.now, {
      requested_by: input.requested_by ?? { type: "service", id: "agent-orchestrator" },
      objective: saved.objective,
      input_refs: saved.input_refs,
      tool_grants_requested: saved.requested_tool_grants,
      execution_policy: { requires_approval: true, timeout_seconds: saved.timeout_seconds, max_retries: saved.max_retries },
    }));
    return { status: 202, job: saved };
  }

  async approve(id, input) {
    const job = await this.get(id);
    if (job.status !== "pending_approval") throw new AgentOrchestratorError("Job is not awaiting approval", 409);
    const approvedBy = requireString(input.approved_by, "approved_by");
    const grants = normalizeToolGrants(input.tool_grants ?? job.requested_tool_grants);
    assertApprovedGrants(job.requested_tool_grants, grants);
    const next = await this.store.save({
      ...job,
      status: "approved",
      approval_state: "approved",
      approved_by: approvedBy,
      approved_at: this.now(),
      approved_tool_grants: grants,
      constraints: {
        sandbox: input.constraints?.sandbox ?? "restricted",
        network: input.constraints?.network ?? "deny-by-default",
        timeout_seconds: Number(input.constraints?.timeout_seconds ?? job.timeout_seconds),
        max_retries: Number(input.constraints?.max_retries ?? job.max_retries),
      },
      updated_at: this.now(),
    });
    await this.queue.enqueue({ job_id: next.id, tenant_id: next.tenant_id, attempt: next.attempt + 1, enqueued_at: this.now() });
    await this.audit.emit(buildEvent("agent.job.approved.v1", next, this.now, {
      approved_by: { type: "user", id: approvedBy },
      approval_state: "approved",
      tool_grants: grants.map((grant) => ({ ...grant, expires_at: input.expires_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString() })),
      constraints: next.constraints,
    }));
    return next;
  }

  async get(id) {
    const job = await this.store.findById(id);
    if (!job) throw new AgentOrchestratorError("Job not found", 404);
    return job;
  }

  async cancel(id, input = {}) {
    const job = await this.get(id);
    if (TERMINAL.has(job.status)) throw new AgentOrchestratorError("Job is already terminal", 409);
    const next = await this.store.save({ ...job, status: "cancelled", cancelled_by: input.cancelled_by, cancelled_at: this.now(), updated_at: this.now() });
    await this.audit.emit(buildEvent("agent.job.completed.v1", next, this.now, {
      status: "cancelled",
      audit: { worker_id: "agent-orchestrator", attempt: next.attempt, tool_calls: [] },
    }));
    return next;
  }

  async retry(id) {
    const job = await this.get(id);
    if (job.status !== "failed") throw new AgentOrchestratorError("Only failed jobs can be retried", 409);
    if (job.attempt >= job.max_retries + 1) throw new AgentOrchestratorError("Retry limit exceeded", 409);
    const next = await this.store.save({ ...job, status: "approved", updated_at: this.now() });
    await this.queue.enqueue({ job_id: next.id, tenant_id: next.tenant_id, attempt: next.attempt + 1, enqueued_at: this.now() });
    return next;
  }

  async runNext() {
    const item = await this.queue.dequeue();
    if (!item) return null;
    const job = await this.get(item.job_id);
    if (job.status !== "approved") return job;
    const running = await this.store.save({ ...job, status: "running", attempt: item.attempt, started_at: this.now(), updated_at: this.now() });
    try {
      const result = await this.worker.execute(running);
      const completed = await this.store.save({ ...running, ...result, status: result.status, updated_at: this.now() });
      await this.audit.emit(buildEvent("agent.job.completed.v1", completed, this.now, {
        status: completed.status,
        result_refs: completed.result_refs,
        usage: completed.usage,
        audit: completed.audit,
      }));
      return completed;
    } catch (error) {
      const failed = await this.store.save({
        ...running,
        status: "failed",
        error: { code: "WORKER_FAILED", message: error?.message || "Worker failed" },
        audit: { worker_id: "sandbox-worker", attempt: running.attempt, tool_calls: [] },
        updated_at: this.now(),
      });
      await this.audit.emit(buildEvent("agent.job.completed.v1", failed, this.now, {
        status: "failed",
        error: failed.error,
        audit: failed.audit,
      }));
      return failed;
    }
  }
}

export function createAgentOrchestratorServer({ env = process.env, orchestrator, jobs, idGenerator = randomUUID, now = () => new Date().toISOString() } = {}) {
  const service = orchestrator || new AgentOrchestrator({ store: new MemoryJobStore({ jobs }), idGenerator, now });
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, { status: "ok", service: "agent-orchestrator", storage: "adapter", execution_enabled: true });
    }

    if (!authorized(request, env)) return json(response, 401, { error: "Unauthorized" });

    try {
      if (request.method === "POST" && request.url === "/v1/jobs") {
        const result = await service.submit(await body(request));
        return json(response, result.status, result.job);
      }

      const approve = request.url?.match(/^\/v1\/jobs\/([^/]+)\/approve$/);
      if (request.method === "POST" && approve) return json(response, 200, await service.approve(approve[1], await body(request)));

      const cancel = request.url?.match(/^\/v1\/jobs\/([^/]+)\/cancel$/);
      if (request.method === "POST" && cancel) return json(response, 200, await service.cancel(cancel[1], await body(request)));

      const retry = request.url?.match(/^\/v1\/jobs\/([^/]+)\/retry$/);
      if (request.method === "POST" && retry) return json(response, 200, await service.retry(retry[1]));

      if (request.method === "POST" && request.url === "/v1/worker/run-next") return json(response, 200, await service.runNext() ?? { status: "idle" });

      const get = request.url?.match(/^\/v1\/jobs\/([^/]+)$/);
      if (request.method === "GET" && get) return json(response, 200, await service.get(get[1]));

      return json(response, 404, { error: "Not found" });
    } catch (error) {
      const status = error instanceof AgentOrchestratorError ? error.status : 400;
      return json(response, status, { error: error instanceof Error ? error.message : "Invalid request" });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAgentOrchestratorServer().listen(defaultPort, defaultHost, () => {
    console.log("agent-orchestrator listening on http://" + defaultHost + ":" + defaultPort);
  });
}
