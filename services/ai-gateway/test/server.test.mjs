import assert from "node:assert/strict";
import test from "node:test";

import { createAiGatewayServer, translateChatPayload } from "../server.mjs";

async function request(server, path, options = {}) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, options);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function testLogger(events) {
  return { info: (line) => events.push(JSON.parse(line)) };
}

const env = {
  Z_PLATFORM_SERVICE_TOKEN: "service-token",
  UPSTREAM_BASE_URL: "http://upstream/v1",
  UPSTREAM_API_KEY: "upstream-key",
};

test("health reports upstream configuration without auth", async () => {
  const events = [];
  const server = createAiGatewayServer({ env, logger: testLogger(events), idGenerator: () => "req-health" });

  const response = await request(server, "/health");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "req-health");
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "ai-gateway",
    upstream_configured: true,
  });
  assert.equal(events[0].event, "health");
  assert.equal(events[0].request_id, "req-health");
});

test("protected routes require service bearer token", async () => {
  const events = [];
  const server = createAiGatewayServer({ env, logger: testLogger(events), idGenerator: () => "req-auth" });

  const response = await request(server, "/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("x-request-id"), "req-auth");
  assert.deepEqual(await response.json(), { error: "Unauthorized", code: "unauthorized", request_id: "req-auth" });
  assert.equal(events[0].event, "unauthorized");
});

test("chat completions are forwarded to upstream with provider credentials", async () => {
  const calls = [];
  const events = [];
  const server = createAiGatewayServer({
    env,
    logger: testLogger(events),
    idGenerator: () => "req-chat",
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
  assert.equal(response.headers.get("x-request-id"), "req-chat");
  assert.deepEqual(await response.json(), { choices: [{ message: { content: "ok" } }] });
  assert.equal(calls[0].url, "http://upstream/v1/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer upstream-key");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.equal(calls[0].options.headers["X-Request-Id"], "req-chat");
  assert.equal(events[0].event, "proxy_success");
});

test("translates platform attachment references before upstream chat requests", async () => {
  const translated = JSON.parse(translateChatPayload(Buffer.from(JSON.stringify({
    model: "default",
    messages: [{ role: "user", content: "summarize" }],
    attachments: [{ id: "file-1", name: "notes.txt" }],
  }))).toString("utf8"));

  assert.equal(translated.attachments, undefined);
  assert.deepEqual(translated.metadata.z_platform.attachments, [{ id: "file-1", name: "notes.txt" }]);
  assert.match(translated.messages[0].content, /Attached platform files:/);
  assert.match(translated.messages[0].content, /notes\.txt \(file-1\)/);
});

test("invalid attachment contracts fail before upstream forwarding", async () => {
  const server = createAiGatewayServer({
    env,
    logger: testLogger([]),
    idGenerator: () => "req-invalid-attachment",
    fetchImpl: async () => {
      throw new Error("should not call upstream");
    },
  });

  const response = await request(server, "/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer service-token", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [], attachments: [{ id: "file-1" }] }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "attachments require id and name",
    code: "invalid_attachments",
    request_id: "req-invalid-attachment",
  });
});

test("upstream url normalization accepts base urls without v1", async () => {
  const calls = [];
  const server = createAiGatewayServer({
    env: { ...env, UPSTREAM_BASE_URL: "http://upstream" },
    logger: testLogger([]),
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    },
  });

  await request(server, "/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer service-token", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(calls[0], "http://upstream/v1/chat/completions");
});

test("file uploads forward filename header", async () => {
  const calls = [];
  const server = createAiGatewayServer({
    env,
    logger: testLogger([]),
    idGenerator: () => "req-file",
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
      "X-Request-Id": "client-req-file",
    },
    body: "hello",
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "client-req-file");
  assert.deepEqual(await response.json(), { id: "file-1" });
  assert.equal(calls[0].url, "http://upstream/v1/files");
  assert.equal(calls[0].options.headers["X-Filename"], "notes.txt");
  assert.equal(calls[0].options.headers["Content-Type"], "text/plain");
  assert.equal(calls[0].options.headers["X-Request-Id"], "client-req-file");
});

test("upstream failures become structured gateway errors", async () => {
  const events = [];
  const server = createAiGatewayServer({
    env,
    logger: testLogger(events),
    idGenerator: () => "req-upstream-fail",
    fetchImpl: async () => new Response("bad", { status: 500 }),
  });

  const response = await request(server, "/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer service-token", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "Upstream request failed",
    code: "upstream_failed",
    request_id: "req-upstream-fail",
  });
  assert.equal(events[0].event, "upstream_failure");
  assert.equal(events[0].upstream_status, 500);
});

test("client cancellation aborts the upstream request", async () => {
  const events = [];
  const seenSignals = [];
  const server = createAiGatewayServer({
    env,
    logger: testLogger(events),
    idGenerator: () => "req-cancelled",
    fetchImpl: async (_url, options) => {
      seenSignals.push(options.signal);
      options.signal.dispatchEvent(new Event("abort"));
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    },
  });

  const response = await request(server, "/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer service-token", "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(response.status, 499);
  assert.deepEqual(await response.json(), {
    error: "Request cancelled",
    code: "request_cancelled",
    request_id: "req-cancelled",
  });
  assert.equal(seenSignals.length, 1);
  assert.equal(events[0].event, "request_cancelled");
});
