import assert from "node:assert/strict";
import test from "node:test";

import { chat, createZChatServer } from "../server.mjs";

async function request(server, path, options = {}) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await fetch(`http://127.0.0.1:${port}${path}`, options);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("health reports gateway configuration without auth", async () => {
  const server = createZChatServer({
    env: { Z_PLATFORM_AI_GATEWAY_URL: "http://gateway", Z_PLATFORM_SERVICE_TOKEN: "service-token" },
  });

  const response = await request(server, "/health");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "zchat",
    gateway_configured: true,
  });
});

test("chat rejects missing prompt before calling the gateway", async () => {
  let called = false;
  await assert.rejects(
    chat(
      { prompt: "   " },
      { Z_PLATFORM_AI_GATEWAY_URL: "http://gateway", Z_PLATFORM_SERVICE_TOKEN: "service-token" },
      async () => {
        called = true;
        throw new Error("should not call gateway");
      },
    ),
    /Prompt is required/,
  );
  assert.equal(called, false);
});

test("chat forwards trimmed prompt through the AI gateway", async () => {
  const calls = [];
  const result = await chat(
    { prompt: "  hello  ", model: "fast" },
    { Z_PLATFORM_AI_GATEWAY_URL: "http://gateway/", Z_PLATFORM_SERVICE_TOKEN: "service-token" },
    async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ choices: [{ message: { content: "world" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  assert.deepEqual(result, { content: "world" });
  assert.equal(calls[0].url, "http://gateway/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer service-token");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: "fast",
    messages: [{ role: "user", content: "hello" }],
    stream: false,
  });
});

test("api chat returns gateway content", async () => {
  const server = createZChatServer({
    env: { Z_PLATFORM_AI_GATEWAY_URL: "http://gateway", Z_PLATFORM_SERVICE_TOKEN: "service-token" },
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }),
  });

  const response = await request(server, "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "hi" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { content: "ok" });
});
