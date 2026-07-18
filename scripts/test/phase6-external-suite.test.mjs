import assert from "node:assert/strict";
import test from "node:test";

import { httpProbe } from "../phase6-external-suite.mjs";

test("phase6 probes send JSON bodies with the expected content type", async () => {
  const originalFetch = global.fetch;
  let observed;
  global.fetch = async (_url, init) => {
    observed = init;
    return new Response("ok", { status: 200 });
  };
  try {
    const result = await httpProbe({
      id: "ai.streaming",
      url: "https://staging.zplatform.dev/v1/chat/completions",
      method: "POST",
      body: { model: "approved-model", stream: true },
      expectedStatus: 200,
    }, "token", new Set(["https://staging.zplatform.dev"]));
    assert.equal(result.status, "verified");
    assert.equal(observed.headers.Authorization, "Bearer token");
    assert.equal(observed.headers["Content-Type"], "application/json");
    assert.equal(observed.body, JSON.stringify({ model: "approved-model", stream: true }));
  } finally {
    global.fetch = originalFetch;
  }
});
