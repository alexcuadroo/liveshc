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
  const headTemplate = config.HEAD_URL_TEMPLATE ?? 'https://mc-heads.net/avatar/{uuid}/128';
  const head3dTemplate = config.HEAD_3D_URL_TEMPLATE ?? 'https://mc-heads.net/head/{uuid}/128';
  const imageOrigins = [...new Set([config.SKIN_URL_TEMPLATE, headTemplate, head3dTemplate]
    .map(template => new URL(template).origin))].join(' ');
  app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    // El overlay se previsualiza dentro de un iframe del editor (mismo origen).
    const frameAncestors = request.path === '/overlay' ? "'self'" : "'none'";
    response.set({
      'Content-Security-Policy': `default-src 'self'; img-src 'self' data: ${imageOrigins}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' https://static.cloudflareinsights.com 'unsafe-inline'; connect-src 'self' https://cloudflareinsights.com; frame-src 'self'; frame-ancestors ${frameAncestors}; base-uri 'self'`,
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
    response.json({
      skinUrlTemplate: config.SKIN_URL_TEMPLATE,
      headUrlTemplate: headTemplate,
      head3dUrlTemplate: head3dTemplate,
      serverAddress: config.SERVER_ADDRESS
    });
  });

  const sendPage = file => (_request, response) => {
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(path.join(publicDir, file));
  };
  app.get('/overlay', sendPage('overlay.html'));
  app.get(['/overlay/builder', '/overlay/editor'], sendPage('overlay-builder.html'));

  app.use(express.static(publicDir, {
    etag: true,
    setHeaders(response, filePath) {
      // Los assets se revalidan con ETag para que un despliegue no quede servido
      // desde cachés intermedias (Cloudflare) con una versión anterior.
      response.setHeader('Cache-Control', /\.(?:html|js|css)$/i.test(filePath) ? 'no-cache' : 'public, max-age=86400');
    }
  }));
  app.get('/{*path}', (_request, response) => {
    response.setHeader('Cache-Control', 'no-cache');
    response.sendFile(path.join(publicDir, 'index.html'));
  });
  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ error: 'internal_error' });
  });
  return app;
}
