import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  UnsupportedIntentError,
  ValidationError,
} from './contracts.mjs';
import { GitHubStatusToolError } from './github-status-tool.mjs';
import { AVAILABLE_TOOLS, ZarvisOrchestrator } from './orchestrator.mjs';

const MAX_BODY_BYTES = 32 * 1024;

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

async function readJsonBody(request) {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ValidationError('Content-Type must be application/json.');
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new ValidationError(`Request body exceeds ${MAX_BODY_BYTES} bytes.`);
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    throw new ValidationError('Request body is required.');
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ValidationError('Request body must contain valid JSON.');
  }
}

export function createStdoutAuditSink({ logger = console } = {}) {
  return async (event) => {
    logger.info(JSON.stringify({ channel: 'audit', event }));
  };
}

export function createZarvisServer({
  orchestrator = new ZarvisOrchestrator({ auditSink: createStdoutAuditSink() }),
  logger = console,
} = {}) {
  return createServer(async (request, response) => {
    const requestId = request.headers['x-request-id']?.toString().slice(0, 160) || randomUUID();
    response.setHeader('X-Request-Id', requestId);

    try {
      const url = new URL(request.url ?? '/', 'http://localhost');

      if (request.method === 'GET' && url.pathname === '/healthz') {
        writeJson(response, 200, {
          status: 'ok',
          service: 'zarvis-orchestrator',
          version: '0.1.0',
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/v1/tools') {
        writeJson(response, 200, { tools: AVAILABLE_TOOLS });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/v1/commands') {
        const command = await readJsonBody(request);
        const result = await orchestrator.execute(command, {
          requestId,
          tenantId: request.headers['x-tenant-id']?.toString() || 'anonymous',
          userId: request.headers['x-user-id']?.toString() || 'anonymous',
        });
        writeJson(response, 200, result);
        return;
      }

      writeJson(response, 404, {
        error: {
          code: 'route_not_found',
          message: 'Route not found.',
          request_id: requestId,
        },
      });
    } catch (error) {
      let statusCode = 500;
      if (error instanceof ValidationError) {
        statusCode = error.status ?? 400;
      } else if (error instanceof UnsupportedIntentError) {
        statusCode = 422;
      } else if (error instanceof GitHubStatusToolError) {
        statusCode = error.status;
      }

      if (statusCode >= 500) {
        logger.error('zarvis request failed', {
          request_id: requestId,
          code: error?.code ?? 'internal_error',
          message: error?.message,
        });
      }

      writeJson(response, statusCode, {
        error: {
          code: error?.code ?? 'internal_error',
          message: statusCode >= 500 ? 'The request could not be completed.' : error.message,
          request_id: requestId,
          ...(error?.details ? { details: error.details } : {}),
        },
      });
    }
  });
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 8094);
  const host = process.env.HOST ?? '0.0.0.0';
  const server = createZarvisServer();
  server.listen(port, host, () => {
    console.info(`zarvis-orchestrator listening on http://${host}:${port}`);
  });
}
