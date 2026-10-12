import { z } from 'zod';

export function loadConfig(env = process.env) {
  return z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1),
    INGEST_TOKEN: z.string().min(24),
    SERVER_ID: z.string().min(1).max(80).default('principal'),
    SERVER_ADDRESS: z.string().trim().max(120).default('alexndh.holy.gg'),
    SKIN_URL_TEMPLATE: z.string().url().default('https://mc-heads.net/body/{uuid}/180'),
    HEAD_URL_TEMPLATE: z.string().url().default('https://mc-heads.net/avatar/{uuid}/128'),
    HEAD_3D_URL_TEMPLATE: z.string().url().default('https://mc-heads.net/head/{uuid}/128'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(1),
    MAX_PLAYERS: z.coerce.number().int().min(1).max(500).default(30),
    HIDDEN_PLAYERS: z.string().optional().default('')
      .transform(val => val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
  }).parse({
    ...env,
    HIDDEN_PLAYERS: env.HIDDEN_PLAYERS || env.OCULTAR_UUID || env.OCULTAR_JUGADORES || ''
  });
}
