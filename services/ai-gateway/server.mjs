import { createServer } from "node:http";
import { Readable } from "node:stream";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

const defaultHost = process.env.HOST || "127.0.0.1";
const defaultPort = Number(process.env.PORT || 8400);
const maxRequestBytes = 10 * 1024 * 1024;
const upstreamTimeoutMs = 60_000;
const maxAttachments = 20;

function sendJson(response, status, payload, requestId) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...(requestId ? { "X-Request-Id": requestId } : {}),
  });
  response.end(JSON.stringify(payload));
}

function errorPayload(code, message, requestId) {
  return { error: message, code, request_id: requestId };
}

function audit(logger, event) {
  logger.info(JSON.stringify({ ts: new Date().toISOString(), service: "ai-gateway", ...event }));
}

function authorized(request, env) {
  const expected = env.Z_PLATFORM_SERVICE_TOKEN;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxRequestBytes) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function upstreamUrl(baseUrl, path) {
  const base = baseUrl.replace(/\/$/, "");
  const upstreamPath = base.endsWith("/v1") && path.startsWith("/v1/") ? path.slice(3) : path;
  return base + upstreamPath;
}

function linkedAbortSignal(sourceSignal, timeoutMs = upstreamTimeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!sourceSignal) return timeoutSignal;
  return AbortSignal.any([sourceSignal, timeoutSignal]);
}

function requestAbortSignal(request) {
  const controller = new AbortController();
  request.on("aborted", () => controller.abort("client_aborted"));
  request.on("close", () => {
    if (!request.complete) controller.abort("client_closed");
  });
  return controller.signal;
}

function isAbortError(error, signal) {
  return signal?.aborted || error?.name === "AbortError";
}

function parseJsonBuffer(buffer) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Chat request body must be valid JSON"), { code: "invalid_json" });
  }
}

function validateAttachments(attachments) {
  if (attachments === undefined) return [];
  if (!Array.isArray(attachments)) throw Object.assign(new Error("attachments must be an array"), { code: "invalid_attachments" });
  if (attachments.length > maxAttachments) throw Object.assign(new Error("too many attachments"), { code: "invalid_attachments" });
  return attachments.map((attachment) => {
    if (!attachment || typeof attachment !== "object" || typeof attachment.id !== "string" || !attachment.id.trim() || typeof attachment.name !== "string" || !attachment.name.trim()) {
      throw Object.assign(new Error("attachments require id and name"), { code: "invalid_attachments" });
    }
    return { id: attachment.id.trim(), name: attachment.name.trim() };
  });
}

function appendAttachmentContext(messages, attachments) {
  if (attachments.length === 0) return messages;
  const lines = attachments.map((attachment) => `- ${attachment.name} (${attachment.id})`).join("\n");
  const suffix = `\n\nAttached platform files:\n${lines}`;
  const copy = messages.map((message) => ({ ...message }));
  for (let index = copy.length - 1; index >= 0; index -= 1) {
    if (copy[index]?.role === "user" && typeof copy[index].content === "string") {
      copy[index].content += suffix;
      return copy;
    }
  }
  return [...copy, { role: "user", content: `Attached platform files:\n${lines}` }];
}

export function translateChatPayload(buffer, contentType = "application/json") {
  if (!contentType.includes("application/json")) return buffer;
  const payload = parseJsonBuffer(buffer);
  const attachments = validateAttachments(payload.attachments);
  if (attachments.length === 0) return buffer;
  const translated = {
    ...payload,
    messages: appendAttachmentContext(Array.isArray(payload.messages) ? payload.messages : [], attachments),
    metadata: {
      ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
      z_platform: {
        ...((payload.metadata?.z_platform && typeof payload.metadata.z_platform === "object") ? payload.metadata.z_platform : {}),
        attachments,
      },
    },
  };
  delete translated.attachments;
  return Buffer.from(JSON.stringify(translated));
}

