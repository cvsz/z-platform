import { createServer } from "node:http";
import { Readable } from "node:stream";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

import { translateAttachmentBuffer } from "./attachments.mjs";
import { listModels } from "./model-catalog.mjs";
import { translateUploadRequest } from "./uploads.mjs";

const defaultHost = process.env.HOST || "127.0.0.1";
const defaultPort = Number(process.env.PORT || 8400);
const maxRequestBytes = 10 * 1024 * 1024;
const upstreamTimeoutMs = 60_000;
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

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

async function emitUsage({ env, fetchImpl, request, requestId, responsePayload }) {
  const ledgerUrl = env.Z_PLATFORM_BILLING_LEDGER_URL?.replace(/\/$/, "");
  if (!ledgerUrl || request.url !== "/v1/chat/completions") return null;
  let parsed = {};
  try { parsed = JSON.parse(responsePayload.toString("utf8")); } catch {}
  const usage = parsed.usage || {};
  const body = {
    usage_id: requestId,
    idempotency_key: `ai-usage:${requestId}`,
    tenant_id: request.headers["x-tenant-id"] || "unknown",
    subject_id: request.headers["x-subject-id"] || "unknown",
    model: parsed.model || "unknown",
    input_tokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
    output_tokens: Number(usage.completion_tokens || usage.output_tokens || 0),
    recorded_at: new Date().toISOString(),
  };
  return fetchImpl(ledgerUrl + "/v1/usage", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.Z_PLATFORM_SERVICE_TOKEN,
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
    },
    body: JSON.stringify(body),
  });
}

