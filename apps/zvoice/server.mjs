import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const staticAssets = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/voice-worklet.js": { file: "voice-worklet.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
};

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": [
    "default-src 'self'",
    "connect-src 'self' ws: wss:",
    "media-src 'self' blob:",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function send(response, status, body, type = "application/json; charset=utf-8", headers = {}) {
  response.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    ...SECURITY_HEADERS,
    ...headers,
  });
  response.end(body);
}

async function json(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function cleanText(value, fallback, maxLength) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") throw new Error("Expected text value");
  const text = value.trim();
  if (!text || text.length > maxLength) throw new Error("Invalid text value");
  return text;
}

function identity(request, env) {
  const tenantId = String(request.headers["x-tenant-id"] || "").trim();
  const subjectId = String(
    request.headers["x-subject-id"] || request.headers["cf-access-authenticated-user-email"] || "",
  ).trim();
  const allowAnonymous = String(env.ZVOICE_ALLOW_ANONYMOUS || "false").toLowerCase() === "true";
  if (tenantId && subjectId) return { tenantId, subjectId };
  if (allowAnonymous) {
    return {
      tenantId: tenantId || "anonymous",
      subjectId: subjectId || "anonymous",
    };
  }
  throw new Error("Authenticated tenant and subject are required");
}

export function healthSnapshot(env = process.env) {
  return {
    status: "ok",
    service: "zvoice",
    voice_gateway_configured: Boolean(
      env.Z_PLATFORM_VOICE_GATEWAY_URL && env.Z_PLATFORM_SERVICE_TOKEN,
    ),
    anonymous_access: String(env.ZVOICE_ALLOW_ANONYMOUS || "false").toLowerCase() === "true",
  };
}

export async function createVoiceSession(
  body,
  request,
  env = process.env,
  fetchImpl = fetch,
) {
  const gatewayUrl = env.Z_PLATFORM_VOICE_GATEWAY_URL?.replace(/\/$/, "");
  const serviceToken = env.Z_PLATFORM_SERVICE_TOKEN;
  if (!gatewayUrl || !serviceToken) throw new Error("Voice gateway is not configured");

  const { tenantId, subjectId } = identity(request, env);
  const instructions = cleanText(
    body.instructions,
    "You are a concise, helpful voice assistant. Reply in the user's language.",
    8000,
  );
  const model = cleanText(env.VOICE_LLM_MODEL, "default", 256);

  const result = await fetchImpl(`${gatewayUrl}/v1/voice/tickets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      "Content-Type": "application/json",
      "X-Tenant-Id": tenantId,
      "X-Subject-Id": subjectId,
      "X-Request-Id": request.headers["x-request-id"] || randomUUID(),
    },
    body: JSON.stringify({ model }),
    signal: AbortSignal.timeout(5000),
  });

  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw new Error(payload?.error?.message || "Voice gateway rejected the session request");
  }

  return {
    ...payload,
    model,
    instructions,
  };
}

export function createZVoiceRequestHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://zvoice.local");
      if (request.method === "GET" && url.pathname === "/health/live") {
        return send(response, 200, JSON.stringify({ status: "ok", service: "zvoice" }));
      }
      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, JSON.stringify(healthSnapshot(env)));
      }
      if (request.method === "POST" && url.pathname === "/api/voice/session") {
        const body = await json(request);
        const session = await createVoiceSession(body, request, env, fetchImpl);
        return send(response, 201, JSON.stringify(session));
      }

      const asset = staticAssets[url.pathname];
      if (request.method === "GET" && asset) {
        const content = await readFile(new URL(`./public/${asset.file}`, import.meta.url));
        return send(response, 200, content, asset.type, {
          "Cache-Control": asset.file === "index.html" ? "no-store" : "public, max-age=300",
        });
      }
      return send(response, 404, JSON.stringify({ error: "Not found" }));
    } catch (error) {
      return send(
        response,
        400,
        JSON.stringify({ error: error instanceof Error ? error.message : "Request failed" }),
      );
    }
  };
}

export function createZVoiceServer(options = {}) {
  return createServer(createZVoiceRequestHandler(options));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 3022);
  createZVoiceServer().listen(port, host, () => {
    process.stdout.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "zvoice",
      event: "listening",
      host,
      port,
    })}\n`);
  });
}
