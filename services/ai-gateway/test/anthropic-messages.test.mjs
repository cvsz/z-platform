import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';

import { createGatewayApp } from '../index.js';

function createRedisStub() {
  return {
    on() {},
    async srandmember(key) {
      assert.equal(key, 'provider:anthropic:active_keys');
      return 'anthropic-provider-key';
    },
    async get() {
      return null;
    },
    async srem() {},
    async set() {},
    async sadd() {}
  };
}

function createSilentLogger() {
  return {
    child() {
      return this;
    },
    levels: {
      values: {
        debug: 20,
        error: 50,
        fatal: 60,
        info: 30,
        trace: 10,
        warn: 40
      }
    },
    debug() {},
    error() {},
    fatal() {},
    info() {},
    trace() {},
    warn() {}
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function postJson(port, path, body, headers = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-service-token',
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json()
  };
}

test('Anthropic Messages transport forwards latest message options and provider headers', async () => {
  const previousEnv = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL,
    version: process.env.ANTHROPIC_VERSION,
    beta: process.env.ANTHROPIC_BETA,
    enabled: process.env.ANTHROPIC_MESSAGES_ENABLED,
    allowedModels: process.env.ANTHROPIC_ALLOWED_MODELS_JSON
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_MESSAGES_ENABLED = 'true';
  process.env.ANTHROPIC_ALLOWED_MODELS_JSON = JSON.stringify(['claude-sonnet-5']);
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  process.env.ANTHROPIC_VERSION = '2023-06-01';
  process.env.ANTHROPIC_BETA = 'messages-2026-01-01';
  let server;
  const upstreamCalls = [];

  try {
    const fetchImpl = async (url, options = {}) => {
      upstreamCalls.push({ url, options, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 2 }
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'request-id': 'req_test'
        }
      });
    };

    const { app } = createGatewayApp({
      redis: createRedisStub(),
      fetchImpl,
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    const requestBody = {
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      metadata: { user_id: 'tenant-user-1' },
      mcp_servers: [{ type: 'url', url: 'https://mcp.example.invalid', name: 'docs' }],
      service_tier: 'auto',
      stop_sequences: ['</done>'],
      stream: false,
      system: [{ type: 'text', text: 'Answer tersely.' }],
      temperature: 0.2,
      thinking: { type: 'adaptive', display: 'omitted' },
      tool_choice: { type: 'auto' },
      tools: [{
        name: 'lookup',
        description: 'Look up a controlled fixture.',
        input_schema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query']
        }
      }],
      top_k: 40,
      top_p: 0.9
    };

    const response = await postJson(port, '/v1/messages', requestBody);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('request-id'), 'req_test');
    assert.deepEqual(response.body.content, [{ type: 'text', text: 'ok' }]);
    assert.equal(upstreamCalls.length, 1);
    assert.equal(upstreamCalls[0].url, 'https://anthropic.test/v1/messages');
    assert.deepEqual(upstreamCalls[0].body, requestBody);
    assert.equal(upstreamCalls[0].options.headers['x-api-key'], 'anthropic-provider-key');
    assert.equal(upstreamCalls[0].options.headers['anthropic-version'], '2023-06-01');
    assert.equal(upstreamCalls[0].options.headers['anthropic-beta'], 'messages-2026-01-01');
    assert.equal(upstreamCalls[0].options.headers.authorization, undefined);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousEnv.token);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previousEnv.upstream);
    restoreEnv('ANTHROPIC_VERSION', previousEnv.version);
    restoreEnv('ANTHROPIC_BETA', previousEnv.beta);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previousEnv.enabled);
    restoreEnv('ANTHROPIC_ALLOWED_MODELS_JSON', previousEnv.allowedModels);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test('Anthropic Messages transport rejects malformed requests before upstream selection', async () => {
  const previousToken = process.env.Z_PLATFORM_SERVICE_TOKEN;
  const previousEnabled = process.env.ANTHROPIC_MESSAGES_ENABLED;
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_MESSAGES_ENABLED = 'true';
  let server;

  try {
    const { app } = createGatewayApp({
      redis: createRedisStub(),
      fetchImpl: async () => {
        throw new Error('fetch should not be called for invalid message requests');
      },
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();

    const missingMaxTokens = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'Hello' }]
    });
    assert.equal(missingMaxTokens.status, 400);
    assert.equal(missingMaxTokens.body.error.code, 'BAD_REQUEST');

    const missingMessages = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 1024
    });
    assert.equal(missingMessages.status, 400);
    assert.equal(missingMessages.body.error.code, 'BAD_REQUEST');

    const oversizedOutput = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32769,
      messages: [{ role: 'user', content: 'Hello' }]
    });
    assert.equal(oversizedOutput.status, 400);
    assert.equal(oversizedOutput.body.error.code, 'BAD_REQUEST');
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousToken);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previousEnabled);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


