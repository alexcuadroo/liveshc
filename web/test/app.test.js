import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

const PLAYER_1 = '00000000-0000-4000-8000-000000000001';
const PLAYER_2 = '00000000-0000-4000-8000-000000000002';

const config = {
  INGEST_TOKEN: 'this-is-a-long-test-token-1234',
  SERVER_ID: 'principal',
  SERVER_ADDRESS: 'test.example.com',
  SKIN_URL_TEMPLATE: 'https://example.com/{uuid}.png',
  TRUST_PROXY: 1,
  MAX_PLAYERS: 30
};

function poolWith({ serverRow, playerRows = [], deathRows = [] }) {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM servers WHERE')) return { rows: serverRow ? [serverRow] : [], rowCount: serverRow ? 1 : 0 };
      if (sql.includes('FROM player_snapshots')) return { rows: playerRows, rowCount: playerRows.length };
      if (sql.includes('FROM death_events')) return { rows: deathRows, rowCount: deathRows.length };
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
    uuid: PLAYER_1, name: 'Alex', individualLives: 3, deaths: 2,
    playTimeSeconds: 120, online: true, world: 'minecraft:overworld', dimension: 'NORMAL',
    x: 10, y: 64, z: -20, lastSeenAt: '2026-08-20T12:00:00Z', level: 12,
    totalExperience: 1234, walkedCentimeters: 567_890, blocksMined: 456, mobKills: 78
  }]
};

const playerRow = (overrides = {}) => ({
  uuid: PLAYER_1, name: 'Alex', individual_lives: 4, deaths: 7,
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
  const playerInsert = pool.queries.find(item => item.sql.includes('INSERT INTO player_snapshots'));
  assert.ok(playerInsert);
  assert.equal(playerInsert.params[4], 2);
});

test('defaults missing deaths to zero for older plugins', async () => {
  const pool = poolForSave();
  const { deaths: _ignored, ...player } = validSnapshot.players[0];
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send({ ...validSnapshot, players: [player] });
  assert.equal(response.status, 204);
  const playerInsert = pool.queries.find(item => item.sql.includes('INSERT INTO player_snapshots'));
  assert.equal(playerInsert.params[4], 0);
});

test('accepts Floodgate (Bedrock) UUIDs in snapshots', async () => {
  const pool = poolForSave();
  const floodgate = '00000000-0000-0000-0009-01f7810a7666';
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send({
      ...validSnapshot,
      players: [{ ...validSnapshot.players[0], uuid: floodgate, name: '.AlexCuadro7412' }]
    });
  assert.equal(response.status, 204);
  const playerInsert = pool.queries.find(item => item.sql.includes('INSERT INTO player_snapshots'));
  assert.equal(playerInsert.params[1], floodgate);
});

test('solo returns every tracked player up to the configured limit', async () => {
  const pool = poolWith({
    serverRow: serverRow({ display_mode: 'solo' }),
    playerRows: [playerRow(), playerRow({ uuid: PLAYER_2, name: 'Sam', online: false, deaths: 0 })]
  });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.equal(response.body.server.displayMode, 'solo');
  assert.equal(response.body.players.length, 2);
  assert.equal(response.body.players[0].uuid, PLAYER_1);
  assert.equal(response.body.players[0].deaths, 7);
  assert.equal(response.body.players[1].uuid, PLAYER_2);
  assert.equal(response.body.players[1].deaths, 0);
  const playersQuery = pool.queries.find(item => item.sql.includes('FROM player_snapshots'));
  assert.equal(playersQuery.params[1], config.MAX_PLAYERS);
});

test('coop returns every tracked player up to the configured limit', async () => {
  const pool = poolWith({
    serverRow: serverRow({ display_mode: 'coop', lives_mode: 'shared', shared_lives: 2 }),
    playerRows: [
      playerRow(),
      playerRow({ uuid: PLAYER_2, name: 'Sam', online: false }),
      playerRow({ uuid: '00000000-0000-0000-0009-01f7810a7666', name: '.AlexCuadro7412', online: false })
    ]
  });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.equal(response.body.players.length, 3);
  assert.equal(response.body.players[0].lives, 2);
  const playersQuery = pool.queries.find(item => item.sql.includes('FROM player_snapshots'));
  assert.equal(playersQuery.params[1], config.MAX_PLAYERS);
  assert.ok(playersQuery.sql.includes('ORDER BY online DESC'));
});

test('orders the roster alphabetically ignoring the Bedrock dot', async () => {
  const pool = poolWith({
    serverRow: serverRow(),
    playerRows: [
      playerRow({ uuid: PLAYER_1, name: 'AlexNdh', online: false }),
      playerRow({ uuid: PLAYER_2, name: '.AlexCuadro7412', online: false })
    ]
  });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  const playersQuery = pool.queries.find(item => item.sql.includes('FROM player_snapshots'));
  assert.ok(playersQuery.sql.includes("LOWER(LTRIM(name, '.'))"));
});

