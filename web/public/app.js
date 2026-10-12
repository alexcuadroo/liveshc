const POLL_INTERVAL = 30_000;
const state = {
  timer: null,
  skinTemplate: 'https://mc-heads.net/body/{uuid}/180',
  hasData: false,
  radarPlayers: [],
  radarHovered: null,
  radarAngle: 0,
  radarAnimId: null
};
const fallbackSkin = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 360"><path fill="#241b18" d="M0 0h180v360H0z"/><path fill="#66564f" d="M52 25h76v76H52z"/><path fill="#4b3d38" d="M40 108h100v126H40z"/><path fill="#66564f" d="M18 112h24v146H18zm120 0h24v146h-24zM45 234h38v116H45zm52 0h38v116H97z"/></svg>')}`;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
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

function formatItemName(raw) {
  if (!raw) return 'Vacío';
  return raw
    .toLowerCase()
    .replace(/^minecraft:/, '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function vitalsMarkup(player) {
  const hp = player.health != null ? Math.round(player.health * 10) / 10 : null;
  const maxHp = player.maxHealth != null ? Math.round(player.maxHealth * 10) / 10 : 20.0;
  const food = player.foodLevel != null ? player.foodLevel : null;

  const hpPercent = hp != null ? Math.min(100, Math.max(0, (hp / maxHp) * 100)) : 0;
  const foodPercent = food != null ? Math.min(100, Math.max(0, (food / 20) * 100)) : 0;

  return `
    <div class="vitals-block" aria-label="Estado vital">
      <div class="vital-row">
        <div class="vital-header">
          <span>♥ Vida</span>
          <span class="vital-val">${hp != null ? `${hp} / ${maxHp}` : '—'}</span>
        </div>
        <div class="vital-bar-track">
          <div class="vital-bar-fill hp-fill" style="width: ${hpPercent}%"></div>
        </div>
      </div>
      <div class="vital-row">
        <div class="vital-header">
          <span>🍖 Comida</span>
          <span class="vital-val">${food != null ? `${food} / 20` : '—'}</span>
        </div>
        <div class="vital-bar-track">
          <div class="vital-bar-fill food-fill" style="width: ${foodPercent}%"></div>
        </div>
      </div>
    </div>`;
}

function equipmentMarkup(equipment = {}) {
  const slots = [
    { key: 'helmet', label: 'Casco', icon: '🪖' },
    { key: 'chestplate', label: 'Peto', icon: '🛡️' },
    { key: 'leggings', label: 'Grebas', icon: '👖' },
    { key: 'boots', label: 'Botas', icon: '🥾' },
    { key: 'offhand', label: 'Secundaria', icon: '✋' }
  ];

  const rendered = slots.map(slot => {
    const item = equipment[slot.key];
    const hasItem = Boolean(item);
    const title = `${slot.label}: ${formatItemName(item)}`;
    return `
      <div class="eq-slot ${hasItem ? 'has-item' : 'empty-item'}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
        <span class="eq-icon">${slot.icon}</span>
        <span class="eq-name">${escapeHtml(hasItem ? formatItemName(item) : '—')}</span>
      </div>`;
  }).join('');

  return `
    <div class="equipment-block">
      <div class="equipment-label">Equipamiento activo</div>
      <div class="equipment-slots">${rendered}</div>
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
        ${vitalsMarkup(player)}
        ${equipmentMarkup(player.equipment)}
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
  const many = roster.length > (solo ? 1 : 2);
  const showVersus = !solo && !shared && roster.length === 2;

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
    attemptCaption: 'intento actual'
  },
  soloMany: {
    eyebrow: 'Supervivencia individual',
    title: 'Cada jugador.<br /><em>Y... muchos intentos.</em>',
    documentTitle: 'Supervivencia individual | LivesHC',
    arenaTitle: 'Jugadores',
    skipLink: 'Saltar a los jugadores',
    attemptCaption: 'intento actual'
  },
  coop: {
    eyebrow: 'Supervivencia cooperativa',
    title: 'Un equipo.<br /><em>Y... muchos intentos.</em>',
    documentTitle: 'Supervivencia cooperativa | LivesHC',
    arenaTitle: 'Equipo',
    skipLink: 'Saltar al equipo',
    attemptCaption: 'intento actual del equipo'
  },
  coopMany: {
    eyebrow: 'Supervivencia cooperativa',
    title: 'Todo el equipo.<br /><em>Y... muchos intentos.</em>',
    documentTitle: 'Supervivencia cooperativa | LivesHC',
    arenaTitle: 'Equipo',
    skipLink: 'Saltar al equipo',
    attemptCaption: 'intento actual del equipo'
  }
};

function copyFor(mode, count) {
  if (mode === 'solo') return count > 1 ? DISPLAY_COPY.soloMany : DISPLAY_COPY.solo;
  return count > 2 ? DISPLAY_COPY.coopMany : DISPLAY_COPY.coop;
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
  const attempt = document.querySelector('.attempt-record');
  const shared = document.querySelector('#shared-lives');
  attempt.hidden = mode === 'solo';
  document.querySelector('.match-status').hidden = attempt.hidden && shared.hidden;
}

function renderAttemptRecord(server) {
  const executions = server?.noLivesCommandExecutions;
  const attempt = Number.isSafeInteger(executions) ? executions + 1 : null;
  document.querySelector('#attempt-number').value = attempt ?? '—';
  document.querySelector('#attempt-number').textContent = attempt === null
    ? '—'
    : new Intl.NumberFormat('es').format(attempt);
}

function renderRecentDeaths(recentDeaths = []) {
  const consoleEl = document.querySelector('#deaths-console');
  if (!consoleEl) return;
  if (!recentDeaths.length) {
    consoleEl.innerHTML = '<div class="console-empty">Sin muertes registradas</div>';
    return;
  }

  const entries = recentDeaths.map(death => {
    const time = death.createdAt
      ? new Date(death.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '—';
    return `
      <div class="console-entry">
        <div class="console-entry-header">
          <span class="console-victim">${escapeHtml(death.victim)}</span>
          <time class="console-time">${escapeHtml(time)}</time>
        </div>
        <div class="console-msg">${escapeHtml(death.message)}</div>
      </div>`;
  }).join('');

  consoleEl.innerHTML = entries;
}

const PLAYER_COLORS = [
  '#7bc96f', '#38bdf8', '#fbbf24', '#f43f5e',
  '#a855f7', '#fb923c', '#4ade80', '#e879f9'
];

function setupRadar() {
  const canvas = document.querySelector('#radar-canvas');
  const tooltip = document.querySelector('#radar-tooltip');
  if (!canvas || !tooltip) return;

  canvas.addEventListener('mousemove', event => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    let closest = null;
    let minDist = 18; // px threshold in canvas units
    state.radarPlayers.forEach(p => {
      const d = Math.hypot(p.canvasX - x, p.canvasY - y);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    });

    state.radarHovered = closest;
    if (closest) {
      const otherDistances = state.radarPlayers
        .filter(other => other !== closest && other.location)
        .map(other => {
          const dx = closest.location.x - other.location.x;
          const dz = closest.location.z - other.location.z;
          const distBlocks = Math.round(Math.hypot(dx, dz));
          return `→ ${other.name}: ${distBlocks}m`;
        });

      const distText = otherDistances.length ? `\n${otherDistances.join('\n')}` : '';
      tooltip.textContent = `${closest.name} (X: ${Math.round(closest.location.x)}, Z: ${Math.round(closest.location.z)})${distText}`;
      const containerRect = canvas.parentElement.getBoundingClientRect();
      const cssX = (rect.left - containerRect.left) + (closest.canvasX / scaleX);
      const cssY = (rect.top - containerRect.top) + (closest.canvasY / scaleY);
      tooltip.style.left = `${cssX}px`;
      tooltip.style.top = `${cssY}px`;
      tooltip.hidden = false;
    } else {
      tooltip.hidden = true;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.radarHovered = null;
    tooltip.hidden = true;
  });

  startRadarAnimation();
}

function startRadarAnimation() {
  if (state.radarAnimId) return;
  let lastTime = performance.now();

  function animate(now) {
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    // Rotate ~60 degrees per second (full rotation in ~6s)
    state.radarAngle = (state.radarAngle + delta * 1.05) % (Math.PI * 2);

    drawRadar();
    state.radarAnimId = requestAnimationFrame(animate);
  }

  state.radarAnimId = requestAnimationFrame(animate);
}

function stopRadarAnimation() {
  if (state.radarAnimId) {
    cancelAnimationFrame(state.radarAnimId);
    state.radarAnimId = null;
  }
}

function renderRadar(players) {
  const onlineWithCoords = players.filter(p => p.online && p.location && p.location.x != null && p.location.z != null);
  const legend = document.querySelector('#radar-legend');

  state.radarPlayers = onlineWithCoords.map((p, idx) => ({
    ...p,
    color: PLAYER_COLORS[idx % PLAYER_COLORS.length]
  }));

  if (legend) {
    if (!state.radarPlayers.length) {
      legend.innerHTML = '<span class="console-empty" style="padding:0">Sin jugadores en línea</span>';
    } else {
      legend.innerHTML = state.radarPlayers.map(p => `
        <div class="radar-legend-item">
          <span class="radar-legend-dot" style="background:${p.color}"></span>
          <span>${escapeHtml(p.name)}</span>
        </div>
      `).join('');
    }
  }

  drawRadar();
}

function drawRadar() {
  const canvas = document.querySelector('#radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 15;

  ctx.clearRect(0, 0, width, height);

  // Background circular grid
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#140e0c';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#483833';
  ctx.stroke();

  // Concentric radar rings
  [0.33, 0.66, 1].forEach(ratio => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * ratio, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(216, 58, 46, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
  });

  // Crosshairs
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY + radius);
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX + radius, centerY);
  ctx.strokeStyle = 'rgba(72, 56, 51, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Animated radar sweep cone / wedge
  const sweepAngle = state.radarAngle || 0;
  const wedgeSpan = Math.PI / 3; // 60-degree beam wedge like real sonar

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, sweepAngle - wedgeSpan, sweepAngle);
  ctx.closePath();

  // Create conic or multi-step radial sweep gradient
  try {
    const sweepGrad = ctx.createConicGradient(sweepAngle, centerX, centerY);
    sweepGrad.addColorStop(0, 'rgba(216, 58, 46, 0.32)'); // leading edge glow
    sweepGrad.addColorStop(1 - (wedgeSpan / (Math.PI * 2)), 'rgba(216, 58, 46, 0.0)'); // fade out behind
    sweepGrad.addColorStop(1, 'rgba(216, 58, 46, 0.32)');
    ctx.fillStyle = sweepGrad;
  } catch {
    ctx.fillStyle = 'rgba(216, 58, 46, 0.18)';
  }
  ctx.fill();

  // Leading sweep line
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + Math.cos(sweepAngle) * radius, centerY + Math.sin(sweepAngle) * radius);
  ctx.strokeStyle = 'rgba(255, 110, 95, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.restore();
  ctx.restore();

  const players = state.radarPlayers;
  if (!players.length) {
    ctx.fillStyle = '#a99e91';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Sin señal de jugadores', centerX, centerY + 4);
    return;
  }

  // Calculate center of group
  let avgX = 0;
  let avgZ = 0;
  players.forEach(p => {
    avgX += p.location.x;
    avgZ += p.location.z;
  });
  avgX /= players.length;
  avgZ /= players.length;

  let maxDelta = 100; // minimum scale in blocks
  players.forEach(p => {
    const dx = Math.abs(p.location.x - avgX);
    const dz = Math.abs(p.location.z - avgZ);
    maxDelta = Math.max(maxDelta, dx, dz);
  });
  const scale = (radius * 0.8) / maxDelta;

  // Project players to canvas coordinates
  players.forEach(p => {
    p.canvasX = centerX + (p.location.x - avgX) * scale;
    p.canvasY = centerY + (p.location.z - avgZ) * scale; // Minecraft Z is South (down)
  });

  // If hovered, draw distance connection lines to all other players
  if (state.radarHovered) {
    const h = state.radarHovered;
    players.forEach(other => {
      if (other !== h) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(h.canvasX, h.canvasY);
        ctx.lineTo(other.canvasX, other.canvasY);
        ctx.strokeStyle = 'rgba(216, 58, 46, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();

        // Distance label along mid-line
        const midX = (h.canvasX + other.canvasX) / 2;
        const midY = (h.canvasY + other.canvasY) / 2;
        const dist = Math.round(Math.hypot(h.location.x - other.location.x, h.location.z - other.location.z));

        ctx.fillStyle = '#f4eadb';
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${dist}m`, midX, midY - 3);
        ctx.restore();
      }
    });
  }

  // Draw player blips
  players.forEach(p => {
    const isHovered = state.radarHovered === p;
    ctx.save();

    // Pulse / glow ring
    ctx.beginPath();
    ctx.arc(p.canvasX, p.canvasY, isHovered ? 10 : 7, 0, Math.PI * 2);
    ctx.fillStyle = isHovered ? 'rgba(216, 58, 46, 0.35)' : 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    // Blip center
    ctx.beginPath();
    ctx.arc(p.canvasX, p.canvasY, isHovered ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = '#120d0c';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#f4eadb';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.canvasX, p.canvasY - 9);

    ctx.restore();
  });
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  return copied;
}

