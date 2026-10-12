import { parseOverlayOptions, selectPlayers, headUrl } from './overlay-options.js';

const options = parseOverlayOptions(window.location.search);
const root = document.getElementById('overlay');
root.className = `overlay layout-${options.layout} size-${options.size} bg-${options.bg} head-${options.head}`;

let templates = {
  flat: 'https://mc-heads.net/avatar/{uuid}/128',
  '3d': 'https://mc-heads.net/head/{uuid}/128'
};
const previous = new Map();

const HEART = '<img class="icon" src="/icons/heart.png" alt="" aria-hidden="true" />';
const SKULL = '<svg class="icon" viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges"><path fill="#e8e8e8" d="M1 0h6v1h1v4H7v1H6v2H2V6H1V5H0V1h1z"/><path fill="#1a1a1a" d="M2 2h1v2H2zM5 2h1v2H5zM3 5h2v1H3zM3 7h1v1H3zM4 7h1v1H4z"/></svg>';
const FLAG = '<svg class="icon" viewBox="0 0 8 8" aria-hidden="true" shape-rendering="crispEdges"><path fill="#cfcfcf" d="M1 0h1v8H1z"/><path fill="#ff5a4e" d="M2 1h5v1H6v1h1v1H2z"/></svg>';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function stat(kind, icon, value, label, bump) {
  return `<span class="stat stat-${kind}${bump ? ' bump' : ''}" title="${label}">${icon}<b>${value}</b></span>`;
}

function render(data) {
  const server = data.server;
  if (!server) { root.innerHTML = ''; return; }
  const shared = server.livesMode === 'shared';
  const attempt = server.noLivesCommandExecutions + 1;
  const players = selectPlayers(data.players ?? [], options);

  const globals = [];
  const perPlayer = [];
  for (const key of options.stats) {
    if (key === 'attempts') globals.push(key);
    else if (key === 'lives' && shared) globals.push(key);
    else perPlayer.push(key);
  }

  const prevGlobal = previous.get('__server') ?? {};
  const globalHtml = globals.map(key => key === 'attempts'
    ? stat('attempts', FLAG, `#${attempt}`, 'Intento', prevGlobal.attempt != null && prevGlobal.attempt !== attempt)
    : stat('lives', HEART, server.sharedLives, 'Vidas compartidas', prevGlobal.lives != null && prevGlobal.lives !== server.sharedLives)
  ).join('');
  previous.set('__server', { attempt, lives: server.sharedLives });

  const cards = players.map(player => {
    const before = previous.get(player.uuid) ?? {};
    previous.set(player.uuid, { lives: player.lives, deaths: player.deaths });
    const stats = perPlayer.map(key => key === 'lives'
      ? stat('lives', HEART, player.lives, 'Vidas', before.lives != null && before.lives !== player.lives)
      : stat('deaths', SKULL, player.deaths, 'Muertes', before.deaths != null && before.deaths !== player.deaths)
    ).join('');
    const classes = ['card'];
    if (!player.online && options.offline === 'dim') classes.push('offline');
    if (player.lives === 0) classes.push('dead');
    const name = player.name ?? player.uuid.slice(0, 8);
    return `<article class="${classes.join(' ')}">
      <img class="head" src="${escapeHtml(headUrl(templates[options.head], player.uuid))}" alt="${escapeHtml(name)}" />
      <div class="info">
        ${options.names ? `<span class="name">${escapeHtml(name)}</span>` : ''}
        ${stats ? `<div class="stats">${stats}</div>` : ''}
      </div>
    </article>`;
  }).join('');

  root.innerHTML = (globalHtml ? `<div class="globals">${globalHtml}</div>` : '') + cards;
}

async function tick() {
  try {
    const response = await fetch('/api/v1/versus', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (response.ok) render(await response.json());
  } catch {
    // Mantiene los últimos datos visibles si la red falla durante el directo.
  } finally {
    setTimeout(tick, options.refresh * 1000);
  }
}

fetch('/api/v1/config')
  .then(response => (response.ok ? response.json() : null))
  .then(config => {
    if (config?.headUrlTemplate) templates.flat = config.headUrlTemplate;
    if (config?.head3dUrlTemplate) templates['3d'] = config.head3dUrlTemplate;
  })
  .catch(() => {})
  .finally(tick);
