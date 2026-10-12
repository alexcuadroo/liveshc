import { STATS, DEFAULTS, parseOverlayOptions, buildOverlayQuery } from './overlay-options.js';

const LABELS = { lives: 'Vidas restantes', deaths: 'Contador de muertes', attempts: 'Número de intento' };
const form = document.getElementById('form');
const statsList = document.getElementById('stats');
const playersBox = document.getElementById('players');
const urlInput = document.getElementById('url');
const frame = document.getElementById('frame');
const copyButton = document.getElementById('copy');

let headTemplate = 'https://mc-heads.net/avatar/{uuid}/32';

// Estado inicial: si el editor se abre con parámetros, se restauran.
const initial = parseOverlayOptions(window.location.search);
let order = [...initial.stats, ...STATS.filter(key => !initial.stats.includes(key))];
const enabled = new Set(initial.stats);
const selectedPlayers = new Set(initial.players.map(item => item.toLowerCase()));
let playerOrder = [...initial.players];

for (const key of ['head', 'layout', 'size', 'offline', 'bg']) {
  if (form.elements[key]) form.elements[key].value = initial[key];
}
form.elements.names.checked = initial.names;
form.elements.refresh.value = initial.refresh;

function renderStats() {
  statsList.innerHTML = order.map((key, index) => `
    <li class="stat-item">
      <label class="check">
        <input type="checkbox" data-stat="${key}" ${enabled.has(key) ? 'checked' : ''} />
        <span>${LABELS[key] || key}</span>
      </label>
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
  if (event.target.checked) {
    selectedPlayers.add(key);
    playerOrder.push(name);
  } else {
    selectedPlayers.delete(key);
    playerOrder = playerOrder.filter(item => item.toLowerCase() !== key);
  }
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
  
  const sizeHintEl = document.getElementById('size-hint');
  if (sizeHintEl) {
    sizeHintEl.textContent = options.layout === 'column' ? '360 × 600'
      : options.layout === 'grid' ? '800 × 400' : '1000 × 140';
  }

  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (frame.src !== url) frame.src = url;
  }, 200);
}

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(urlInput.value);
  } catch {
    urlInput.select();
    document.execCommand('copy');
  }
  copyButton.classList.add('is-copied');
  const originalHtml = copyButton.innerHTML;
  copyButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    <span>¡Copiada!</span>`;
  setTimeout(() => {
    copyButton.classList.remove('is-copied');
    copyButton.innerHTML = originalHtml;
  }, 1800);
});

const previewBgSelect = document.getElementById('preview-bg');
if (previewBgSelect) {
  previewBgSelect.addEventListener('change', event => {
    document.getElementById('preview').className = `preview ${event.target.value}`;
  });
}

function avatarUrl(uuid) {
  return headTemplate.replace('{uuid}', encodeURIComponent(uuid));
}

async function loadConfig() {
  try {
    const res = await fetch('/api/v1/config');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg?.headUrlTemplateFlat?.includes('{uuid}')) {
        headTemplate = cfg.headUrlTemplateFlat;
      }
    }
  } catch {
    // Fallback template defaults
  }
}

async function loadPlayers() {
  try {
    await loadConfig();
    const response = await fetch('/api/v1/versus', { headers: { Accept: 'application/json' } });
    const data = response.ok ? await response.json() : { players: [] };
    const players = data.players ?? [];
    if (players.length === 0) {
      playersBox.innerHTML = '<span class="hint">Aún no hay jugadores registrados en la partida.</span>';
      return;
    }
    playersBox.innerHTML = players.map(player => {
      const name = player.name ?? player.uuid;
      const uuid = player.uuid;
      const isChecked = selectedPlayers.has(name.toLowerCase()) || selectedPlayers.has(uuid.toLowerCase());
      const safeName = name.replace(/"/g, '&quot;');
      const icon = avatarUrl(uuid);
      return `
        <label class="chip">
          <input type="checkbox" data-player="${safeName}" ${isChecked ? 'checked' : ''} />
          <img class="chip-avatar" src="${icon}" alt="" loading="lazy" onerror="this.style.display='none'" />
          <span>${name.replace(/</g, '&lt;')}</span>
        </label>`;
    }).join('');
  } catch {
    playersBox.innerHTML = '<span class="hint">No se pudieron cargar los jugadores.</span>';
  }
}

renderStats();
update();
loadPlayers();
