import { z } from 'zod';

const nullableFinite = z.number().finite().nullable();
const player = z.object({
  uuid: z.string().uuid(),
  name: z.string().min(1).max(32).nullable(),
  individualLives: z.number().int().min(0),
  playTimeSeconds: z.number().int().min(0).nullable(),
  online: z.boolean(),
  world: z.string().min(1).max(160).nullable(),
  dimension: z.string().min(1).max(80).nullable(),
  x: nullableFinite,
  y: nullableFinite,
  z: nullableFinite
}).strict().refine(value => {
  const coordinates = [value.x, value.y, value.z];
  return coordinates.every(item => item === null) || coordinates.every(item => item !== null);
}, { message: 'x, y and z must all be present or all be null' });

export const snapshotSchema = z.object({
  serverId: z.string().min(1).max(80),
  capturedAt: z.iso.datetime({ offset: true }),
  resetOnline: z.boolean(),
  livesMode: z.enum(['individual', 'shared']),
  sharedLives: z.number().int().min(0).nullable(),
  players: z.array(player).max(5000)
}).strict().refine(value => value.livesMode !== 'shared' || value.sharedLives !== null, {
  message: 'sharedLives is required in shared mode', path: ['sharedLives']
});
