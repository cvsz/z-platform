import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const defaultHost = process.env.HOST || "127.0.0.1";
const defaultPort = Number(process.env.PORT || 3021);

function send(response, status, body, type = "application/json; charset=utf-8", headers = {}) {
  response.writeHead(status, { "Content-Type": type, ...headers });
  response.end(body);
}

async function json(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 100000) throw new Error("Request too large");
  }
  return JSON.parse(text);
}

function gatewayUrl(baseUrl, path) {
  const base = baseUrl.replace(/\/$/, "");
  return base.endsWith("/v1") ? base + path : base + "/v1" + path;
}

function tenantId(request) {
  const value = request.headers["x-tenant-id"];
  return typeof value === "string" && value.trim() ? value.trim() : "anonymous";
}

function sessionExpired(request, env) {
  const ttl = Number(env.ZCHAT_SESSION_TTL_SECONDS || 0);
  if (!ttl) return false;
  const started = Number(request.headers["x-session-started-at"] || 0);
  return !started || Date.now() - started > ttl * 1000;
}

function gatewayHeaders(env, request, conversationId = randomUUID()) {
  return {
    Authorization: "Bearer " + env.Z_PLATFORM_SERVICE_TOKEN,
    "Content-Type": "application/json",
    "X-Tenant-Id": tenantId(request),
    "X-Conversation-Id": conversationId,
    "X-Usage-Correlation-Id": request.headers["x-usage-correlation-id"] || conversationId,
    "X-Request-Id": request.headers["x-request-id"] || randomUUID(),
  };
}

export async function models(env = process.env, fetchImpl = fetch) {
  const url = env.Z_PLATFORM_AI_GATEWAY_URL?.trim();
  const token = env.Z_PLATFORM_SERVICE_TOKEN;
  if (!url || !token) throw new Error("AI gateway is not configured");
  const result = await fetchImpl(gatewayUrl(url, "/models"), {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(60000),
  });
  if (!result.ok) throw new Error("AI gateway rejected the model catalog request");
  return result.json();
}

export async function chat(body, env = process.env, fetchImpl = fetch, request = { headers: {} }) {
  const url = env.Z_PLATFORM_AI_GATEWAY_URL?.trim();
  const token = env.Z_PLATFORM_SERVICE_TOKEN;
  if (!url || !token) throw new Error("AI gateway is not configured");
  if (sessionExpired(request, env)) throw new Error("Session expired");
  if (typeof body.prompt !== "string" || !body.prompt.trim()) throw new Error("Prompt is required");

  const conversationId = typeof body.conversation_id === "string" && body.conversation_id.trim() ? body.conversation_id.trim() : randomUUID();
  const result = await fetchImpl(gatewayUrl(url, "/chat/completions"), {
    method: "POST",
    headers: gatewayHeaders(env, request, conversationId),
    body: JSON.stringify({
      model: typeof body.model === "string" && body.model ? body.model : "default",
      messages: [{ role: "user", content: body.prompt.trim() }],
      stream: false,
      metadata: {
        z_platform: {
          tenant_id: tenantId(request),
          conversation_id: conversationId,
          usage_correlation_id: request.headers["x-usage-correlation-id"] || conversationId,
        },
      },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!result.ok) throw new Error("AI gateway rejected the request");

  const payload = await result.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Unsupported AI gateway response");
  return { content, conversation_id: conversationId };
}

export async function chatStream(body, env = process.env, fetchImpl = fetch, request = { headers: {} }) {
  const url = env.Z_PLATFORM_AI_GATEWAY_URL?.trim();
  const token = env.Z_PLATFORM_SERVICE_TOKEN;
  if (!url || !token) throw new Error("AI gateway is not configured");
  if (sessionExpired(request, env)) throw new Error("Session expired");
  if (typeof body.prompt !== "string" || !body.prompt.trim()) throw new Error("Prompt is required");

  const conversationId = typeof body.conversation_id === "string" && body.conversation_id.trim() ? body.conversation_id.trim() : randomUUID();
  const result = await fetchImpl(gatewayUrl(url, "/chat/completions"), {
    method: "POST",
    headers: gatewayHeaders(env, request, conversationId),
    body: JSON.stringify({
      model: typeof body.model === "string" && body.model ? body.model : "default",
      messages: [{ role: "user", content: body.prompt.trim() }],
      stream: true,
      metadata: {
        z_platform: {
          tenant_id: tenantId(request),
          conversation_id: conversationId,
          usage_correlation_id: request.headers["x-usage-correlation-id"] || conversationId,
        },
      },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!result.ok || !result.body) throw new Error("AI gateway rejected the stream request");
  return { stream: result.body, conversation_id: conversationId };
}

export function createZChatServer({ env = process.env, fetchImpl = fetch } = {}) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        return send(response, 200, JSON.stringify({
          status: "ok",
          service: "zchat",
          gateway_configured: Boolean(env.Z_PLATFORM_AI_GATEWAY_URL && env.Z_PLATFORM_SERVICE_TOKEN),
          session_ttl_seconds: Number(env.ZCHAT_SESSION_TTL_SECONDS || 0),
        }));
      }
      if (request.method === "GET" && request.url === "/api/models") {
        return send(response, 200, JSON.stringify(await models(env, fetchImpl)));
      }
      if (request.method === "POST" && request.url === "/api/chat") {
        return send(response, 200, JSON.stringify(await chat(await json(request), env, fetchImpl, request)));
      }
      if (request.method === "POST" && request.url === "/api/chat/stream") {
        const { stream, conversation_id } = await chatStream(await json(request), env, fetchImpl, request);
        response.writeHead(200, {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream; charset=utf-8",
          "X-Conversation-Id": conversation_id,
        });
        return stream.pipeTo(new WritableStream({
          write(chunk) { response.write(chunk); },
          close() { response.end(); },
          abort(error) { response.destroy(error); },
        }));
      }
      if (request.method === "POST" && request.url === "/api/logout") {
        return send(response, 200, JSON.stringify({ status: "logged_out" }), "application/json; charset=utf-8", { "Clear-Site-Data": '"storage"' });
      }
      if (request.method === "GET" && request.url === "/") {
        return send(response, 200, await readFile(new URL("./public/index.html", import.meta.url)), "text/html; charset=utf-8");
      }
      if (request.method === "GET" && request.url === "/app.js") {
        return send(response, 200, await readFile(new URL("./public/app.js", import.meta.url)), "text/javascript; charset=utf-8");
      }
      if (request.method === "GET" && request.url === "/styles.css") {
        return send(response, 200, await readFile(new URL("./public/styles.css", import.meta.url)), "text/css; charset=utf-8");
      }
      return send(response, 404, JSON.stringify({ error: "Not found" }));
    } catch (error) {
      return send(response, 400, JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createZChatServer().listen(defaultPort, defaultHost, () => {
    console.log("zchat listening on http://" + defaultHost + ":" + defaultPort);
  });
}