function renderServerAddress(address) {
  const value = (address ?? '').trim();
  if (!value) return;

  const block = document.querySelector('#server-address');
  const hint = document.querySelector('#server-address-hint');
  const valueLabel = document.querySelector('#server-address-value');
  valueLabel.textContent = value;
  block.setAttribute('aria-label', `Copiar dirección del servidor ${value}`);
  block.hidden = false;

  let timer = null;
  block.addEventListener('click', async () => {
    let message = 'Copiado';
    try {
      if (!await copyText(value)) message = 'Copia manual';
    } catch {
      message = 'Copia manual';
    }
    hint.textContent = message;
    block.classList.toggle('is-copied', message === 'Copiado');
    document.querySelector('#announcer').textContent = message === 'Copiado'
      ? 'Dirección del servidor copiada'
      : `No se pudo copiar. La dirección es ${value}`;
    clearTimeout(timer);
    timer = setTimeout(() => {
      hint.textContent = 'Copiar';
      block.classList.remove('is-copied');
    }, 2000);
  });
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
    const recentDeaths = Array.isArray(data.recentDeaths) ? data.recentDeaths : [];

    renderAttemptRecord(server);
    renderLivesMode(server);
    renderDisplayMode(mode, players.length);
    renderMatchStatus(mode);

    const roster = mode === 'solo'
      ? (players.length ? players : [null])
      : (players.length > 1 ? players : [players[0] ?? null, players[1] ?? null]);
    renderArena(roster, mode, shared);
    renderRecentDeaths(recentDeaths);
    renderRadar(players);

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

setupRadar();

fetch('/api/v1/config').then(response => response.ok ? response.json() : null).then(config => {
  if (config?.skinUrlTemplate?.includes('{uuid}')) state.skinTemplate = config.skinUrlTemplate;
  renderServerAddress(config?.serverAddress);
}).finally(refresh);
document.addEventListener('visibilitychange', () => {
  schedule();
  if (document.hidden) {
    stopRadarAnimation();
  } else {
    startRadarAnimation();
    refresh();
  }
});
schedule();