export async function upstream(path, request, body, env = process.env, fetchImpl = fetch, requestId = randomUUID(), signal) {
  const base = env.UPSTREAM_BASE_URL?.trim();
  const key = env.UPSTREAM_API_KEY;
  if (!base || !key) throw new Error("Gateway upstream is not configured");
  const contentType = request.headers["content-type"] || "application/json";
  const upstreamBody = path === "/v1/chat/completions" ? translateChatPayload(body, contentType) : body;
  return fetchImpl(upstreamUrl(base, path), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": contentType,
      "X-Request-Id": requestId,
      ...(request.headers["x-filename"] ? { "X-Filename": request.headers["x-filename"] } : {}),
    },
    body: upstreamBody,
    signal: linkedAbortSignal(signal),
  });
}

export function createAiGatewayServer({ env = process.env, fetchImpl = fetch, logger = console, idGenerator = randomUUID } = {}) {
  return createServer(async (request, response) => {
    const requestId = request.headers["x-request-id"] || idGenerator();
    const clientSignal = requestAbortSignal(request);
    response.setHeader("X-Request-Id", requestId);

    if (request.method === "GET" && request.url === "/health") {
      audit(logger, { event: "health", request_id: requestId, status: 200 });
      return sendJson(response, 200, {
        status: "ok",
        service: "ai-gateway",
        upstream_configured: Boolean(env.UPSTREAM_BASE_URL && env.UPSTREAM_API_KEY),
      }, requestId);
    }

    if (request.method !== "POST" || !["/v1/chat/completions", "/v1/files"].includes(request.url)) {
      audit(logger, { event: "not_found", request_id: requestId, method: request.method, path: request.url, status: 404 });
      return sendJson(response, 404, errorPayload("not_found", "Not found", requestId), requestId);
    }
    if (!authorized(request, env)) {
      audit(logger, { event: "unauthorized", request_id: requestId, path: request.url, status: 401 });
      return sendJson(response, 401, errorPayload("unauthorized", "Unauthorized", requestId), requestId);
    }

    try {
      const body = await readBody(request);
      const result = await upstream(request.url, request, body, env, fetchImpl, requestId, clientSignal);
      if (!result.ok) {
        audit(logger, { event: "upstream_failure", request_id: requestId, path: request.url, upstream_status: result.status, status: 502 });
        return sendJson(response, 502, errorPayload("upstream_failed", "Upstream request failed", requestId), requestId);
      }

      audit(logger, { event: "proxy_success", request_id: requestId, path: request.url, status: 200, stream: request.headers.accept?.includes("text/event-stream") || false });
      if (request.url === "/v1/chat/completions" && request.headers.accept?.includes("text/event-stream")) {
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "X-Request-Id": requestId,
        });
        return Readable.fromWeb(result.body).pipe(response);
      }

      const payload = await result.arrayBuffer();
      response.writeHead(200, { "Content-Type": result.headers.get("content-type") || "application/json", "X-Request-Id": requestId });
      response.end(Buffer.from(payload));
    } catch (error) {
      if (isAbortError(error, clientSignal)) {
        audit(logger, { event: "request_cancelled", request_id: requestId, path: request.url, status: 499, code: "request_cancelled" });
        if (!response.headersSent) sendJson(response, 499, errorPayload("request_cancelled", "Request cancelled", requestId), requestId);
        return;
      }
      const code = error?.code || "gateway_failure";
      const status = code === "invalid_json" || code === "invalid_attachments" ? 400 : 500;
      const message = error instanceof Error ? error.message : "Gateway failure";
      audit(logger, { event: "gateway_error", request_id: requestId, path: request.url, status, code });
      sendJson(response, status, errorPayload(code, message, requestId), requestId);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createAiGatewayServer().listen(defaultPort, defaultHost, () => {
    console.log("ai-gateway listening on http://" + defaultHost + ":" + defaultPort);
  });
}