test('Anthropic Messages stays disabled by default and does not select a provider key', async () => {
  const previousToken = process.env.Z_PLATFORM_SERVICE_TOKEN;
  const previousEnabled = process.env.ANTHROPIC_MESSAGES_ENABLED;
  delete process.env.ANTHROPIC_MESSAGES_ENABLED;
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  let server;
  let keyLookups = 0;
  let upstreamCalls = 0;

  try {
    const { app } = createGatewayApp({
      redis: {
        on() {},
        async srandmember() {
          keyLookups += 1;
          return 'must-not-be-read';
        },
        async srem() {},
        async sadd() {},
        async set() {}
      },
      fetchImpl: async () => {
        upstreamCalls += 1;
        throw new Error('upstream must not be called while disabled');
      },
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    const response = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'test' }]
    });

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'FEATURE_DISABLED');
    assert.equal(keyLookups, 0);
    assert.equal(upstreamCalls, 0);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousToken);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previousEnabled);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


test('Anthropic Messages does not retry a rate-limited POST and stores only a key fingerprint', async () => {
  const previous = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    enabled: process.env.ANTHROPIC_MESSAGES_ENABLED,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL,
    allowedModels: process.env.ANTHROPIC_ALLOWED_MODELS_JSON
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_MESSAGES_ENABLED = 'true';
  process.env.ANTHROPIC_ALLOWED_MODELS_JSON = JSON.stringify(['claude-sonnet-5']);
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  const providerKey = 'synthetic-anthropic-provider-key';
  let upstreamCalls = 0;
  let removedFromActive = 0;
  let cooldownKey = '';
  let cooldownArgs = [];
  let server;

  try {
    const { app } = createGatewayApp({
      redis: {
        on() {},
        async srandmember(key) {
          assert.equal(key, 'provider:anthropic:active_keys');
          return providerKey;
        },
        async get(key) {
          assert.ok(key.startsWith('provider:anthropic:cooldown:'));
          return null;
        },
        async srem() {
          removedFromActive += 1;
        },
        async set(key, ...args) {
          cooldownKey = key;
          cooldownArgs = args;
        },
        async sadd() {}
      },
      fetchImpl: async () => {
        upstreamCalls += 1;
        return new Response(JSON.stringify({ error: { type: 'rate_limit_error' } }), {
          status: 429,
          headers: { 'content-type': 'application/json' }
        });
      },
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    const response = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'test' }]
    });

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'UPSTREAM_RATE_LIMITED');
    assert.equal(upstreamCalls, 1);
    assert.equal(removedFromActive, 0);
    assert.ok(cooldownKey.startsWith('provider:anthropic:cooldown:'));
    assert.equal(cooldownKey.includes(providerKey), false);
    assert.deepEqual(cooldownArgs, ['cooldown', 'EX', 3600]);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previous.token);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previous.enabled);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previous.upstream);
    restoreEnv('ANTHROPIC_ALLOWED_MODELS_JSON', previous.allowedModels);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


