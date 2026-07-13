import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ChatRequestError, forwardChat } from "./gateway.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3005);
const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let text = "";
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 1_000_000) throw new ChatRequestError("Request body is too large");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ChatRequestError("Request body must be valid JSON");
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    try {
      sendJson(response, 200, await forwardChat(await readJson(request)));
    } catch (error) {
      const status = error instanceof ChatRequestError ? 400 : 500;
      sendJson(response, status, { error: error.message || "Unexpected error" });
    }
    return;
  }

  const path = request.url === "/" ? "/index.html" : request.url;
  if (!path || path.includes("..")) return sendJson(response, 404, { error: "Not found" });
  const file = join(root, path);
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    response.writeHead(200, { "Content-Type": contentTypes[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
});

server.listen(port, host, () => {
  console.log(`zaicoder web listening on http://${host}:${port}`);
});
