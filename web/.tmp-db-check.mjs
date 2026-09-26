import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000, max: 2 });
try {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('TABLES:', tables.rows.map(r => r.table_name).join(', ') || '(ninguna)');
  for (const table of ['servers', 'player_snapshots', 'schema_migrations']) {
    try {
      const count = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
      console.log(`${table}: ${count.rows[0].n} filas`);
    } catch (error) {
      console.log(`${table}: no existe (${error.message})`);
    }
  }
  const migrations = await pool.query('SELECT name FROM schema_migrations ORDER BY name').catch(() => ({ rows: [] }));
  console.log('MIGRATIONS:', migrations.rows.map(r => r.name).join(', ') || '(ninguna)');
  const servers = await pool.query('SELECT id, display_mode, lives_mode, shared_lives, no_lives_command_executions FROM servers').catch(() => ({ rows: [] }));
  console.log('SERVERS:', JSON.stringify(servers.rows));
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='player_snapshots' ORDER BY ordinal_position").catch(() => ({ rows: [] }));
  console.log('player_snapshots cols:', cols.rows.map(r => r.column_name).join(', '));
} catch (error) {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
