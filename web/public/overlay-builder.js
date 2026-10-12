import { STATS, DEFAULTS, parseOverlayOptions, buildOverlayQuery } from './overlay-options.js';

const LABELS = { lives: 'Vidas', deaths: 'Muertes', attempts: 'Intento' };
const form = document.getElementById('form');
const statsList = document.getElementById('stats');
const playersBox = document.getElementById('players');
const urlInput = document.getElementById('url');
const frame = document.getElementById('frame');
const copyButton = document.getElementById('copy');

// Estado inicial: si el editor se abre con parámetros, se restauran.
const initial = parseOverlayOptions(window.location.search);
let order = [...initial.stats, ...STATS.filter(key => !initial.stats.includes(key))];
const enabled = new Set(initial.stats);
const selectedPlayers = new Set(initial.players.map(item => item.toLowerCase()));
let playerOrder = [...initial.players];

for (const key of ['head', 'layout', 'size', 'offline', 'bg']) form.elements[key].value = initial[key];
form.elements.names.checked = initial.names;
form.elements.refresh.value = initial.refresh;

function renderStats() {
  statsList.innerHTML = order.map((key, index) => `
    <li>
      <label class="check"><input type="checkbox" data-stat="${key}" ${enabled.has(key) ? 'checked' : ''} /> ${LABELS[key]}</label>
      <span class="move">
        <button type="button" data-move="${index}" data-dir="-1" ${index === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
        <button type="button" data-move="${index}" data-dir="1" ${index === order.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
      </span>
    </li>`).join('');
}

statsList.addEventListener('change', event => {
  const key = event.target.dataset.stat;
  if (!key) return;
  if (event.target.checked) enabled.add(key); else enabled.delete(key);
  update();
});
statsList.addEventListener('click', event => {
  const button = event.target.closest('button[data-move]');
  if (!button) return;
  const index = Number(button.dataset.move);
  const target = index + Number(button.dataset.dir);
  [order[index], order[target]] = [order[target], order[index]];
  renderStats();
  update();
});

playersBox.addEventListener('change', event => {
  const name = event.target.dataset.player;
  if (!name) return;
  const key = name.toLowerCase();
  if (event.target.checked) { selectedPlayers.add(key); playerOrder.push(name); }
  else { selectedPlayers.delete(key); playerOrder = playerOrder.filter(item => item.toLowerCase() !== key); }
  update();
});

form.addEventListener('input', update);
form.addEventListener('change', update);

function currentOptions() {
  const stats = order.filter(key => enabled.has(key));
  return {
    // Ningún dato marcado = solo cabezas (se fuerza con un valor vacío explícito).
    stats,
    players: playerOrder,
    layout: form.elements.layout.value,
    size: form.elements.size.value,
    offline: form.elements.offline.value,
    head: form.elements.head.value,
    bg: form.elements.bg.value,
    names: form.elements.names.checked,
    refresh: Math.min(60, Math.max(3, Number(form.elements.refresh.value) || DEFAULTS.refresh))
  };
}

let previewTimer;
function update() {
  const options = currentOptions();
  let query = buildOverlayQuery(options);
  if (options.stats.length === 0) query = `stats=none${query ? `&${query}` : ''}`;
  const url = `${window.location.origin}/overlay${query ? `?${query}` : ''}`;
  urlInput.value = url;
  history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  document.getElementById('size-hint').textContent = options.layout === 'column' ? '360 × 600'
    : options.layout === 'grid' ? '800 × 400' : '1000 × 140';
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => { if (frame.src !== url) frame.src = url; }, 250);
}

copyButton.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(urlInput.value); }
  catch { urlInput.select(); document.execCommand('copy'); }
  copyButton.textContent = '¡Copiada!';
  setTimeout(() => { copyButton.textContent = 'Copiar'; }, 1500);
});

document.getElementById('preview-bg').addEventListener('change', event => {
  document.getElementById('preview').className = `preview ${event.target.value}`;
});

async function loadPlayers() {
  try {
    const response = await fetch('/api/v1/versus', { headers: { Accept: 'application/json' } });
    const data = response.ok ? await response.json() : { players: [] };
    const names = (data.players ?? []).map(player => player.name ?? player.uuid);
    if (names.length === 0) { playersBox.innerHTML = '<span class="muted">Aún no hay jugadores.</span>'; return; }
    playersBox.innerHTML = names.map(name => `
      <label class="chip"><input type="checkbox" data-player="${name.replace(/"/g, '&quot;')}"
        ${selectedPlayers.has(name.toLowerCase()) ? 'checked' : ''} /> <span>${name.replace(/</g, '&lt;')}</span></label>`).join('');
  } catch {
    playersBox.innerHTML = '<span class="muted">No se pudieron cargar los jugadores.</span>';
  }
}

renderStats();
update();
loadPlayers();
