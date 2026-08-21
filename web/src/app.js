import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { snapshotSchema } from './schema.js';
import { getVersus, saveSnapshot } from './repository.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

function tokenMatches(expected, supplied = '') {
  const expectedBuffer = Buffer.from(`Bearer ${expected}`);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function createApp({ pool, config }) {
  const app = express();
  const skinOrigin = new URL(config.SKIN_URL_TEMPLATE).origin;
  app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.set({
      'Content-Security-Policy': `default-src 'self'; img-src 'self' data: ${skinOrigin}; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'`,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff'
    });
    next();
  });
  app.use(express.json({ limit: '512kb', strict: true }));

  app.get('/health', async (_request, response) => {
    try {
      await pool.query('SELECT 1');
      response.json({ status: 'ok' });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });

  app.post('/internal/v1/snapshot', async (request, response, next) => {
    if (!tokenMatches(config.INGEST_TOKEN, request.get('authorization'))) {
      return response.status(401).json({ error: 'unauthorized' });
    }
    const parsed = snapshotSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ error: 'invalid_snapshot', details: parsed.error.issues });
    }
    if (parsed.data.serverId !== config.SERVER_ID) {
      return response.status(403).json({ error: 'unknown_server' });
    }
    try {
      await saveSnapshot(pool, parsed.data);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/v1/versus', async (_request, response, next) => {
    try {
      response.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=20');
      response.json(await getVersus(pool, config));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/config', (_request, response) => {
    response.set('Cache-Control', 'public, max-age=3600');
    response.json({ skinUrlTemplate: config.SKIN_URL_TEMPLATE });
  });

  app.use(express.static(publicDir, { maxAge: '1h', etag: true }));
  app.get('/{*path}', (_request, response) => response.sendFile(path.join(publicDir, 'index.html')));
  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ error: 'internal_error' });
  });
  return app;
}
