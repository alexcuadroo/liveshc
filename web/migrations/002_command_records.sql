ALTER TABLE servers
ADD COLUMN IF NOT EXISTS no_lives_command_executions bigint NOT NULL DEFAULT 0
CHECK (no_lives_command_executions >= 0);
