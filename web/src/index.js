import pg from 'pg';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('Aviso cargando .env:', err.message);
  }
}

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
const server = createApp({ pool, config }).listen(config.PORT, () => {
  console.log(`LivesHC web escuchando en :${config.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