function authorized(request, env) {
  const expected = env.Z_PLATFORM_SERVICE_TOKEN;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function rejectUnauthorized(request, response, env, logger, requestId) {
  if (authorized(request, env)) return false;
  audit(logger, { event: "unauthorized", request_id: requestId, path: request.url, status: 401 });
  sendJson(response, 401, errorPayload("unauthorized", "Unauthorized", requestId), requestId);
  return true;
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

function normalizeProviderConfig(entry, index) {
  if (!entry || typeof entry !== "object") throw Object.assign(new Error(`upstream provider ${index} must be an object`), { code: "invalid_provider_config" });
  const name = String(entry.name || `provider-${index + 1}`).trim();
  const baseUrl = String(entry.base_url || entry.baseUrl || "").trim();
  const apiKey = String(entry.api_key || entry.apiKey || "").trim();
  const provider = String(entry.provider || "openai-compatible").trim();
  if (!name || !baseUrl || !apiKey) throw Object.assign(new Error(`upstream provider ${index} requires name, base_url and api_key`), { code: "invalid_provider_config" });
  return { name, baseUrl, apiKey, provider };
}

export function resolveUpstreamProviders(env = process.env) {
  const raw = env.UPSTREAM_PROVIDERS_JSON?.trim();
  if (raw) {
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw Object.assign(new Error("UPSTREAM_PROVIDERS_JSON must be valid JSON"), { code: "invalid_provider_config" }); }
    if (!Array.isArray(parsed) || parsed.length === 0) throw Object.assign(new Error("UPSTREAM_PROVIDERS_JSON must be a non-empty array"), { code: "invalid_provider_config" });
    return parsed.map(normalizeProviderConfig);
  }
  const baseUrl = env.UPSTREAM_BASE_URL?.trim();
  const apiKey = env.UPSTREAM_API_KEY?.trim();
  if (!baseUrl || !apiKey) throw new Error("Gateway upstream is not configured");
  return [{
    name: env.UPSTREAM_NAME?.trim() || "primary",
    baseUrl,
    apiKey,
    provider: env.UPSTREAM_PROVIDER?.trim() || "openai-compatible",
  }];
}

function prepareUpstreamRequest(path, request, body, config) {
  const contentType = request.headers["content-type"] || "application/json";
  let upstreamPath = path;
  let upstreamBody = body;
  let upstreamHeaders = {
    "Content-Type": contentType,
    ...(request.headers["x-filename"] ? { "X-Filename": request.headers["x-filename"] } : {}),
  };

  if (path === "/v1/chat/completions") upstreamBody = translateChatPayload(body, contentType, config.provider);
  if (path === "/v1/files") {
    const translatedUpload = translateUploadRequest(body, {
      provider: config.provider,
      contentType,
      filename: request.headers["x-filename"],
    });
    upstreamPath = translatedUpload.path;
    upstreamBody = translatedUpload.body;
    upstreamHeaders = translatedUpload.headers;
  }
  return { upstreamPath, upstreamBody, upstreamHeaders };
}

export function translateChatPayload(buffer, contentType = "application/json", provider = "openai-compatible") {
  return translateAttachmentBuffer(buffer, contentType, { provider });
}

export async function upstream(path, request, body, env = process.env, fetchImpl = fetch, requestId = randomUUID(), signal, logger = console) {
  const providers = resolveUpstreamProviders(env);
  let lastResponse;
  let lastError;

  for (let index = 0; index < providers.length; index += 1) {
    const config = providers[index];
    const attempt = index + 1;
    try {
      const prepared = prepareUpstreamRequest(path, request, body, config);
      audit(logger, { event: "upstream_attempt", request_id: requestId, path, provider: config.name, attempt });
      const result = await fetchImpl(upstreamUrl(config.baseUrl, prepared.upstreamPath), {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.apiKey,
          ...prepared.upstreamHeaders,
          "X-Request-Id": requestId,
        },
        body: prepared.upstreamBody,
        signal: linkedAbortSignal(signal),
      });
      result.zPlatformProvider = config.name;
      result.zPlatformAttempt = attempt;
      lastResponse = result;
      if (result.ok || !retryableStatuses.has(result.status) || index === providers.length - 1) return result;
      audit(logger, { event: "upstream_failover", request_id: requestId, path, provider: config.name, attempt, upstream_status: result.status });
    } catch (error) {
      if (isAbortError(error, signal)) throw error;
      lastError = error;
      audit(logger, { event: "upstream_failover", request_id: requestId, path, provider: config.name, attempt, code: error?.code || "network_error" });
      if (index === providers.length - 1) throw error;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error("No upstream provider was attempted");
}

export function createAiGatewayServer({ env = process.env, fetchImpl = fetch, logger = console, idGenerator = randomUUID } = {}) {
  return createServer(async (request, response) => {
    const requestId = request.headers["x-request-id"] || idGenerator();
    const clientSignal = requestAbortSignal(request);
    response.setHeader("X-Request-Id", requestId);

    if (request.method === "GET" && request.url === "/health") {
      let configured = false;
      try { configured = resolveUpstreamProviders(env).length > 0; } catch {}
      audit(logger, { event: "health", request_id: requestId, status: 200 });
      return sendJson(response, 200, {
        status: "ok",
        service: "ai-gateway",
        upstream_configured: configured,
      }, requestId);
    }

    if (request.method === "GET" && request.url === "/v1/models") {
      if (rejectUnauthorized(request, response, env, logger, requestId)) return;
      audit(logger, { event: "model_catalog", request_id: requestId, status: 200, provider: "huggingface" });
      return sendJson(response, 200, listModels({ provider: "huggingface" }), requestId);
    }

    if (request.method !== "POST" || !["/v1/chat/completions", "/v1/files"].includes(request.url)) {
      audit(logger, { event: "not_found", request_id: requestId, method: request.method, path: request.url, status: 404 });
      return sendJson(response, 404, errorPayload("not_found", "Not found", requestId), requestId);
    }
    if (rejectUnauthorized(request, response, env, logger, requestId)) return;

    try {
      const body = await readBody(request);
      const result = await upstream(request.url, request, body, env, fetchImpl, requestId, clientSignal, logger);
      if (!result.ok) {
        audit(logger, { event: "upstream_failure", request_id: requestId, path: request.url, provider: result.zPlatformProvider, attempt: result.zPlatformAttempt, upstream_status: result.status, status: 502 });
        return sendJson(response, 502, errorPayload("upstream_failed", "Upstream request failed", requestId), requestId);
      }

      response.setHeader("X-Z-Platform-Upstream", result.zPlatformProvider || "primary");
      audit(logger, { event: "proxy_success", request_id: requestId, path: request.url, provider: result.zPlatformProvider, attempt: result.zPlatformAttempt, status: 200, stream: request.headers.accept?.includes("text/event-stream") || false });
      if (request.url === "/v1/chat/completions" && request.headers.accept?.includes("text/event-stream")) {
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "X-Request-Id": requestId,
          "X-Z-Platform-Upstream": result.zPlatformProvider || "primary",
        });
        return Readable.fromWeb(result.body).pipe(response);
      }

      const payload = Buffer.from(await result.arrayBuffer());
      await emitUsage({ env, fetchImpl, request, requestId, responsePayload: payload });
      response.writeHead(200, {
        "Content-Type": result.headers.get("content-type") || "application/json",
        "X-Request-Id": requestId,
        "X-Z-Platform-Upstream": result.zPlatformProvider || "primary",
      });
      response.end(payload);
    } catch (error) {
      if (isAbortError(error, clientSignal)) {
        audit(logger, { event: "request_cancelled", request_id: requestId, path: request.url, status: 499, code: "request_cancelled" });
        if (!response.headersSent) sendJson(response, 499, errorPayload("request_cancelled", "Request cancelled", requestId), requestId);
        return;
      }
      const code = error?.code || "gateway_failure";
      const status = ["invalid_json", "invalid_attachments", "invalid_upload", "unsupported_upload_provider", "invalid_provider_config"].includes(code) ? 400 : 500;
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
