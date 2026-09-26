import pg from 'pg';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
const server = createApp({ pool, config }).listen(config.PORT, config.HOST, () => {
  console.log(`LivesHC web escuchando en http://${config.HOST}:${config.PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
