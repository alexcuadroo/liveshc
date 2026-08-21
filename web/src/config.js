import { z } from 'zod';

const uuid = z.string().uuid();

export function loadConfig(env = process.env) {
  return z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1),
    INGEST_TOKEN: z.string().min(24),
    FEATURED_PLAYER_1_UUID: uuid,
    FEATURED_PLAYER_2_UUID: uuid,
    SERVER_ID: z.string().min(1).max(80).default('principal'),
    SKIN_URL_TEMPLATE: z.string().url().default('https://mc-heads.net/body/{uuid}/180'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1)
  }).parse(env);
}
