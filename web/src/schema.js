import { z } from 'zod';

// Acepta cualquier UUID canónico, incluidos los de Floodgate/Bedrock
// (00000000-0000-0000-0009-...), que `z.uuid()` rechaza por su versión/variante.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nullableFinite = z.number().finite().nullable();
const player = z.object({
  uuid: z.string().regex(UUID_PATTERN),
  name: z.string().min(1).max(32).nullable(),
  individualLives: z.number().int().min(0),
  deaths: z.number().int().min(0).default(0),
  playTimeSeconds: z.number().int().min(0).nullable(),
  online: z.boolean(),
  world: z.string().min(1).max(160).nullable(),
  dimension: z.string().min(1).max(80).nullable(),
  x: nullableFinite,
  y: nullableFinite,
  z: nullableFinite,
  lastSeenAt: z.iso.datetime({ offset: true }).nullable(),
  level: z.number().int().min(0).nullable(),
  totalExperience: z.number().int().min(0).nullable(),
  walkedCentimeters: z.number().int().min(0).nullable(),
  blocksMined: z.number().int().min(0).nullable(),
  mobKills: z.number().int().min(0).nullable()
}).strict().refine(value => {
  const coordinates = [value.x, value.y, value.z];
  return coordinates.every(item => item === null) || coordinates.every(item => item !== null);
}, { message: 'x, y and z must all be present or all be null' });

export const snapshotSchema = z.object({
  serverId: z.string().min(1).max(80),
  capturedAt: z.iso.datetime({ offset: true }),
  resetOnline: z.boolean(),
  displayMode: z.enum(['solo', 'coop']),
  noLivesCommandExecutions: z.number().int().min(0),
  livesMode: z.enum(['individual', 'shared']),
  sharedLives: z.number().int().min(0).nullable(),
  players: z.array(player).max(5000)
}).strict().refine(value => value.livesMode !== 'shared' || value.sharedLives !== null, {
  message: 'sharedLives is required in shared mode', path: ['sharedLives']
});
