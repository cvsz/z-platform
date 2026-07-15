import express from 'express';
import { Readable } from 'stream';
import Redis from 'ioredis';
import fetch from 'node-fetch';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';

dotenv.config();

// Structured logger with strict secret redaction
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-api-key"]'],
    censor: '[REDACTED]'
  }
});

const app = express();

// Enterprise security and middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' })); // Restrict in production
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger }));

// Persistence
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(REDIS_URL);
redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));

// Authentication Middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || token !== process.env.Z_PLATFORM_SERVICE_TOKEN) {
    logger.warn({ ip: req.ip }, 'Unauthorized access attempt');
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing service token' } });
  }
  next();
};

// Health & Metrics
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-gateway' });
});

// Primary Gateway Route
app.post('/v1/chat/completions', requireAuth, async (req, res) => {
  const provider = req.headers['x-provider'] || 'openai-compatible';
  const modelId = req.body.model;
  
  if (!modelId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Model ID is required' } });
  }

  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const key = await redis.srandmember(`provider:${provider}:active_keys`);
    
    if (!key) {
      logger.error({ provider }, 'No active keys available in pool');
      return res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'No upstream provider keys available' } });
    }
    
    try {
      const upstreamUrl = process.env.UPSTREAM_BASE_URL || 'https://api.openai.com/v1';
      
      const response = await fetch(`${upstreamUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(req.body)
      });
      
      if (response.ok) {
        if (req.body.stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          return Readable.fromWeb(response.body).pipe(res);
        } else {
          const data = await response.json();
          return res.status(200).json(data);
        }
      } else if (response.status === 429) {
        await redis.srem(`provider:${provider}:active_keys`, key);
        await redis.set(`provider:${provider}:cooldown_keys:${key}`, 'cooldown', 'EX', 3600);
        logger.warn({ provider, attempt }, 'Rate limit hit (429). Key rotated to cooldown.');
        lastError = { status: 429, message: 'Upstream rate limit' };
        continue;
      } else if (response.status === 401 || response.status === 403) {
        await redis.srem(`provider:${provider}:active_keys`, key);
        await redis.sadd(`provider:${provider}:invalid_keys`, key);
        logger.warn({ provider, attempt, status: response.status }, 'Key invalid. Permanently removed.');
        lastError = { status: response.status, message: 'Upstream authentication failed' };
        continue;
      } else {
        const errText = await response.text();
        logger.error({ status: response.status, body: errText }, 'Upstream error');
        return res.status(502).json({ error: { code: 'BAD_GATEWAY', message: 'Upstream provider error' } });
      }
    } catch (error) {
      logger.error({ err: error }, 'Internal fetch error');
      lastError = { status: 500, message: 'Internal network error' };
    }
  }
  
  logger.error({ provider, lastError }, 'Exhausted all retry attempts');
  return res.status(502).json({ error: { code: 'EXHAUSTED', message: 'Provider routing failed after retries' } });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`AI Gateway running on port ${PORT}`);
});
