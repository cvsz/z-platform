import assert from "node:assert/strict";
import test from "node:test";
import { createVoiceSession, healthSnapshot } from "../server.mjs";

test("health snapshot does not disclose secrets", () => {
  const result = healthSnapshot({
    Z_PLATFORM_VOICE_GATEWAY_URL: "http://voice-gateway:8450",
    Z_PLATFORM_SERVICE_TOKEN: "secret",
    ZVOICE_ALLOW_ANONYMOUS: "true",
  });
  assert.equal(result.voice_gateway_configured, true);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("session request proxies identity and returns browser-safe data", async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({
      ticket: "signed-ticket",
      websocket_url: "ws://localhost:8450/v1/realtime",
      expires_at: "2030-01-01T00:00:00.000Z",
      ticket_transport: "sec-websocket-protocol",
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };

  const result = await createVoiceSession(
    { model: "qwen3:8b", instructions: "Be helpful" },
    { headers: { "x-tenant-id": "tenant-1", "x-subject-id": "user-1" } },
    {
      Z_PLATFORM_VOICE_GATEWAY_URL: "http://voice-gateway:8450",
      Z_PLATFORM_SERVICE_TOKEN: "service-token",
      ZVOICE_ALLOW_ANONYMOUS: "false",
    },
    fetchImpl,
  );

  assert.equal(result.ticket, "signed-ticket");
  assert.equal(result.instructions, "Be helpful");
  assert.equal(captured.options.headers.Authorization, "Bearer service-token");
  assert.equal(captured.options.headers["X-Tenant-Id"], "tenant-1");
  assert.equal(captured.options.headers["X-Subject-Id"], "user-1");
});
