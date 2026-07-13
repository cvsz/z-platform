import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

const defaultHost = process.env.HOST || "127.0.0.1";
const defaultPort = Number(process.env.PORT || 8500);

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
    if (text.length > 100000) throw new Error("Request body is too large");
  }
  return JSON.parse(text);
}

export function createAgentOrchestratorServer({ env = process.env, jobs = new Map(), idGenerator = randomUUID, now = () => new Date().toISOString() } = {}) {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, { status: "ok", service: "agent-orchestrator", storage: "memory", execution_enabled: false });
    }

    if (!authorized(request, env)) return json(response, 401, { error: "Unauthorized" });

    try {
      if (request.method === "POST" && request.url === "/v1/jobs") {
        const input = await body(request);
        if (typeof input.tenant_id !== "string" || typeof input.task !== "string" || !input.task.trim() || !Array.isArray(input.tool_grants) || typeof input.idempotency_key !== "string") {
          return json(response, 400, { error: "Invalid job request" });
        }

        const duplicate = [...jobs.values()].find((job) => job.tenant_id === input.tenant_id && job.idempotency_key === input.idempotency_key);
        if (duplicate) return json(response, 200, duplicate);

        const job = {
          id: idGenerator(),
          tenant_id: input.tenant_id,
          task: input.task,
          tool_grants: input.tool_grants,
          status: "pending_approval",
          idempotency_key: input.idempotency_key,
          created_at: now(),
        };
        jobs.set(job.id, job);
        return json(response, 202, job);
      }

      const approve = request.url?.match(/^\/v1\/jobs\/([^/]+)\/approve$/);
      if (request.method === "POST" && approve) {
        const job = jobs.get(approve[1]);
        if (!job) return json(response, 404, { error: "Job not found" });
        if (job.status !== "pending_approval") return json(response, 409, { error: "Job is not awaiting approval" });

        const input = await body(request);
        if (typeof input.approved_by !== "string" || !input.approved_by.trim()) return json(response, 400, { error: "approved_by is required" });
        Object.assign(job, { status: "approved", approved_by: input.approved_by, approved_at: now() });
        return json(response, 200, job);
      }

      const get = request.url?.match(/^\/v1\/jobs\/([^/]+)$/);
      if (request.method === "GET" && get) {
        const job = jobs.get(get[1]);
        return job ? json(response, 200, job) : json(response, 404, { error: "Job not found" });
      }

      return json(response, 404, { error: "Not found" });
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : "Invalid request" });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAgentOrchestratorServer().listen(defaultPort, defaultHost, () => {
    console.log("agent-orchestrator listening on http://" + defaultHost + ":" + defaultPort);
  });
}
