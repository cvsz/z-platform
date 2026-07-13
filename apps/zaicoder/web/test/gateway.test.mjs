import assert from "node:assert/strict";
import test from "node:test";

import {
  ChatRequestError,
  forwardChat,
  forwardChatStream,
  validateChatRequest,
} from "../server/gateway.mjs";

test("forwards a validated chat request without exposing the token", async () => {
  let request;
  const result = await forwardChat(
    { model: "coding", prompt: "Explain this" },
    {
      env: { Z_PLATFORM_AI_GATEWAY_URL: "https://gateway.example/v1", Z_PLATFORM_SERVICE_TOKEN: "token" },
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, json: async () => ({ choices: [{ message: { content: "answer" } }] }) };
      },
    },
  );
  assert.deepEqual(result, { content: "answer" });
  assert.equal(request.url, "https://gateway.example/v1/chat/completions");
  assert.equal(JSON.parse(request.options.body).messages[0].content, "Explain this");
  assert.equal(request.options.headers.Authorization, "Bearer token");
});

test("forwards an SSE request with streaming enabled", async () => {
  let request;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  const result = await forwardChatStream(
    { model: "coding", prompt: "Stream this" },
    {
      env: { Z_PLATFORM_AI_GATEWAY_URL: "https://gateway.example/v1", Z_PLATFORM_SERVICE_TOKEN: "token" },
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, body };
      },
    },
  );
  assert.equal(result, body);
  assert.equal(JSON.parse(request.options.body).stream, true);
});

test("rejects invalid prompts and missing gateway configuration", async () => {
  assert.throws(() => validateChatRequest({ prompt: "" }), ChatRequestError);
  await assert.rejects(
    forwardChat({ prompt: "hello" }, { env: {} }),
    ChatRequestError,
  );
});
