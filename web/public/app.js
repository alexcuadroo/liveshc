const POLL_INTERVAL = 30_000;
const state = { timer: null, skinTemplate: 'https://mc-heads.net/body/{uuid}/180', hasData: false };
const fallbackSkin = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 360"><path fill="#241b18" d="M0 0h180v360H0z"/><path fill="#66564f" d="M52 25h76v76H52z"/><path fill="#4b3d38" d="M40 108h100v126H40z"/><path fill="#66564f" d="M18 112h24v146H18zm120 0h24v146h-24zM45 234h38v116H45zm52 0h38v116H97z"/></svg>')}`;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function formatDuration(seconds) {
  if (seconds === null) return 'Sin registrar';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function formatNumber(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('es', { maximumFractionDigits }).format(value);
}

function formatDistance(centimeters) {
  if (centimeters === null || centimeters === undefined) return '—';
  const meters = centimeters / 100;
  return meters >= 1000
    ? `${formatNumber(meters / 1000, 1)} km`
    : `${formatNumber(meters, 1)} m`;
}

function formatExperience(level, totalExperience) {
  if (level === null || level === undefined || totalExperience === null || totalExperience === undefined) return '—';
  return `Nv. ${formatNumber(level)} · ${formatNumber(totalExperience)} XP`;
}

