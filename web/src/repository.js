export async function saveSnapshot(pool, snapshot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO servers (id, lives_mode, shared_lives, no_lives_command_executions, captured_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (id) DO UPDATE SET lives_mode = EXCLUDED.lives_mode,
        shared_lives = EXCLUDED.shared_lives,
        no_lives_command_executions = EXCLUDED.no_lives_command_executions,
        captured_at = EXCLUDED.captured_at, updated_at = now()
    `, [snapshot.serverId, snapshot.livesMode, snapshot.sharedLives,
      snapshot.noLivesCommandExecutions, snapshot.capturedAt]);

    if (snapshot.resetOnline) {
      await client.query('UPDATE player_snapshots SET online = false WHERE server_id = $1', [snapshot.serverId]);
    }

    for (const player of snapshot.players) {
      await client.query(`
        INSERT INTO player_snapshots
          (server_id, uuid, name, individual_lives, play_time_seconds, online, world, dimension,
           x, y, z, last_seen_at, experience_level, total_experience, walked_centimeters, blocks_mined,
           mob_kills, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13,$14,$15,$16,$17,now())
        ON CONFLICT (server_id, uuid) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, player_snapshots.name),
          individual_lives = EXCLUDED.individual_lives,
          play_time_seconds = COALESCE(EXCLUDED.play_time_seconds, player_snapshots.play_time_seconds),
          online = EXCLUDED.online,
          world = COALESCE(EXCLUDED.world, player_snapshots.world),
          dimension = COALESCE(EXCLUDED.dimension, player_snapshots.dimension),
          x = COALESCE(EXCLUDED.x, player_snapshots.x), y = COALESCE(EXCLUDED.y, player_snapshots.y),
          z = COALESCE(EXCLUDED.z, player_snapshots.z),
          last_seen_at = COALESCE(EXCLUDED.last_seen_at, player_snapshots.last_seen_at),
          experience_level = COALESCE(EXCLUDED.experience_level, player_snapshots.experience_level),
          total_experience = COALESCE(EXCLUDED.total_experience, player_snapshots.total_experience),
          walked_centimeters = COALESCE(EXCLUDED.walked_centimeters, player_snapshots.walked_centimeters),
          blocks_mined = COALESCE(EXCLUDED.blocks_mined, player_snapshots.blocks_mined),
          mob_kills = COALESCE(EXCLUDED.mob_kills, player_snapshots.mob_kills),
          updated_at = CASE
            WHEN EXCLUDED.online OR player_snapshots.online THEN now()
            ELSE player_snapshots.updated_at
          END
      `, [snapshot.serverId, player.uuid, player.name, player.individualLives, player.playTimeSeconds,
        player.online, player.world, player.dimension, player.x, player.y, player.z, player.lastSeenAt,
        player.level, player.totalExperience, player.walkedCentimeters, player.blocksMined, player.mobKills]);
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
    SELECT s.lives_mode, s.shared_lives, s.no_lives_command_executions, s.captured_at,
      p.uuid, p.name, p.individual_lives,
      p.play_time_seconds, p.online, p.world, p.dimension, p.x, p.y, p.z,
      p.experience_level, p.total_experience, p.walked_centimeters, p.blocks_mined, p.mob_kills,
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
      noLivesCommandExecutions: Number(server.no_lives_command_executions), capturedAt: server.captured_at } : null,
    players: ids.map(uuid => {
      const row = byUuid.get(uuid);
      if (!row) return { uuid, name: null, lives: null, online: false, playTimeSeconds: null,
        location: null, lastSeenAt: null, updatedAt: null, level: null, totalExperience: null,
        walkedCentimeters: null, blocksMined: null, mobKills: null };
      return {
        uuid, name: row.name, lives: row.lives_mode === 'shared' ? row.shared_lives : row.individual_lives,
        online: row.online, playTimeSeconds: Number(row.play_time_seconds ?? 0),
        level: row.experience_level == null ? null : Number(row.experience_level),
        totalExperience: row.total_experience == null ? null : Number(row.total_experience),
        walkedCentimeters: row.walked_centimeters == null ? null : Number(row.walked_centimeters),
        blocksMined: row.blocks_mined == null ? null : Number(row.blocks_mined),
        mobKills: row.mob_kills == null ? null : Number(row.mob_kills),
        location: row.x === null ? null : { world: row.world, dimension: row.dimension,
          x: row.x, y: row.y, z: row.z },
        lastSeenAt: row.last_seen_at, updatedAt: row.updated_at
      };
    })
  };
}
