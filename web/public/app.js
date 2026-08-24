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

function formatLocation(location) {
  if (!location) return { dimension: 'Sin registrar', coordinates: '—' };
  const dimension = location.world?.split(':').at(-1)?.replaceAll('_', ' ') || location.dimension;
  return { dimension, coordinates: `${Math.round(location.x)} / ${Math.round(location.y)} / ${Math.round(location.z)}` };
}

function renderPlayer(player, index) {
  const location = formatLocation(player.location);
  const name = player.name || `Jugador ${index + 1}`;
  const lives = player.lives;
  const hearts = lives === null ? 'Sin datos' : lives === 0 ? 'Sin vidas' : '♥'.repeat(Math.min(lives, 20)) + (lives > 20 ? ` +${lives - 20}` : '');
  const skinUrl = state.skinTemplate.replace('{uuid}', encodeURIComponent(player.uuid));
  const article = document.querySelector(`#player-${index}`);
  article.classList.remove('skeleton');
  article.dataset.number = String(index + 1).padStart(2, '0');
  article.setAttribute('aria-busy', 'false');
  article.innerHTML = `
    <div class="fighter-inner">
      <div class="skin-wrap"><img class="skin" src="${escapeHtml(skinUrl)}" alt="Skin de ${escapeHtml(name)}" width="180" height="360"></div>
      <div class="stats">
        <div class="status ${player.online ? 'is-online' : ''}">${player.online ? 'En línea' : 'Desconectado'}</div>
        <h3 class="player-name">${escapeHtml(name)}</h3>
        <div class="individual-lives">
          <div class="lives-label">Vidas restantes</div>
          <div class="hearts ${!lives ? 'empty' : ''}" aria-label="${lives ?? 'Vidas desconocidas'}">${hearts}</div>
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
  article.querySelector('img').addEventListener('error', event => { event.currentTarget.src = fallbackSkin; }, { once: true });
}

function renderLivesMode(server) {
  const shared = server?.livesMode === 'shared';
  const panel = document.querySelector('#shared-lives');
  const arena = document.querySelector('.arena');
  const versus = document.querySelector('.versus');
  panel.hidden = !shared;
  versus.hidden = shared;
  arena.classList.toggle('shared-mode', shared);
  if (!shared) return;

  const lives = server.sharedLives;
  document.querySelector('#shared-count').value = lives ?? '—';
  document.querySelector('#shared-count').textContent = lives ?? '—';
  document.querySelector('#shared-hearts').textContent = lives === null
    ? 'Sin datos'
    : lives === 0 ? 'Sin vidas restantes' : '♥'.repeat(Math.min(lives, 20)) + (lives > 20 ? ` +${lives - 20}` : '');
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
    renderAttemptRecord(data.server);
    renderLivesMode(data.server);
    data.players.forEach(renderPlayer);
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

document.querySelectorAll('.fighter').forEach((element, index) => {
  element.classList.add('skeleton');
  element.innerHTML = `<div class="fighter-inner"><div class="skin-wrap"></div><div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div></div>`;
  element.dataset.number = String(index + 1).padStart(2, '0');
});

fetch('/api/v1/config').then(response => response.ok ? response.json() : null).then(config => {
  if (config?.skinUrlTemplate?.includes('{uuid}')) state.skinTemplate = config.skinUrlTemplate;
}).finally(refresh);
document.addEventListener('visibilitychange', () => { schedule(); if (!document.hidden) refresh(); });
schedule();
