export async function saveSnapshot(pool, snapshot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO servers (id, lives_mode, shared_lives, captured_at, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (id) DO UPDATE SET lives_mode = EXCLUDED.lives_mode,
        shared_lives = EXCLUDED.shared_lives, captured_at = EXCLUDED.captured_at, updated_at = now()
    `, [snapshot.serverId, snapshot.livesMode, snapshot.sharedLives, snapshot.capturedAt]);

    if (snapshot.resetOnline) {
      await client.query('UPDATE player_snapshots SET online = false WHERE server_id = $1', [snapshot.serverId]);
    }

    for (const player of snapshot.players) {
      await client.query(`
        INSERT INTO player_snapshots
          (server_id, uuid, name, individual_lives, play_time_seconds, online, world, dimension,
           x, y, z, last_seen_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $6 THEN $12::timestamptz ELSE NULL END,now())
        ON CONFLICT (server_id, uuid) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, player_snapshots.name),
          individual_lives = EXCLUDED.individual_lives,
          play_time_seconds = COALESCE(EXCLUDED.play_time_seconds, player_snapshots.play_time_seconds),
          online = EXCLUDED.online,
          world = COALESCE(EXCLUDED.world, player_snapshots.world),
          dimension = COALESCE(EXCLUDED.dimension, player_snapshots.dimension),
          x = COALESCE(EXCLUDED.x, player_snapshots.x), y = COALESCE(EXCLUDED.y, player_snapshots.y),
          z = COALESCE(EXCLUDED.z, player_snapshots.z),
          last_seen_at = CASE WHEN EXCLUDED.online THEN EXCLUDED.last_seen_at ELSE player_snapshots.last_seen_at END,
          updated_at = CASE
            WHEN EXCLUDED.online OR player_snapshots.online THEN now()
            ELSE player_snapshots.updated_at
          END
      `, [snapshot.serverId, player.uuid, player.name, player.individualLives, player.playTimeSeconds,
        player.online, player.world, player.dimension, player.x, player.y, player.z, snapshot.capturedAt]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getVersus(pool, config) {
  const result = await pool.query(`
    SELECT s.lives_mode, s.shared_lives, s.captured_at, p.uuid, p.name, p.individual_lives,
      p.play_time_seconds, p.online, p.world, p.dimension, p.x, p.y, p.z,
      p.last_seen_at, p.updated_at
    FROM servers s
    LEFT JOIN player_snapshots p ON p.server_id = s.id AND p.uuid = ANY($2::uuid[])
    WHERE s.id = $1
  `, [config.SERVER_ID, [config.FEATURED_PLAYER_1_UUID, config.FEATURED_PLAYER_2_UUID]]);

  const server = result.rows[0];
  const byUuid = new Map(result.rows.filter(row => row.uuid).map(row => [row.uuid, row]));
  const ids = [config.FEATURED_PLAYER_1_UUID, config.FEATURED_PLAYER_2_UUID];
  return {
    server: server ? { id: config.SERVER_ID, livesMode: server.lives_mode, sharedLives: server.shared_lives,
      capturedAt: server.captured_at } : null,
    players: ids.map(uuid => {
      const row = byUuid.get(uuid);
      if (!row) return { uuid, name: null, lives: null, online: false, playTimeSeconds: null,
        location: null, lastSeenAt: null, updatedAt: null };
      return {
        uuid, name: row.name, lives: row.lives_mode === 'shared' ? row.shared_lives : row.individual_lives,
        online: row.online, playTimeSeconds: Number(row.play_time_seconds ?? 0),
        location: row.x === null ? null : { world: row.world, dimension: row.dimension,
          x: row.x, y: row.y, z: row.z },
        lastSeenAt: row.last_seen_at, updatedAt: row.updated_at
      };
    })
  };
}