test('returns empty players before the first snapshot', async () => {
  const pool = poolWith({ serverRow: null });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.equal(response.body.server, null);
  assert.deepEqual(response.body.players, []);
});

test('exposes the front-end configuration including the server address', async () => {
  const pool = poolWith({ serverRow: null });
  const response = await request(createApp({ pool, config })).get('/api/v1/config');
  assert.equal(response.status, 200);
  assert.equal(response.body.skinUrlTemplate, config.SKIN_URL_TEMPLATE);
  assert.equal(response.body.serverAddress, config.SERVER_ADDRESS);
});

test('serves front-end assets with revalidation headers', async () => {
  const pool = poolWith({ serverRow: null });
  const list = await request(createApp({ pool, config })).get('/app.js');
  assert.equal(list.status, 200);
  assert.equal(list.headers['cache-control'], 'no-cache');

  const page = await request(createApp({ pool, config })).get('/');
  assert.equal(page.status, 200);
  assert.equal(page.headers['cache-control'], 'no-cache');
});

test('health reports unavailable when PostgreSQL fails', async () => {
  const pool = { query: async () => { throw new Error('offline'); } };
  const response = await request(createApp({ pool, config })).get('/health');
  assert.equal(response.status, 503);
});

test('versus endpoint includes player health, equipment, and recent deaths', async () => {
  const pool = poolWith({
    serverRow: serverRow(),
    playerRows: [playerRow({
      health: 18.5, max_health: 20.0, food_level: 19,
      helmet: 'NETHERITE_HELMET', chestplate: 'DIAMOND_CHESTPLATE',
      leggings: null, boots: 'IRON_BOOTS', offhand: 'TOTEM_OF_UNDYING'
    })],
    deathRows: [{
      id: 1, victim: 'Bren21sm', message: 'Bren21sm fue víctima de Esqueleto', killer: 'Esqueleto',
      created_at: new Date('2026-10-12T05:00:00Z')
    }]
  });
  const response = await request(createApp({ pool, config })).get('/api/v1/versus');
  assert.equal(response.status, 200);
  assert.equal(response.body.players[0].health, 18.5);
  assert.equal(response.body.players[0].foodLevel, 19);
  assert.equal(response.body.players[0].equipment.helmet, 'NETHERITE_HELMET');
  assert.equal(response.body.players[0].equipment.offhand, 'TOTEM_OF_UNDYING');
  assert.equal(response.body.recentDeaths.length, 1);
  assert.equal(response.body.recentDeaths[0].victim, 'Bren21sm');
  assert.equal(response.body.recentDeaths[0].message, 'Bren21sm fue víctima de Esqueleto');
});

test('ingests snapshot with health, equipment and recent deaths', async () => {
  const pool = poolForSave();
  const snapshotWithAll = {
    ...validSnapshot,
    players: [{
      ...validSnapshot.players[0],
      health: 15.0, maxHealth: 20.0, foodLevel: 18,
      equipment: { helmet: 'DIAMOND_HELMET', chestplate: 'IRON_CHESTPLATE', leggings: null, boots: null, offhand: 'SHIELD' }
    }],
    recentDeaths: [{
      victim: 'Alex', message: 'Alex cayó desde un lugar alto', killer: null,
      timestamp: '2026-08-20T12:00:00Z'
    }]
  };
  const response = await request(createApp({ pool, config }))
    .post('/internal/v1/snapshot')
    .set('Authorization', `Bearer ${config.INGEST_TOKEN}`)
    .send(snapshotWithAll);
  assert.equal(response.status, 204);
  const deathInsert = pool.queries.find(item => item.sql.includes('INSERT INTO death_events'));
  assert.ok(deathInsert);
  assert.equal(deathInsert.params[1], 'Alex');
});

test('serves overlay and builder pages with no-cache', async () => {
  const pool = poolWith({ serverRow: null });
  const app = createApp({ pool, config });

  const overlayRes = await request(app).get('/overlay');
  assert.equal(overlayRes.status, 200);
  assert.equal(overlayRes.headers['cache-control'], 'no-cache');
  assert.match(overlayRes.headers['content-security-policy'], /frame-ancestors 'self'/);

  const builderRes = await request(app).get('/overlay/builder');
  assert.equal(builderRes.status, 200);
  assert.equal(builderRes.headers['cache-control'], 'no-cache');
  assert.match(builderRes.headers['content-security-policy'], /frame-ancestors 'none'/);
});

test('config endpoint exposes head templates', async () => {
  const pool = poolWith({ serverRow: null });
  const customConfig = {
    ...config,
    HEAD_URL_TEMPLATE: 'https://custom-heads.example.com/flat/{uuid}',
    HEAD_3D_URL_TEMPLATE: 'https://custom-heads.example.com/3d/{uuid}'
  };
  const response = await request(createApp({ pool, config: customConfig })).get('/api/v1/config');
  assert.equal(response.status, 200);
  assert.equal(response.body.headUrlTemplate, customConfig.HEAD_URL_TEMPLATE);
  assert.equal(response.body.head3dUrlTemplate, customConfig.HEAD_3D_URL_TEMPLATE);
});

