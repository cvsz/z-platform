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
    beta: process.env.ANTHROPIC_BETA
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
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
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test('Anthropic Messages transport rejects malformed requests before upstream selection', async () => {
  const previousToken = process.env.Z_PLATFORM_SERVICE_TOKEN;
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
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
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousToken);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


test('Anthropic Messages rejects unauthenticated requests before provider selection', async () => {
  const previousToken = process.env.Z_PLATFORM_SERVICE_TOKEN;
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  let keyLookups = 0;
  let upstreamCalls = 0;
  let server;

  try {
    const redis = {
      on() {},
      async srandmember() { keyLookups += 1; return 'anthropic-provider-key'; },
      async srem() {},
      async set() {},
      async sadd() {}
    };
    const { app } = createGatewayApp({
      redis,
      fetchImpl: async () => { upstreamCalls += 1; return Response.json({}); },
      logger: createSilentLogger()
    });
    server = app.listen(0);
    await once(server, 'listening');
    const response = await postJson(server.address().port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello' }]
    }, { authorization: 'Bearer wrong-token' });

    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'UNAUTHORIZED');
    assert.equal(keyLookups, 0);
    assert.equal(upstreamCalls, 0);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousToken);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test('Anthropic Messages maps non-JSON upstream responses to a generic 502', async () => {
  const previousEnv = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  let server;

  try {
    const { app } = createGatewayApp({
      redis: createRedisStub(),
      fetchImpl: async () => new Response('<!doctype html><html>upstream failure</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' }
      }),
      logger: createSilentLogger()
    });
    server = app.listen(0);
    await once(server, 'listening');
    const response = await postJson(server.address().port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello' }]
    });

    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, 'BAD_GATEWAY');
    assert.doesNotMatch(JSON.stringify(response.body), /doctype|upstream failure/i);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousEnv.token);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previousEnv.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test('Anthropic Messages maps an upstream abort to a bounded timeout response', async () => {
  const previousEnv = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  let server;

  try {
    const { app } = createGatewayApp({
      redis: createRedisStub(),
      fetchImpl: async () => { throw new DOMException('synthetic timeout detail', 'AbortError'); },
      logger: createSilentLogger()
    });
    server = app.listen(0);
    await once(server, 'listening');
    const response = await postJson(server.address().port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello' }]
    });

    assert.equal(response.status, 504);
    assert.equal(response.body.error.code, 'UPSTREAM_TIMEOUT');
    assert.doesNotMatch(JSON.stringify(response.body), /synthetic timeout detail/i);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousEnv.token);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previousEnv.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test('Anthropic Messages rejects insecure upstream URLs before provider-key selection', async () => {
  const previousEnv = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'http://127.0.0.1:8080/v1';
  let keyLookups = 0;
  let upstreamCalls = 0;
  let server;

  try {
    const redis = {
      on() {},
      async srandmember() { keyLookups += 1; return 'anthropic-provider-key'; },
      async srem() {},
      async set() {},
      async sadd() {}
    };
    const { app } = createGatewayApp({
      redis,
      fetchImpl: async () => { upstreamCalls += 1; return Response.json({}); },
      logger: createSilentLogger()
    });
    server = app.listen(0);
    await once(server, 'listening');
    const response = await postJson(server.address().port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello' }]
    });

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(keyLookups, 0);
    assert.equal(upstreamCalls, 0);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousEnv.token);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previousEnv.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});


function createKeyPoolRedis(initialKeys) {
  const activeKeys = new Set(initialKeys);
  const cooldownKeys = new Set();
  const invalidKeys = new Set();
  return {
    activeKeys,
    cooldownKeys,
    invalidKeys,
    on() {},
    async smembers(key) {
      assert.equal(key, 'provider:anthropic:active_keys');
      return [...activeKeys];
    },
    async exists(key) {
      const prefix = 'provider:anthropic:cooldown_keys:';
      return cooldownKeys.has(key.slice(prefix.length)) ? 1 : 0;
    },
    async srem(key, value) {
      if (key === 'provider:anthropic:active_keys') activeKeys.delete(value);
      if (key === 'provider:anthropic:cooldown_keys') cooldownKeys.delete(value);
    },
    async sadd(key, ...values) {
      if (key === 'provider:anthropic:invalid_keys') {
        for (const value of values) invalidKeys.add(value);
      }
    },
    async set(key, value, mode, ttl) {
      assert.equal(value, 'cooldown');
      assert.equal(mode, 'EX');
      assert.equal(ttl, 3600);
      const prefix = 'provider:anthropic:cooldown_keys:';
      cooldownKeys.add(key.slice(prefix.length));
    }
  };
}

