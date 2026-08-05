import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const MAX_BODY_BYTES = 32 * 1024;
const STATIC_FILES = new Set(['/index.html', '/app.js', '/styles.css']);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function writeJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

async function readBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Request body too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function serveStatic(pathname, response) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  if (!STATIC_FILES.has(normalized)) {
    return false;
  }

  const path = join(PUBLIC_DIR, normalized.slice(1));
  const fileStat = await stat(path);
  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
    'Content-Length': fileStat.size,
    'Cache-Control': normalized === '/index.html' ? 'no-store' : 'public, max-age=300',
    'Content-Security-Policy': "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  createReadStream(path).pipe(response);
  return true;
}

export function createZarvisConsoleServer({
  orchestratorUrl = process.env.ZARVIS_ORCHESTRATOR_URL ?? 'http://127.0.0.1:8094',
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const upstream = new URL('/v1/commands', orchestratorUrl);

  if (!['http:', 'https:'].includes(upstream.protocol)) {
    throw new Error('ZARVIS_ORCHESTRATOR_URL must use http or https.');
  }

  return createServer(async (request, response) => {
    const requestId = request.headers['x-request-id']?.toString().slice(0, 160) || randomUUID();
    response.setHeader('X-Request-Id', requestId);

    try {
      const url = new URL(request.url ?? '/', 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/healthz') {
        writeJson(response, 200, { status: 'ok', service: 'zarvis-console', version: '0.1.0' });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/command') {
        const contentType = request.headers['content-type'] ?? '';
        if (!contentType.toLowerCase().startsWith('application/json')) {
          writeJson(response, 415, {
            error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' },
          });
          return;
        }

        const body = await readBody(request);
        const upstreamResponse = await fetchImpl(upstream, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-request-id': requestId,
            ...(request.headers['x-tenant-id'] ? { 'x-tenant-id': request.headers['x-tenant-id'] } : {}),
            ...(request.headers['x-user-id'] ? { 'x-user-id': request.headers['x-user-id'] } : {}),
          },
          body,
          redirect: 'error',
        });

        const upstreamBody = Buffer.from(await upstreamResponse.arrayBuffer());
        response.writeHead(upstreamResponse.status, {
          'Content-Type': upstreamResponse.headers.get('content-type') ?? 'application/json; charset=utf-8',
          'Content-Length': upstreamBody.length,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(upstreamBody);
        return;
      }

      if (request.method === 'GET' && await serveStatic(url.pathname, response)) {
        return;
      }

      writeJson(response, 404, {
        error: { code: 'route_not_found', message: 'Route not found.', request_id: requestId },
      });
    } catch (error) {
      logger.error('zarvis console request failed', {
        request_id: requestId,
        message: error?.message,
      });
      writeJson(response, error?.status ?? 502, {
        error: {
          code: error?.status === 413 ? 'request_too_large' : 'orchestrator_unavailable',
          message: error?.status === 413 ? error.message : 'The Z.A.R.V.I.S. orchestrator is unavailable.',
          request_id: requestId,
        },
      });
    }
  });
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 8095);
  const host = process.env.HOST ?? '0.0.0.0';
  const server = createZarvisConsoleServer();
  server.listen(port, host, () => {
    console.info(`zarvis-console listening on http://${host}:${port}`);
  });
}
