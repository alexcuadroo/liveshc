import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

const config = {
  INGEST_TOKEN: 'this-is-a-long-test-token-1234',
  SERVER_ID: 'principal',
  FEATURED_PLAYER_1_UUID: '00000000-0000-4000-8000-000000000001',
  FEATURED_PLAYER_2_UUID: '00000000-0000-4000-8000-000000000002',
  SKIN_URL_TEMPLATE: 'https://example.com/{uuid}.png',
  TRUST_PROXY: 1
};

function poolWithRows(rows = []) {
  const queries = [];
  const client = {
    query: async (sql, params) => { queries.push({ sql, params }); return { rows: [], rowCount: 0 }; },
    release() {}
  };
  return {
    queries,
    query: async (sql, params) => { queries.push({ sql, params }); return { rows, rowCount: rows.length }; },
    connect: async () => client
  };
}

const validSnapshot = {
  serverId: 'principal', capturedAt: '2026-08-20T12:00:00Z', resetOnline: false,
  noLivesCommandExecutions: 10,
  livesMode: 'individual', sharedLives: null,
  players: [{
    uuid: config.FEATURED_PLAYER_1_UUID, name: 'Alex', individualLives: 3,
    playTimeSeconds: 120, online: true, world: 'minecraft:overworld', dimension: 'NORMAL',
    x: 10, y: 64, z: -20, lastSeenAt: '2026-08-20T12:00:00Z', level: 12,
    totalExperience: 1234, walkedCentimeters: 567_890, blocksMined: 456, mobKills: 78
  }]
};

test('rejects snapshot without the ingestion token', async () => {
  const response = await request(createApp({ pool: poolWithRows(), config }))
    .post('/internal/v1/snapshot').send(validSnapshot);
  assert.equal(response.status, 401);
});

test('rejects malformed snapshots before accessing the database', async () => {
  const pool = poolWithRows();
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send({ ...validSnapshot, players: [{ ...validSnapshot.players[0], blocksMined: -1 }] });
  assert.equal(response.status, 400);
  assert.equal(pool.queries.length, 0);
});

test('accepts a valid authenticated snapshot', async () => {
  const pool = poolWithRows();
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send(validSnapshot);
  assert.equal(response.status, 204);
  const serverUpsert = pool.queries.find(item => item.sql.includes('INSERT INTO servers'));
  assert.ok(serverUpsert);
  assert.equal(serverUpsert.params[3], 10);
  assert.ok(serverUpsert.sql.includes('no_lives_command_executions = EXCLUDED.no_lives_command_executions'));
  const playerUpsert = pool.queries.find(item => item.sql.includes('INSERT INTO player_snapshots'));
  assert.ok(playerUpsert.sql.includes('blocks_mined'));
  assert.equal(playerUpsert.params[11], validSnapshot.players[0].lastSeenAt);
  assert.equal(playerUpsert.params[14], validSnapshot.players[0].walkedCentimeters);
});

test('public response contains only configured featured UUIDs', async () => {
  const rows = [{
    lives_mode: 'shared', shared_lives: 2, no_lives_command_executions: '10', captured_at: new Date(),
    uuid: config.FEATURED_PLAYER_1_UUID, name: 'Alex', individual_lives: 4,
    play_time_seconds: '3600', online: true, world: 'minecraft:overworld', dimension: 'NORMAL',
    x: 1, y: 2, z: 3, last_seen_at: new Date(), updated_at: new Date(), experience_level: 12,
    total_experience: '1234', walked_centimeters: '567890', blocks_mined: '456', mob_kills: '78'
  }];
  const response = await request(createApp({ pool: poolWithRows(rows), config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.players.map(player => player.uuid),
    [config.FEATURED_PLAYER_1_UUID, config.FEATURED_PLAYER_2_UUID]);
  assert.equal(response.body.players[0].lives, 2);
  assert.equal(response.body.server.noLivesCommandExecutions, 10);
  assert.equal(response.body.players[0].level, 12);
  assert.equal(response.body.players[0].walkedCentimeters, 567890);
  assert.equal(response.body.players[0].mobKills, 78);
  assert.equal(response.body.players[1].name, null);
});

test('health reports unavailable when PostgreSQL fails', async () => {
  const pool = { query: async () => { throw new Error('offline'); } };
  const response = await request(createApp({ pool, config })).get('/health');
  assert.equal(response.status, 503);
});