test('Anthropic Messages requires an explicit model allowlist before selecting keys', async () => {
  const previous = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    enabled: process.env.ANTHROPIC_MESSAGES_ENABLED,
    allowedModels: process.env.ANTHROPIC_ALLOWED_MODELS_JSON
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_MESSAGES_ENABLED = 'true';
  delete process.env.ANTHROPIC_ALLOWED_MODELS_JSON;
  let server;
  let keyLookups = 0;
  let upstreamCalls = 0;

  try {
    const { app } = createGatewayApp({
      redis: {
        on() {},
        async srandmember() {
          keyLookups += 1;
          return 'synthetic-provider-key';
        },
        async get() { return null; },
        async srem() {},
        async set() {},
        async sadd() {}
      },
      fetchImpl: async () => {
        upstreamCalls += 1;
        throw new Error('upstream must not be called without an allowed model');
      },
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    const requestBody = {
      model: 'claude-sonnet-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'test' }]
    };

    const missingAllowlist = await postJson(port, '/v1/messages', requestBody);
    assert.equal(missingAllowlist.status, 503);
    assert.equal(missingAllowlist.body.error.code, 'SERVICE_UNAVAILABLE');

    process.env.ANTHROPIC_ALLOWED_MODELS_JSON = JSON.stringify(['claude-haiku-4']);
    const disallowedModel = await postJson(port, '/v1/messages', requestBody);
    assert.equal(disallowedModel.status, 403);
    assert.equal(disallowedModel.body.error.code, 'MODEL_NOT_ALLOWED');
    assert.equal(keyLookups, 0);
    assert.equal(upstreamCalls, 0);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previous.token);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previous.enabled);
    restoreEnv('ANTHROPIC_ALLOWED_MODELS_JSON', previous.allowedModels);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


test('Anthropic Messages rejects non-HTTPS upstream configuration before key selection', async () => {
  const previous = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    enabled: process.env.ANTHROPIC_MESSAGES_ENABLED,
    allowedModels: process.env.ANTHROPIC_ALLOWED_MODELS_JSON,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_MESSAGES_ENABLED = 'true';
  process.env.ANTHROPIC_ALLOWED_MODELS_JSON = JSON.stringify(['claude-sonnet-5']);
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'http://anthropic.test/v1';
  let server;
  let keyLookups = 0;
  let upstreamCalls = 0;

  try {
    const { app } = createGatewayApp({
      redis: {
        on() {},
        async srandmember() {
          keyLookups += 1;
          return 'synthetic-provider-key';
        },
        async get() { return null; },
        async srem() {},
        async set() {},
        async sadd() {}
      },
      fetchImpl: async () => {
        upstreamCalls += 1;
        throw new Error('insecure upstream must not be contacted');
      },
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    const response = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'test' }]
    });

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(keyLookups, 0);
    assert.equal(upstreamCalls, 0);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previous.token);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previous.enabled);
    restoreEnv('ANTHROPIC_ALLOWED_MODELS_JSON', previous.allowedModels);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previous.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


test('Anthropic Messages never returns upstream error bodies to callers', async () => {
  const previous = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    enabled: process.env.ANTHROPIC_MESSAGES_ENABLED,
    allowedModels: process.env.ANTHROPIC_ALLOWED_MODELS_JSON,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_MESSAGES_ENABLED = 'true';
  process.env.ANTHROPIC_ALLOWED_MODELS_JSON = JSON.stringify(['claude-sonnet-5']);
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  const sensitiveUpstreamDetail = 'synthetic-upstream-secret-detail';
  let server;
  let upstreamCalls = 0;

  try {
    const { app } = createGatewayApp({
      redis: createRedisStub(),
      fetchImpl: async () => {
        upstreamCalls += 1;
        return new Response(JSON.stringify({
          error: { message: sensitiveUpstreamDetail }
        }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      },
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    const response = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'test' }]
    });

    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, 'BAD_GATEWAY');
    assert.equal(JSON.stringify(response.body).includes(sensitiveUpstreamDetail), false);
    assert.equal(upstreamCalls, 1);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previous.token);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previous.enabled);
    restoreEnv('ANTHROPIC_ALLOWED_MODELS_JSON', previous.allowedModels);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previous.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


test('Anthropic Messages does not forward an unsafe upstream request-id header', async () => {
  const previous = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    enabled: process.env.ANTHROPIC_MESSAGES_ENABLED,
    allowedModels: process.env.ANTHROPIC_ALLOWED_MODELS_JSON,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_MESSAGES_ENABLED = 'true';
  process.env.ANTHROPIC_ALLOWED_MODELS_JSON = JSON.stringify(['claude-sonnet-5']);
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  let server;

  try {
    const { app } = createGatewayApp({
      redis: createRedisStub(),
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: {
          get(name) {
            return name === 'request-id' ? 'bad\\r\\nX-Injected: true' : null;
          }
        },
        async json() {
          return { id: 'msg_test', type: 'message' };
        }
      }),
      logger: createSilentLogger()
    });

    server = app.listen(0);
    await once(server, 'listening');
    const { port } = server.address();
    const response = await postJson(port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'test' }]
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.id, 'msg_test');
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previous.token);
    restoreEnv('ANTHROPIC_MESSAGES_ENABLED', previous.enabled);
    restoreEnv('ANTHROPIC_ALLOWED_MODELS_JSON', previous.allowedModels);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previous.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});
