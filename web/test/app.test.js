import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

const PLAYER_1 = '00000000-0000-4000-8000-000000000001';
const PLAYER_2 = '00000000-0000-4000-8000-000000000002';

const config = {
  INGEST_TOKEN: 'this-is-a-long-test-token-1234',
  SERVER_ID: 'principal',
  SKIN_URL_TEMPLATE: 'https://example.com/{uuid}.png',
  TRUST_PROXY: 1
};

function poolWith({ serverRow, playerRows = [] }) {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM servers WHERE')) return { rows: serverRow ? [serverRow] : [], rowCount: serverRow ? 1 : 0 };
      if (sql.includes('FROM player_snapshots')) return { rows: playerRows, rowCount: playerRows.length };
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async (sql, params) => { queries.push({ sql, params }); return { rows: [], rowCount: 0 }; },
      release() {}
    })
  };
}

function poolForSave() {
  const queries = [];
  const client = {
    query: async (sql, params) => { queries.push({ sql, params }); return { rows: [], rowCount: 0 }; },
    release() {}
  };
  return { queries, query: client.query, connect: async () => client };
}

const validSnapshot = {
  serverId: 'principal', capturedAt: '2026-08-20T12:00:00Z', resetOnline: false,
  displayMode: 'coop',
  noLivesCommandExecutions: 10,
  livesMode: 'individual', sharedLives: null,
  players: [{
    uuid: PLAYER_1, name: 'Alex', individualLives: 3,
    playTimeSeconds: 120, online: true, world: 'minecraft:overworld', dimension: 'NORMAL',
    x: 10, y: 64, z: -20, lastSeenAt: '2026-08-20T12:00:00Z', level: 12,
    totalExperience: 1234, walkedCentimeters: 567_890, blocksMined: 456, mobKills: 78
  }]
};

const playerRow = (overrides = {}) => ({
  uuid: PLAYER_1, name: 'Alex', individual_lives: 4,
  play_time_seconds: '3600', online: true, world: 'minecraft:overworld', dimension: 'NORMAL',
  x: 1, y: 2, z: 3, last_seen_at: new Date(), updated_at: new Date(), experience_level: 12,
  total_experience: '1234', walked_centimeters: '567890', blocks_mined: '456', mob_kills: '78',
  ...overrides
});

const serverRow = (overrides = {}) => ({
  id: 'principal', lives_mode: 'individual', shared_lives: null, display_mode: 'coop',
  no_lives_command_executions: '10', captured_at: new Date(),
  ...overrides
});

test('rejects snapshot without the ingestion token', async () => {
  const response = await request(createApp({ pool: poolForSave(), config }))
    .post('/internal/v1/snapshot').send(validSnapshot);
  assert.equal(response.status, 401);
});

test('rejects malformed snapshots before accessing the database', async () => {
  const pool = poolForSave();
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send({ ...validSnapshot, players: [{ ...validSnapshot.players[0], blocksMined: -1 }] });
  assert.equal(response.status, 400);
  assert.equal(pool.queries.length, 0);
});

test('rejects snapshots without displayMode', async () => {
  const pool = poolForSave();
  const { displayMode: _ignored, ...withoutMode } = validSnapshot;
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send(withoutMode);
  assert.equal(response.status, 400);
  assert.equal(pool.queries.length, 0);
});

test('rejects unknown displayMode', async () => {
  const pool = poolForSave();
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send({ ...validSnapshot, displayMode: 'versus' });
  assert.equal(response.status, 400);
  assert.equal(pool.queries.length, 0);
});

test('accepts a valid authenticated snapshot', async () => {
  const pool = poolForSave();
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send(validSnapshot);
  assert.equal(response.status, 204);
  const serverUpsert = pool.queries.find(item => item.sql.includes('INSERT INTO servers'));
  assert.ok(serverUpsert);
  assert.equal(serverUpsert.params[4], 'coop');
});

test('solo returns one auto-selected player', async () => {
  const pool = poolWith({ serverRow: serverRow({ display_mode: 'solo' }), playerRows: [playerRow()] });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.equal(response.body.server.displayMode, 'solo');
  assert.equal(response.body.players.length, 1);
  assert.equal(response.body.players[0].uuid, PLAYER_1);
  const playersQuery = pool.queries.find(item => item.sql.includes('FROM player_snapshots'));
  assert.equal(playersQuery.params[1], 1);
});

test('coop returns two auto-selected players ordered by online', async () => {
  const pool = poolWith({
    serverRow: serverRow({ display_mode: 'coop', lives_mode: 'shared', shared_lives: 2 }),
    playerRows: [playerRow(), playerRow({ uuid: PLAYER_2, name: 'Sam', online: false })]
  });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.equal(response.body.players.length, 2);
  assert.equal(response.body.players[0].lives, 2);
  const playersQuery = pool.queries.find(item => item.sql.includes('FROM player_snapshots'));
  assert.equal(playersQuery.params[1], 2);
  assert.ok(playersQuery.sql.includes('ORDER BY online DESC'));
});

test('returns empty players before the first snapshot', async () => {
  const pool = poolWith({ serverRow: null });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.equal(response.body.server, null);
  assert.deepEqual(response.body.players, []);
});

test('health reports unavailable when PostgreSQL fails', async () => {
  const pool = { query: async () => { throw new Error('offline'); } };
  const response = await request(createApp({ pool, config })).get('/health');
  assert.equal(response.status, 503);
});
