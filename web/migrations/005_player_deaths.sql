-- Muertes individuales por jugador, sincronizadas desde el plugin (LivesManager.getDeaths).
-- En instalaciones nuevas es un no-op porque 001_initial.sql ya incluye la columna.
ALTER TABLE player_snapshots
ADD COLUMN IF NOT EXISTS deaths integer NOT NULL DEFAULT 0 CHECK (deaths >= 0);
