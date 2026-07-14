import assert from "node:assert/strict";
import test from "node:test";

import { resolveUpstreamProviders, upstream } from "../server.mjs";

const request = {
  headers: { "content-type": "application/json" },
};

function logger(events) {
  return { info: (line) => events.push(JSON.parse(line)) };
}

const providers = JSON.stringify([
  {
    name: "primary",
    base_url: "https://primary.example/v1",
    api_key: "primary-key",
    provider: "openai-compatible"
  },
  {
    name: "secondary",
    base_url: "https://secondary.example/v1",
    api_key: "secondary-key",
    provider: "openai-compatible"
  }
]);

test("resolves ordered providers while preserving legacy single-provider configuration", () => {
  assert.deepEqual(resolveUpstreamProviders({
    UPSTREAM_BASE_URL: "https://legacy.example/v1",
    UPSTREAM_API_KEY: "legacy-key",
    UPSTREAM_PROVIDER: "openai-compatible",
  }), [{
    name: "primary",
    baseUrl: "https://legacy.example/v1",
    apiKey: "legacy-key",
    provider: "openai-compatible",
  }]);

  assert.deepEqual(resolveUpstreamProviders({ UPSTREAM_PROVIDERS_JSON: providers }).map(({ name, baseUrl }) => ({ name, baseUrl })), [
    { name: "primary", baseUrl: "https://primary.example/v1" },
    { name: "secondary", baseUrl: "https://secondary.example/v1" },
  ]);
});

test("fails over on retryable upstream status and records selected provider", async () => {
  const calls = [];
  const events = [];
  const result = await upstream(
    "/v1/chat/completions",
    request,
    Buffer.from(JSON.stringify({ messages: [] })),
    { UPSTREAM_PROVIDERS_JSON: providers },
    async (url, options) => {
      calls.push({ url, authorization: options.headers.Authorization });
      if (url.startsWith("https://primary.example")) return new Response("quota", { status: 429 });
      return Response.json({ choices: [{ message: { content: "ok" } }] });
    },
    "req-failover",
    undefined,
    logger(events),
  );

  assert.equal(result.status, 200);
  assert.equal(result.zPlatformProvider, "secondary");
  assert.equal(result.zPlatformAttempt, 2);
  assert.deepEqual(calls, [
    { url: "https://primary.example/v1/chat/completions", authorization: "Bearer primary-key" },
    { url: "https://secondary.example/v1/chat/completions", authorization: "Bearer secondary-key" },
  ]);
  assert.ok(events.some((event) => event.event === "upstream_failover" && event.provider === "primary" && event.upstream_status === 429));
});

test("fails over on network error", async () => {
  const calls = [];
  const result = await upstream(
    "/v1/chat/completions",
    request,
    Buffer.from(JSON.stringify({ messages: [] })),
    { UPSTREAM_PROVIDERS_JSON: providers },
    async (url) => {
      calls.push(url);
      if (url.startsWith("https://primary.example")) throw Object.assign(new Error("connection reset"), { code: "ECONNRESET" });
      return Response.json({ choices: [] });
    },
    "req-network-failover",
    undefined,
    logger([]),
  );

  assert.equal(result.zPlatformProvider, "secondary");
  assert.equal(calls.length, 2);
});

test("does not fail over on non-retryable upstream 4xx", async () => {
  const calls = [];
  const result = await upstream(
    "/v1/chat/completions",
    request,
    Buffer.from(JSON.stringify({ messages: [] })),
    { UPSTREAM_PROVIDERS_JSON: providers },
    async (url) => {
      calls.push(url);
      return Response.json({ error: "invalid request" }, { status: 400 });
    },
    "req-no-failover",
    undefined,
    logger([]),
  );

  assert.equal(result.status, 400);
  assert.equal(result.zPlatformProvider, "primary");
  assert.equal(calls.length, 1);
});

test("rejects invalid provider chain configuration", () => {
  assert.throws(
    () => resolveUpstreamProviders({ UPSTREAM_PROVIDERS_JSON: "not-json" }),
    (error) => error.code === "invalid_provider_config",
  );
  assert.throws(
    () => resolveUpstreamProviders({ UPSTREAM_PROVIDERS_JSON: "[]" }),
    (error) => error.code === "invalid_provider_config",
  );
});