test('Anthropic 429 cooldown keeps the key recoverable and retries a healthy key', async () => {
  const previousEnv = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  const redis = createKeyPoolRedis(['rate-limited-key', 'healthy-key']);
  const usedKeys = [];
  let rateLimitOnce = true;
  let server;

  try {
    const { app } = createGatewayApp({
      redis,
      fetchImpl: async (_url, options) => {
        const key = options.headers['x-api-key'];
        usedKeys.push(key);
        if (key === 'rate-limited-key' && rateLimitOnce) {
          rateLimitOnce = false;
          return new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 });
        }
        return Response.json({ id: 'msg_ok', content: [] });
      },
      logger: createSilentLogger()
    });
    server = app.listen(0);
    await once(server, 'listening');

    const first = await postJson(server.address().port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello' }]
    });
    assert.equal(first.status, 200);
    assert.deepEqual(usedKeys, ['rate-limited-key', 'healthy-key']);
    assert.equal(redis.activeKeys.has('rate-limited-key'), true);
    assert.equal(redis.cooldownKeys.has('rate-limited-key'), true);

    redis.cooldownKeys.delete('rate-limited-key');
    usedKeys.length = 0;
    const second = await postJson(server.address().port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello again' }]
    });
    assert.equal(second.status, 200);
    assert.equal(usedKeys[0], 'rate-limited-key');
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousEnv.token);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previousEnv.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test('Anthropic retries a healthy key after removing a rejected credential', async () => {
  const previousEnv = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  const redis = createKeyPoolRedis(['revoked-key', 'healthy-key']);
  const usedKeys = [];
  let server;

  try {
    const { app } = createGatewayApp({
      redis,
      fetchImpl: async (_url, options) => {
        const key = options.headers['x-api-key'];
        usedKeys.push(key);
        if (key === 'revoked-key') return new Response('denied', { status: 401 });
        return Response.json({ id: 'msg_ok', content: [] });
      },
      logger: createSilentLogger()
    });
    server = app.listen(0);
    await once(server, 'listening');

    const response = await postJson(server.address().port, '/v1/messages', {
      model: 'claude-sonnet-5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'hello' }]
    });
    assert.equal(response.status, 200);
    assert.deepEqual(usedKeys, ['revoked-key', 'healthy-key']);
    assert.equal(redis.activeKeys.has('revoked-key'), false);
    assert.equal(redis.invalidKeys.has('revoked-key'), true);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousEnv.token);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previousEnv.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});

test('Anthropic streaming keeps the upstream timeout active until the stream ends', async () => {
  const previousEnv = {
    token: process.env.Z_PLATFORM_SERVICE_TOKEN,
    upstream: process.env.ANTHROPIC_UPSTREAM_BASE_URL
  };
  process.env.Z_PLATFORM_SERVICE_TOKEN = 'test-service-token';
  process.env.ANTHROPIC_UPSTREAM_BASE_URL = 'https://anthropic.test/v1';
  const redis = createKeyPoolRedis(['stream-key']);
  let observedSignal;
  let server;

  try {
    const { app } = createGatewayApp({
      redis,
      upstreamTimeoutMs: 40,
      fetchImpl: async (_url, options) => {
        observedSignal = options.signal;
        const body = new ReadableStream({
          start(controller) {
            options.signal.addEventListener('abort', () => {
              try {
                controller.error(new DOMException('synthetic stream timeout', 'AbortError'));
              } catch {
                // The stream may already have been cancelled by the response close handler.
              }
            }, { once: true });
          }
        });
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' }
        });
      },
      logger: createSilentLogger()
    });
    server = app.listen(0);
    await once(server, 'listening');

    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/messages`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-service-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 32,
        messages: [{ role: 'user', content: 'stream' }],
        stream: true
      })
    });
    assert.equal(response.status, 200);
    await assert.rejects(response.text());
    assert.equal(observedSignal.aborted, true);
  } finally {
    restoreEnv('Z_PLATFORM_SERVICE_TOKEN', previousEnv.token);
    restoreEnv('ANTHROPIC_UPSTREAM_BASE_URL', previousEnv.upstream);
    if (server) await new Promise((resolve) => server.close(resolve));
  }
});
