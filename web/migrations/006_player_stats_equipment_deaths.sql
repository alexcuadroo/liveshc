-- Agrega vida actual, vida máxima, nivel de comida y equipamiento activo (casco, peto, grebas, botas, offhand).
ALTER TABLE player_snapshots
ADD COLUMN IF NOT EXISTS health double precision CHECK (health IS NULL OR health >= 0),
ADD COLUMN IF NOT EXISTS max_health double precision CHECK (max_health IS NULL OR max_health >= 0),
ADD COLUMN IF NOT EXISTS food_level integer CHECK (food_level IS NULL OR food_level >= 0),
ADD COLUMN IF NOT EXISTS helmet text,
ADD COLUMN IF NOT EXISTS chestplate text,
ADD COLUMN IF NOT EXISTS leggings text,
ADD COLUMN IF NOT EXISTS boots text,
ADD COLUMN IF NOT EXISTS offhand text;

-- Tabla para almacenar el historial de muertes recientes del servidor.
CREATE TABLE IF NOT EXISTS death_events (
    id bigserial PRIMARY KEY,
    server_id text NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    victim text NOT NULL,
    message text NOT NULL,
    killer text,
    created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS death_events_server_id_idx ON death_events (server_id, created_at DESC);
