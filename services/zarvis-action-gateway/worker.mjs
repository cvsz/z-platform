const host = process.env.ZARVIS_ACTION_HOST ?? '127.0.0.1';
const port = Number(process.env.ZARVIS_ACTION_PORT ?? 8098);
const workerToken = process.env.ZARVIS_ACTION_WORKER_TOKEN;
const intervalMs = Number(process.env.ZARVIS_ACTION_WORKER_INTERVAL_MS ?? 1000);

if (typeof workerToken !== 'string' || Buffer.byteLength(workerToken) < 32) {
  throw new Error('ZARVIS_ACTION_WORKER_TOKEN must contain at least 32 bytes');
}
if (host !== '127.0.0.1' && host !== '::1') {
  throw new Error('Local worker requires a loopback action host');
}
if (!Number.isInteger(intervalMs) || intervalMs < 250 || intervalMs > 60000) {
  throw new Error('ZARVIS_ACTION_WORKER_INTERVAL_MS must be between 250 and 60000');
}

const baseUrl = `http://${host}:${port}`;
let stopping = false;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

async function runOnce() {
  const ownerToken = process.env.ZARVIS_LOCAL_OWNER_TOKEN;
  if (typeof ownerToken !== 'string' || Buffer.byteLength(ownerToken) < 32) {
    throw new Error('ZARVIS_LOCAL_OWNER_TOKEN must contain at least 32 bytes');
  }
  const { actions } = await request('/v1/actions', {
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  for (const action of actions.filter((item) => item.status === 'approved')) {
    await request(`/v1/internal/actions/${encodeURIComponent(action.action_id)}/execute`, {
      method: 'POST',
      headers: { 'x-zarvis-action-worker-token': workerToken },
    });
  }
}

async function loop() {
  while (!stopping) {
    try {
      await runOnce();
    } catch (error) {
      process.stderr.write(`zarvis-action-worker: ${error.message}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

loop().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
