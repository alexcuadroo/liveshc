ALTER TABLE player_snapshots
ADD COLUMN IF NOT EXISTS experience_level integer CHECK (experience_level IS NULL OR experience_level >= 0),
ADD COLUMN IF NOT EXISTS total_experience bigint CHECK (total_experience IS NULL OR total_experience >= 0),
ADD COLUMN IF NOT EXISTS walked_centimeters bigint CHECK (walked_centimeters IS NULL OR walked_centimeters >= 0),
ADD COLUMN IF NOT EXISTS blocks_mined bigint CHECK (blocks_mined IS NULL OR blocks_mined >= 0),
ADD COLUMN IF NOT EXISTS mob_kills bigint CHECK (mob_kills IS NULL OR mob_kills >= 0);