function formatLastSignal(player) {
  if (player.online) return 'En línea ahora';
  if (!player.lastSeenAt) return '—';
  const seenAt = new Date(player.lastSeenAt);
  if (Number.isNaN(seenAt.getTime())) return '—';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seenDay = new Date(seenAt.getFullYear(), seenAt.getMonth(), seenAt.getDate());
  const daysAgo = Math.round((today - seenDay) / 86_400_000);
  const time = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(seenAt);
  if (daysAgo === 0) return `hoy, ${time}`;
  if (daysAgo === 1) return `ayer, ${time}`;

  const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  if (seenAt.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return new Intl.DateTimeFormat('es', options).format(seenAt);
}

const DIMENSION_LABELS = {
  overworld: 'Mundo Exterior',
  world_nether: 'Infierno',
  nether: 'Infierno',
  the_nether: 'Infierno',
  world_the_end: '¿El Fin?',
  the_end: '¿El Fin?',
  end: '¿El Fin?'
};

function formatLocation(location) {
  if (!location) return { dimension: 'Sin registrar', coordinates: '—' };
  const raw = (location.world?.split(':').at(-1) || location.dimension || '').trim();
  const dimension = DIMENSION_LABELS[raw.toLowerCase()] ?? (raw ? raw.replaceAll('_', ' ') : 'Sin registrar');
  return { dimension, coordinates: `${Math.round(location.x)} / ${Math.round(location.y)} / ${Math.round(location.z)}` };
}

function hearts(value) {
  if (value === null || value === undefined) return { text: 'Sin datos', empty: true, label: 'Vidas desconocidas' };
  if (value === 0) return { text: 'Sin vidas', empty: true, label: 'Sin vidas' };
  const text = '♥'.repeat(Math.min(value, 20)) + (value > 20 ? ` +${value - 20}` : '');
  return { text, empty: false, label: `${value} vidas restantes` };
}

function deathsLabel(value) {
  if (value === null || value === undefined) return 'Muertes desconocidas';
  return `${value} ${value === 1 ? 'muerte' : 'muertes'}`;
}

function livesBlock({ text, empty, label }) {
  return `
        <div class="lives-block">
          <div class="lives-label">Vidas restantes</div>
          <div class="hearts ${empty ? 'empty' : ''}" aria-label="${escapeHtml(label)}">${text}</div>
        </div>`;
}

function deathsBlock(value) {
  return `
        <div class="deaths-block">
          <div class="lives-label">Muertes</div>
          <div class="deaths-count" aria-label="${escapeHtml(deathsLabel(value))}">${formatNumber(value)}</div>
        </div>`;
}

function playerMarkup(player, index) {
  const location = formatLocation(player.location);
  const name = player.name || `Jugador ${index + 1}`;
  const lives = hearts(player.lives);
  const skinUrl = state.skinTemplate.replace('{uuid}', encodeURIComponent(player.uuid));
  return `
    <div class="fighter-inner">
      <div class="skin-wrap"><img class="skin" src="${escapeHtml(skinUrl)}" alt="Skin de ${escapeHtml(name)}" width="180" height="360"></div>
      <div class="stats">
        <div class="status ${player.online ? 'is-online' : ''}">${player.online ? 'En línea' : 'Desconectado'}</div>
        <h3 class="player-name">${escapeHtml(name)}</h3>
        <div class="individual-lives">
          ${livesBlock({ text: lives.text, empty: lives.empty, label: lives.label })}
          ${deathsBlock(player.deaths)}
        </div>
        <dl class="meta">
          <div><dt>Tiempo jugado</dt><dd>${formatDuration(player.playTimeSeconds)}</dd></div>
          <div><dt>Dimensión</dt><dd>${escapeHtml(location.dimension)}</dd></div>
          <div class="coordinates"><dt>Coordenadas XYZ</dt><dd>${location.coordinates}</dd></div>
          <div><dt>Última señal</dt><dd>${formatLastSignal(player)}</dd></div>
        </dl>
        <section class="survival" aria-label="Resumen de supervivencia">
          <div><span>Nivel · XP</span><strong>${formatExperience(player.level, player.totalExperience)}</strong></div>
          <div><span>Caminado</span><strong>${formatDistance(player.walkedCentimeters)}</strong></div>
          <div><span>Bloques rotos</span><strong>${formatNumber(player.blocksMined)}</strong></div>
          <div><span>Mobs abatidos</span><strong>${formatNumber(player.mobKills)}</strong></div>
        </section>
      </div>
    </div>`;
}

function placeholderMarkup() {
  return `
    <div class="fighter-inner">
      <div class="skin-wrap"><img class="skin" src="${fallbackSkin}" alt="Sin jugador todavía" width="180" height="360"></div>
      <div class="stats">
        <div class="status">Esperando</div>
        <h3 class="player-name">Sin jugador todavía</h3>
        <div class="individual-lives">
          ${livesBlock({ text: 'El plugin aún no envió datos', empty: true, label: 'El plugin aún no envió datos' })}
          ${deathsBlock(null)}
        </div>
      </div>
    </div>`;
}

function skeletonMarkup() {
  return '<div class="fighter-inner"><div class="skin-wrap"></div><div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div>';
}

function createFighter(player, index, { skeleton = false } = {}) {
  const article = document.createElement('article');
  article.className = `fighter ${index === 0 ? 'fighter-one' : index === 1 ? 'fighter-two' : ''}`.trim();
  article.id = `player-${index}`;
  article.dataset.number = String(index + 1).padStart(2, '0');
  article.setAttribute('aria-busy', 'false');
  article.classList.toggle('skeleton', skeleton);
  article.innerHTML = skeleton ? skeletonMarkup() : player ? playerMarkup(player, index) : placeholderMarkup();
  const image = article.querySelector('img');
  if (image && !skeleton) {
    image.addEventListener('error', event => { event.currentTarget.src = fallbackSkin; }, { once: true });
  }
  return article;
}

function createVersus() {
  const versus = document.createElement('div');
  versus.className = 'versus is-coop';
  versus.id = 'versus-badge';
  versus.setAttribute('aria-hidden', 'true');
  versus.innerHTML = '<span>+</span>';
  return versus;
}

function renderArena(roster, mode, shared) {
  const arena = document.querySelector('#arena');
  const solo = mode === 'solo';
  const many = solo && roster.length > 1;
  const showVersus = !solo && !shared && roster.length >= 2;

  arena.classList.toggle('solo-mode', solo && !many);
  arena.classList.toggle('grid-mode', many);
  arena.classList.toggle('shared-mode', !solo && shared);
  arena.replaceChildren();
  roster.forEach((player, index) => {
    arena.append(createFighter(player, index));
    if (showVersus && index === 0) arena.append(createVersus());
  });
}

function renderLivesMode(server) {
  const shared = server?.livesMode === 'shared';
  const panel = document.querySelector('#shared-lives');
  panel.hidden = !shared;
  if (!shared) return;

  const lives = server.sharedLives;
  document.querySelector('#shared-count').value = lives ?? '—';
  document.querySelector('#shared-count').textContent = lives ?? '—';
  document.querySelector('#shared-hearts').textContent = lives === null
    ? 'Sin datos'
    : lives === 0 ? 'Sin vidas restantes' : '♥'.repeat(Math.min(lives, 20)) + (lives > 20 ? ` +${lives - 20}` : '');
}

const DISPLAY_COPY = {
  solo: {
    eyebrow: 'Supervivencia en solitario',
    title: 'Un jugador.<br /><em>Y... muchos intentos.</em>',
    documentTitle: 'Supervivencia en solitario | LivesHC',
    arenaTitle: 'Jugador destacado',
    skipLink: 'Saltar al jugador',
    attemptCaption: 'veces que el mundo puso a prueba al jugador'
  },
  soloMany: {
    eyebrow: 'Supervivencia individual',
    title: 'Cada jugador.<br /><em>Y... muchos intentos.</em>',
    documentTitle: 'Supervivencia individual | LivesHC',
    arenaTitle: 'Jugadores',
    skipLink: 'Saltar a los jugadores',
    attemptCaption: 'veces que el mundo puso a prueba a cada jugador'
  },
  coop: {
    eyebrow: 'Supervivencia cooperativa',
    title: 'Un equipo.<br /><em>Y... muchos intentos.</em>',
    documentTitle: 'Supervivencia cooperativa | LivesHC',
    arenaTitle: 'Equipo',
    skipLink: 'Saltar al equipo',
    attemptCaption: 'veces que el mundo puso a prueba al equipo'
  }
};

function copyFor(mode, count) {
  if (mode === 'solo' && count > 1) return DISPLAY_COPY.soloMany;
  return DISPLAY_COPY[mode] ?? DISPLAY_COPY.coop;
}

function renderDisplayMode(mode, count) {
  const copy = copyFor(mode, count);
  document.querySelector('#duelo').dataset.displayMode = mode;
  document.querySelector('#mode-eyebrow').textContent = copy.eyebrow;
  document.querySelector('#page-title').innerHTML = copy.title;
  document.title = copy.documentTitle;
  document.querySelector('.skip-link').textContent = copy.skipLink;
  document.querySelector('#attempt-caption').textContent = copy.attemptCaption;
  document.querySelector('#arena-title').textContent = copy.arenaTitle;
}

function renderMatchStatus(mode) {
  // En modo solo el contador global de intentos no aporta: cada ficha ya muestra
  // las vidas y muertes de su jugador. Se oculta el bloque (y el panel contenedor
  // si no queda nada más visible, como en coop sin vidas compartidas).
  const attempt = document.querySelector('.attempt-record');
  const shared = document.querySelector('#shared-lives');
  attempt.hidden = mode === 'solo';
  document.querySelector('.match-status').hidden = attempt.hidden && shared.hidden;
}

function renderAttemptRecord(server) {
  const value = server?.noLivesCommandExecutions;
  document.querySelector('#attempt-number').value = Number.isSafeInteger(value) ? value : '—';
  document.querySelector('#attempt-number').textContent = Number.isSafeInteger(value)
    ? new Intl.NumberFormat('es').format(value)
    : '—';
}

async function refresh() {
  try {
    const response = await fetch('/api/v1/versus', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const server = data.server;
    const mode = server?.displayMode ?? 'coop';
    const shared = server?.livesMode === 'shared';
    const players = Array.isArray(data.players) ? data.players : [];

    renderAttemptRecord(server);
    renderLivesMode(server);
    renderDisplayMode(mode, players.length);
    renderMatchStatus(mode);

    const roster = mode === 'solo'
      ? (players.length ? players : [null])
      : [players[0] ?? null, players[1] ?? null];
    renderArena(roster, mode, shared);

    state.hasData = true;
    document.querySelector('#last-update').textContent = `Actualizado ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
    document.querySelector('#announcer').textContent = 'Estadísticas actualizadas';
  } catch {
    if (!state.hasData) document.querySelector('#announcer').textContent = 'No fue posible cargar las estadísticas';
  }
}

function schedule() {
  clearInterval(state.timer);
  if (!document.hidden) state.timer = setInterval(refresh, POLL_INTERVAL);
}

document.querySelector('#arena').replaceChildren(
  createFighter(null, 0, { skeleton: true }),
  createVersus(),
  createFighter(null, 1, { skeleton: true })
);

fetch('/api/v1/config').then(response => response.ok ? response.json() : null).then(config => {
  if (config?.skinUrlTemplate?.includes('{uuid}')) state.skinTemplate = config.skinUrlTemplate;
}).finally(refresh);
document.addEventListener('visibilitychange', () => { schedule(); if (!document.hidden) refresh(); });
schedule();
