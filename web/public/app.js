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
          <div><dt>Última señal</dt><dd>${player.updatedAt ? new Date(player.updatedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
        </dl>
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

function setConnection(kind, text) {
  const element = document.querySelector('#sync-state');
  element.className = `sync-state ${kind}`;
  element.lastChild.textContent = ` ${text}`;
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
    setConnection('online', 'Datos actualizados');
    document.querySelector('#last-update').textContent = `Actualizado ${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
    document.querySelector('#announcer').textContent = 'Estadísticas actualizadas';
  } catch {
    setConnection('error', state.hasData ? 'Mostrando últimos datos' : 'Sin conexión');
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
