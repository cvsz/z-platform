import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { createZarvisConsoleServer } from '../server.mjs';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test('console serves the command center with restrictive browser headers', async (t) => {
  const server = createZarvisConsoleServer({ logger: { error() {} } });
  const baseUrl = await listen(server);
  t.after(() => server.close());

  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await response.text(), /Z\.A\.R\.V\.I\.S\./);
});

test('console proxies command payloads to the fixed orchestrator endpoint without credentials', async (t) => {
  let observedAuthorization;
  let observedPath;
  const upstream = createServer(async (request, response) => {
    observedAuthorization = request.headers.authorization;
    observedPath = request.url;
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'completed', received: JSON.parse(Buffer.concat(chunks)) }));
  });
  const upstreamUrl = await listen(upstream);
  t.after(() => upstream.close());

  const consoleServer = createZarvisConsoleServer({
    orchestratorUrl: upstreamUrl,
    logger: { error() {} },
  });
  const consoleUrl = await listen(consoleServer);
  t.after(() => consoleServer.close());

  const payload = { session_id: 'session-1', input: { modality: 'text', text: 'status' } };
  const response = await fetch(`${consoleUrl}/api/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 200);
  assert.equal(observedPath, '/v1/commands');
  assert.equal(observedAuthorization, undefined);
  assert.deepEqual((await response.json()).received, payload);
});

test('console rejects non-JSON command bodies before proxying', async (t) => {
  const server = createZarvisConsoleServer({ logger: { error() {} } });
  const baseUrl = await listen(server);
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/command`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'hello',
  });
  assert.equal(response.status, 415);
});
