CREATE TABLE IF NOT EXISTS servers (
    id text PRIMARY KEY,
    lives_mode text NOT NULL CHECK (lives_mode IN ('individual', 'shared')),
    shared_lives integer CHECK (shared_lives IS NULL OR shared_lives >= 0),
    captured_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_snapshots (
    server_id text NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    uuid uuid NOT NULL,
    name text,
    individual_lives integer NOT NULL CHECK (individual_lives >= 0),
    play_time_seconds bigint CHECK (play_time_seconds IS NULL OR play_time_seconds >= 0),
    online boolean NOT NULL DEFAULT false,
    world text,
    dimension text,
    x double precision,
    y double precision,
    z double precision,
    last_seen_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (server_id, uuid)
);

CREATE INDEX IF NOT EXISTS player_snapshots_uuid_idx ON player_snapshots (uuid);
CREATE INDEX IF NOT EXISTS player_snapshots_server_online_idx ON player_snapshots (server_id, online);
