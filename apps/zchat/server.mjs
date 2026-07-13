import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const defaultHost = process.env.HOST || "127.0.0.1";
const defaultPort = Number(process.env.PORT || 3021);

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type });
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

export async function chat(body, env = process.env, fetchImpl = fetch) {
  const url = env.Z_PLATFORM_AI_GATEWAY_URL?.replace(/\/$/, "");
  const token = env.Z_PLATFORM_SERVICE_TOKEN;
  if (!url || !token) throw new Error("AI gateway is not configured");
  if (typeof body.prompt !== "string" || !body.prompt.trim()) throw new Error("Prompt is required");

  const result = await fetchImpl(url + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: typeof body.model === "string" && body.model ? body.model : "default",
      messages: [{ role: "user", content: body.prompt.trim() }],
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!result.ok) throw new Error("AI gateway rejected the request");

  const payload = await result.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Unsupported AI gateway response");
  return { content };
}

export function createZChatServer({ env = process.env, fetchImpl = fetch } = {}) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        return send(response, 200, JSON.stringify({
          status: "ok",
          service: "zchat",
          gateway_configured: Boolean(env.Z_PLATFORM_AI_GATEWAY_URL && env.Z_PLATFORM_SERVICE_TOKEN),
        }));
      }
      if (request.method === "POST" && request.url === "/api/chat") {
        return send(response, 200, JSON.stringify(await chat(await json(request), env, fetchImpl)));
      }
      if (request.method === "GET" && request.url === "/") {
        return send(response, 200, await readFile(new URL("./public/index.html", import.meta.url)), "text/html; charset=utf-8");
      }
      if (request.method === "GET" && request.url === "/app.js") {
        return send(response, 200, await readFile(new URL("./public/app.js", import.meta.url)), "text/javascript; charset=utf-8");
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
