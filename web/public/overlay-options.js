// Opciones del overlay para OBS. Módulo puro compartido por overlay.js,
// overlay-builder.js y los tests de Node.

export const STATS = ['lives', 'deaths', 'attempts'];
export const LAYOUTS = ['row', 'column', 'grid'];
export const SIZES = ['s', 'm', 'l'];
export const OFFLINE_MODES = ['dim', 'show', 'hide'];
export const HEAD_STYLES = ['flat', '3d'];
export const BACKGROUNDS = ['none', 'dark'];

export const DEFAULTS = Object.freeze({
  stats: ['lives', 'deaths', 'attempts'],
  players: [],
  layout: 'row',
  size: 'm',
  offline: 'show',
  head: 'flat',
  names: true,
  bg: 'none',
  refresh: 5
});

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

function parseList(value) {
  if (value == null) return null;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

export function parseOverlayOptions(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search ?? '');
  const statsList = parseList(params.get('stats'));
  let stats = DEFAULTS.stats;
  if (statsList !== null) {
    stats = [...new Set(statsList.map(item => item.toLowerCase()).filter(item => STATS.includes(item)))];
    if (stats.length === 0 && statsList.length > 0) stats = DEFAULTS.stats;
  }
  const refresh = Number.parseInt(params.get('refresh') ?? '', 10);
  return {
    stats,
    players: (parseList(params.get('players')) ?? []).slice(0, 50),
    layout: pick(params.get('layout'), LAYOUTS, DEFAULTS.layout),
    size: pick(params.get('size'), SIZES, DEFAULTS.size),
    offline: pick(params.get('offline'), OFFLINE_MODES, DEFAULTS.offline),
    head: pick(params.get('head'), HEAD_STYLES, DEFAULTS.head),
    names: params.get('names') !== '0',
    bg: pick(params.get('bg'), BACKGROUNDS, DEFAULTS.bg),
    refresh: Number.isFinite(refresh) ? Math.min(60, Math.max(3, refresh)) : DEFAULTS.refresh
  };
}

// Serializa solo lo que difiere de los valores por defecto, para URLs cortas.
export function buildOverlayQuery(options) {
  const params = new URLSearchParams();
  const stats = options.stats ?? DEFAULTS.stats;
  if (stats.join(',') !== DEFAULTS.stats.join(',')) params.set('stats', stats.join(','));
  if (options.players?.length) params.set('players', options.players.join(','));
  for (const key of ['layout', 'size', 'offline', 'head', 'bg']) {
    if (options[key] && options[key] !== DEFAULTS[key]) params.set(key, options[key]);
  }
  if (options.names === false) params.set('names', '0');
  if (options.refresh && options.refresh !== DEFAULTS.refresh) params.set('refresh', String(options.refresh));
  return params.toString();
}

export function headUrl(template, uuid) {
  return template.replace('{uuid}', encodeURIComponent(uuid));
}

// Filtra/ordena jugadores según las opciones. El orden de `players` manda si se especifica.
export function selectPlayers(players, options) {
  let list = players.slice();
  if (options.players.length) {
    const wanted = options.players.map(item => item.toLowerCase());
    list = list
      .filter(player => wanted.includes(player.uuid.toLowerCase()) || wanted.includes((player.name ?? '').toLowerCase()))
      .sort((a, b) => indexOf(wanted, a) - indexOf(wanted, b));
  }
  if (options.offline === 'hide') list = list.filter(player => player.online);
  return list;
}

function indexOf(wanted, player) {
  const byUuid = wanted.indexOf(player.uuid.toLowerCase());
  return byUuid >= 0 ? byUuid : wanted.indexOf((player.name ?? '').toLowerCase());
}
