import assert from "node:assert/strict";
import test from "node:test";

import { createAiGatewayServer } from "../server.mjs";

async function request(server, path, options = {}) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, options);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const env = {
  Z_PLATFORM_SERVICE_TOKEN: "service-token",
  UPSTREAM_BASE_URL: "http://upstream/v1",
  UPSTREAM_API_KEY: "upstream-key",
};

test("health reports upstream configuration without auth", async () => {
  const server = createAiGatewayServer({ env });

  const response = await request(server, "/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "ai-gateway",
    upstream_configured: true,
  });
});

test("protected routes require service bearer token", async () => {
  const server = createAiGatewayServer({ env });

  const response = await request(server, "/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("chat completions are forwarded to upstream with provider credentials", async () => {
  const calls = [];
  const server = createAiGatewayServer({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const response = await request(server, "/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer service-token", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { choices: [{ message: { content: "ok" } }] });
  assert.equal(calls[0].url, "http://upstream/v1/v1/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer upstream-key");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
});

test("file uploads forward filename header", async () => {
  const calls = [];
  const server = createAiGatewayServer({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ id: "file-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const response = await request(server, "/v1/files", {
    method: "POST",
    headers: {
      Authorization: "Bearer service-token",
      "Content-Type": "text/plain",
      "X-Filename": "notes.txt",
    },
    body: "hello",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { id: "file-1" });
  assert.equal(calls[0].options.headers["X-Filename"], "notes.txt");
  assert.equal(calls[0].options.headers["Content-Type"], "text/plain");
});

test("upstream failures become gateway errors", async () => {
  const server = createAiGatewayServer({
    env,
    fetchImpl: async () => new Response("bad", { status: 500 }),
  });

  const response = await request(server, "/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer service-token", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Upstream request failed" });
});
