-- El plugin reenvía las muertes recientes en cada snapshot; sin una clave única el
-- backend reinsertaba cada muerte en cada envío y la consola las repetía.
-- Se eliminan los duplicados existentes conservando la fila más reciente de cada grupo.
WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY server_id, victim, created_at ORDER BY id DESC) AS rn
    FROM death_events
)
DELETE FROM death_events USING ranked
WHERE death_events.id = ranked.id AND ranked.rn > 1;

-- Restricción real (no solo índice) para que `ON CONFLICT` infiera el objetivo y
-- quede documentada en el esquema.
ALTER TABLE death_events
ADD CONSTRAINT death_events_unique_event UNIQUE (server_id, victim, created_at);
