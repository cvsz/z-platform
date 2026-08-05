import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import {
  inferGitHubRepositoryTarget,
  UnsupportedIntentError,
  ValidationError,
} from '../src/contracts.mjs';
import {
  executeGitHubRepositoryStatus,
  GitHubStatusToolError,
} from '../src/github-status-tool.mjs';
import { ZarvisOrchestrator } from '../src/orchestrator.mjs';
import {
  createZarvisServer,
  ZARVIS_OWNER_GITHUB_ID,
} from '../src/server.mjs';

const SERVICE_TOKEN = 'service-token-0123456789-0123456789';

const repositoryPayload = {
  full_name: 'cvsz/z-platform',
  visibility: 'public',
  private: false,
  archived: false,
  disabled: false,
  fork: false,
  default_branch: 'main',
  open_issues_count: 12,
  stargazers_count: 7,
  watchers_count: 7,
  forks_count: 2,
  updated_at: '2026-08-06T00:00:00Z',
  pushed_at: '2026-08-05T23:00:00Z',
  html_url: 'https://github.com/cvsz/z-platform',
};

function command(overrides = {}) {
  return {
    schema_version: 'zarvis.command.requested.v1',
    session_id: 'session-1',
    input: {
      modality: 'voice',
      text: 'ตรวจสถานะ GitHub cvsz/z-platform',
      locale: 'th-TH',
    },
    ...overrides,
  };
}

test('infers a GitHub repository target from Thai voice text', () => {
  assert.deepEqual(
    inferGitHubRepositoryTarget('ช่วยตรวจสถานะ GitHub cvsz/z-platform ให้หน่อย'),
    { owner: 'cvsz', repo: 'z-platform' },
  );
});

test('orchestrator emits a spoken response and a redacted audit event', async () => {
  const audits = [];
  const orchestrator = new ZarvisOrchestrator({
    githubStatusExecutor: async ({ owner, repo }) => {
      assert.deepEqual({ owner, repo }, { owner: 'cvsz', repo: 'z-platform' });
      return repositoryPayload;
    },
    auditSink: async (event) => audits.push(event),
    now: () => new Date('2026-08-06T00:30:00Z'),
    idFactory: () => 'event-1',
  });

  const result = await orchestrator.execute(command(), {
    tenantId: 'tenant-1',
    userId: 'user-1',
    requestId: 'request-1',
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.intent.name, 'github.repository.status');
  assert.match(result.speech.text, /cvsz\/z-platform/);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].tool.access, 'read_only');
  assert.equal(audits[0].outcome, 'succeeded');
  assert.equal(JSON.stringify(audits).includes('Bearer'), false);
});

test('unsupported commands fail closed', async () => {
  const orchestrator = new ZarvisOrchestrator();
  await assert.rejects(
    orchestrator.execute(command({
      input: { modality: 'text', text: 'ลบฐานข้อมูลทั้งหมด', locale: 'th-TH' },
    })),
    UnsupportedIntentError,
  );
});

test('explicit mutating tools are rejected during validation', async () => {
  const orchestrator = new ZarvisOrchestrator();
  await assert.rejects(
    orchestrator.execute(command({
      tool: { name: 'github.repository.delete', arguments: { owner: 'cvsz', repo: 'z-platform' } },
    })),
    ValidationError,
  );
});

test('GitHub adapter uses a fixed HTTPS host and never returns the token', async () => {
  let observed;
  const result = await executeGitHubRepositoryStatus(
    { owner: 'cvsz', repo: 'z-platform' },
    {
      token: 'secret-token-value',
      fetchImpl: async (url, init) => {
        observed = { url, init };
        return new Response(JSON.stringify(repositoryPayload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  );

  assert.equal(observed.url.origin, 'https://api.github.com');
  assert.equal(observed.url.pathname, '/repos/cvsz/z-platform');
  assert.equal(observed.init.method, 'GET');
  assert.equal(observed.init.headers.Authorization, 'Bearer secret-token-value');
  assert.equal(JSON.stringify(result).includes('secret-token-value'), false);
});

test('GitHub adapter maps not-found responses without leaking upstream bodies', async () => {
  await assert.rejects(
    executeGitHubRepositoryStatus(
      { owner: 'cvsz', repo: 'missing' },
      { fetchImpl: async () => new Response('sensitive upstream detail', { status: 404 }) },
    ),
    (error) => error instanceof GitHubStatusToolError
      && error.code === 'repository_not_found'
      && !error.message.includes('sensitive upstream detail'),
  );
});

test('HTTP service fails closed when the console service token is absent', () => {
  assert.throws(
    () => createZarvisServer({ serviceToken: undefined }),
    /ZARVIS_ORCHESTRATOR_SERVICE_TOKEN/,
  );
});

test('HTTP service rejects requests without the owner service identity', async (t) => {
  const server = createZarvisServer({
    serviceToken: SERVICE_TOKEN,
    logger: { info() {}, error() {} },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/tools`);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'owner_access_denied');
});

test('HTTP service executes the first vertical slice as the immutable owner', async (t) => {
  const audits = [];
  const orchestrator = new ZarvisOrchestrator({
    githubStatusExecutor: async () => repositoryPayload,
    auditSink: async (event) => audits.push(event),
    now: () => new Date('2026-08-06T00:30:00Z'),
    idFactory: () => 'event-1',
  });
  const server = createZarvisServer({
    orchestrator,
    serviceToken: SERVICE_TOKEN,
    logger: { info() {}, error() {} },
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/commands`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-zarvis-owner-id': ZARVIS_OWNER_GITHUB_ID,
      'x-zarvis-service-token': SERVICE_TOKEN,
      'x-tenant-id': 'attacker',
      'x-user-id': 'attacker',
    },
    body: JSON.stringify(command()),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.schema_version, 'zarvis.command.completed.v1');
  assert.equal(body.result.default_branch, 'main');
  assert.equal(audits[0].tenant_id, `owner-${ZARVIS_OWNER_GITHUB_ID}`);
  assert.equal(audits[0].user_id, `github:${ZARVIS_OWNER_GITHUB_ID}`);
});
