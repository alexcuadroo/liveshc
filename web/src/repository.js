export async function saveSnapshot(pool, snapshot) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO servers (id, lives_mode, shared_lives, no_lives_command_executions, display_mode, captured_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (id) DO UPDATE SET lives_mode = EXCLUDED.lives_mode,
        shared_lives = EXCLUDED.shared_lives,
        no_lives_command_executions = EXCLUDED.no_lives_command_executions,
        display_mode = EXCLUDED.display_mode,
        captured_at = EXCLUDED.captured_at, updated_at = now()
    `, [snapshot.serverId, snapshot.livesMode, snapshot.sharedLives,
      snapshot.noLivesCommandExecutions, snapshot.displayMode, snapshot.capturedAt]);

    if (snapshot.resetOnline) {
      await client.query('UPDATE player_snapshots SET online = false WHERE server_id = $1', [snapshot.serverId]);
    }

    for (const player of snapshot.players) {
      const eq = player.equipment ?? {};
      await client.query(`
        INSERT INTO player_snapshots
          (server_id, uuid, name, individual_lives, deaths, play_time_seconds, online, world, dimension,
           x, y, z, last_seen_at, experience_level, total_experience, walked_centimeters, blocks_mined,
           mob_kills, health, max_health, food_level, helmet, chestplate, leggings, boots, offhand, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::timestamptz,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,now())
        ON CONFLICT (server_id, uuid) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, player_snapshots.name),
          individual_lives = EXCLUDED.individual_lives,
          deaths = EXCLUDED.deaths,
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
          health = CASE WHEN EXCLUDED.online THEN EXCLUDED.health ELSE COALESCE(EXCLUDED.health, player_snapshots.health) END,
          max_health = CASE WHEN EXCLUDED.online THEN EXCLUDED.max_health ELSE COALESCE(EXCLUDED.max_health, player_snapshots.max_health) END,
          food_level = CASE WHEN EXCLUDED.online THEN EXCLUDED.food_level ELSE COALESCE(EXCLUDED.food_level, player_snapshots.food_level) END,
          helmet = CASE WHEN EXCLUDED.online THEN EXCLUDED.helmet ELSE COALESCE(EXCLUDED.helmet, player_snapshots.helmet) END,
          chestplate = CASE WHEN EXCLUDED.online THEN EXCLUDED.chestplate ELSE COALESCE(EXCLUDED.chestplate, player_snapshots.chestplate) END,
          leggings = CASE WHEN EXCLUDED.online THEN EXCLUDED.leggings ELSE COALESCE(EXCLUDED.leggings, player_snapshots.leggings) END,
          boots = CASE WHEN EXCLUDED.online THEN EXCLUDED.boots ELSE COALESCE(EXCLUDED.boots, player_snapshots.boots) END,
          offhand = CASE WHEN EXCLUDED.online THEN EXCLUDED.offhand ELSE COALESCE(EXCLUDED.offhand, player_snapshots.offhand) END,
          updated_at = CASE
            WHEN EXCLUDED.online OR player_snapshots.online THEN now()
            ELSE player_snapshots.updated_at
          END
      `, [snapshot.serverId, player.uuid, player.name, player.individualLives, player.deaths, player.playTimeSeconds,
        player.online, player.world, player.dimension, player.x, player.y, player.z, player.lastSeenAt,
        player.level, player.totalExperience, player.walkedCentimeters, player.blocksMined, player.mobKills,
        player.health ?? null, player.maxHealth ?? null, player.foodLevel ?? null,
        eq.helmet ?? null, eq.chestplate ?? null, eq.leggings ?? null, eq.boots ?? null, eq.offhand ?? null]);
    }

    if (Array.isArray(snapshot.recentDeaths) && snapshot.recentDeaths.length > 0) {
      for (const death of snapshot.recentDeaths) {
        await client.query(`
          INSERT INTO death_events (server_id, victim, message, killer, created_at)
          VALUES ($1, $2, $3, $4, $5::timestamptz)
        `, [snapshot.serverId, death.victim, death.message, death.killer ?? null, death.timestamp]);
      }
      // Retener como máximo 100 eventos por servidor
      await client.query(`
        DELETE FROM death_events
        WHERE server_id = $1 AND id NOT IN (
          SELECT id FROM death_events WHERE server_id = $1 ORDER BY created_at DESC LIMIT 100
        )
      `, [snapshot.serverId]);
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
  const serverResult = await pool.query(`
    SELECT id, lives_mode, shared_lives, display_mode, no_lives_command_executions, captured_at
    FROM servers WHERE id = $1
  `, [config.SERVER_ID]);
  const serverRow = serverResult.rows[0];
  if (!serverRow) return { server: null, players: [], recentDeaths: [] };

  // Ambos modos muestran hasta `MAX_PLAYERS` jugadores; `solo` y `coop` solo cambian la
  // presentación (títulos, insignia de equipo y contador de vidas compartidas).
  const limit = config.MAX_PLAYERS ?? 30;
  // Online primero; dentro de cada grupo manda el orden alfabético del nombre. El punto
  // inicial de las cuentas de Bedrock (Floodgate) se ignora al comparar, de modo que
  // ".AlexCuadro7412" ordena junto a "AlexCuadro7412" y no antes que la "A".
  const playersResult = await pool.query(`
    SELECT uuid, name, individual_lives, deaths,
      play_time_seconds, online, world, dimension, x, y, z,
      experience_level, total_experience, walked_centimeters, blocks_mined, mob_kills,
      health, max_health, food_level, helmet, chestplate, leggings, boots, offhand,
      last_seen_at, updated_at
    FROM player_snapshots
    WHERE server_id = $1
    ORDER BY online DESC, LOWER(LTRIM(name, '.')) ASC, updated_at DESC
    LIMIT $2
  `, [config.SERVER_ID, limit]);

  const deathsResult = await pool.query(`
    SELECT id, victim, message, killer, created_at
    FROM death_events
    WHERE server_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 30
  `, [config.SERVER_ID]);

  const server = { id: serverRow.id, livesMode: serverRow.lives_mode, sharedLives: serverRow.shared_lives,
    displayMode: serverRow.display_mode,
    noLivesCommandExecutions: Number(serverRow.no_lives_command_executions), capturedAt: serverRow.captured_at };
  return {
    server,
    players: playersResult.rows.map(row => ({
      uuid: row.uuid, name: row.name, lives: server.livesMode === 'shared' ? server.sharedLives : row.individual_lives,
      deaths: Number(row.deaths ?? 0),
      online: row.online, playTimeSeconds: Number(row.play_time_seconds ?? 0),
      level: row.experience_level == null ? null : Number(row.experience_level),
      totalExperience: row.total_experience == null ? null : Number(row.total_experience),
      walkedCentimeters: row.walked_centimeters == null ? null : Number(row.walked_centimeters),
      blocksMined: row.blocks_mined == null ? null : Number(row.blocks_mined),
      mobKills: row.mob_kills == null ? null : Number(row.mob_kills),
      health: row.health == null ? null : Number(row.health),
      maxHealth: row.max_health == null ? null : Number(row.max_health),
      foodLevel: row.food_level == null ? null : Number(row.food_level),
      equipment: {
        helmet: row.helmet ?? null,
        chestplate: row.chestplate ?? null,
        leggings: row.leggings ?? null,
        boots: row.boots ?? null,
        offhand: row.offhand ?? null
      },
      location: row.x === null ? null : { world: row.world, dimension: row.dimension,
        x: row.x, y: row.y, z: row.z },
      lastSeenAt: row.last_seen_at, updatedAt: row.updated_at
    })),
    recentDeaths: deathsResult.rows.map(row => ({
      id: row.id,
      victim: row.victim,
      message: row.message,
      killer: row.killer,
      createdAt: row.created_at
    }))
  };
}
