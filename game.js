/* ============================================================
   Snake — a Google Snake-style game with modes and a leaderboard
   Grid: 17 x 15 cells, 32px each. Origin top-left, +x right, +y down.
   ============================================================ */

'use strict';

/* ---------- Constants ---------- */
const COLS = 17;
const ROWS = 15;
const CELL = 32;
const W = COLS * CELL;
const H = ROWS * CELL;

const START_LEN = 3;

/* ---------- Game modes ---------- */
const MODES = {
  classic: {
    name: 'Classic',
    desc: 'The original. Solid walls, one apple at a time.',
    wrap: false, maze: false, apples: 1,
    startMs: 165, minMs: 75, speedup: 3.5,
  },
  wrap: {
    name: 'Wrap',
    desc: 'No walls — slide off one edge and pop out the other.',
    wrap: true, maze: false, apples: 1,
    startMs: 165, minMs: 75, speedup: 3.5,
  },
  maze: {
    name: 'Maze',
    desc: 'Stone blocks block your path. Plan ahead.',
    wrap: false, maze: true, apples: 1,
    startMs: 160, minMs: 80, speedup: 3.5,
  },
  blitz: {
    name: 'Blitz',
    desc: 'Starts fast and only gets faster. How long can you last?',
    wrap: false, maze: false, apples: 1,
    startMs: 105, minMs: 55, speedup: 5,
  },
  feast: {
    name: 'Feast',
    desc: 'Four apples on the board at once. Grow fast, think faster.',
    wrap: false, maze: false, apples: 4,
    startMs: 160, minMs: 80, speedup: 3,
  },
};

/* Maze layout: stone blocks (kept clear of the snake's start row) */
const MAZE_WALLS = (() => {
  const w = new Set();
  for (let y = 1; y <= 4; y++) w.add(y + ':' + 8);
  for (let y = 10; y <= 13; y++) w.add(y + ':' + 8);
  for (let y = 4; y <= 10; y++) { w.add(y + ':2'); w.add(y + ':14'); }
  return w;
})();

const C = {
  light: '#aad751',
  dark: '#a2d149',
  snake: '#4a78f0',
  snakeAlt: '#456fd6',
  snakeDead: '#8b9bb8',
  apple: '#e7471d',
  appleShine: '#ff8a63',
  leaf: '#3f7a24',
  stem: '#7a4a21',
  stone: '#8a9a7b',
  stoneEdge: '#6e7d61',
};

/* ---------- DOM ---------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const panelTitle = document.getElementById('panel-title');
const panelLeaderboard = document.getElementById('panel-leaderboard');
const panelPaused = document.getElementById('panel-paused');
const panelOver = document.getElementById('panel-over');
const overStats = document.getElementById('over-stats');
const pausedModeLabel = document.getElementById('paused-mode-label');
const modeDesc = document.getElementById('mode-desc');
const modeGroup = document.getElementById('mode-group');
const lbListTitle = document.getElementById('lb-list-title');
const lbListOver = document.getElementById('lb-list-over');
const lbMini = document.getElementById('lb-mini');
const nameRow = document.getElementById('name-row');
const nameInput = document.getElementById('name-input');
const btnStart = document.getElementById('btn-start');
const btnResume = document.getElementById('btn-resume');
const btnRetry = document.getElementById('btn-retry');
const btnMute = document.getElementById('btn-mute');
const btnLeaderboard = document.getElementById('btn-leaderboard');
const btnBack = document.getElementById('btn-back');
const btnSaveScore = document.getElementById('btn-save-score');
const btnSkipScore = document.getElementById('btn-skip-score');

/* ---------- Leaderboard storage ----------
   Uses localStorage when available (e.g. on GitHub Pages).
   In sandboxed previews storage is blocked, so it falls back to
   in-memory for the session. */
const LB_KEY = 'snake-leaderboard-v1';
const LB_SIZE = 5;
const lbStore = (() => {
  try {
    const t = '__snake_probe__';
    window.localStorage.setItem(t, t);
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch { return null; }
})();
let lbMemory = null;

function lbLoad() {
  if (lbStore) {
    try {
      const raw = lbStore.getItem(LB_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) return v.filter((e) => e && typeof e.score === 'number');
      }
    } catch { /* fall through */ }
  }
  return lbMemory ? lbMemory.slice() : [];
}
function lbPersist(list) {
  lbMemory = list.slice();
  if (lbStore) {
    try { lbStore.setItem(LB_KEY, JSON.stringify(list)); } catch { /* session only */ }
  }
}
function lbQualifies(score) {
  if (score <= 0) return false;
  const list = lbLoad();
  return list.length < LB_SIZE || score > list[list.length - 1].score;
}
function lbAdd(name, score, modeId) {
  const list = lbLoad();
  const entry = {
    name: (name || 'You').slice(0, 12),
    score,
    mode: modeId,
    date: new Date().toISOString(),
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, LB_SIZE);
  lbPersist(trimmed);
  return { list: trimmed, entry };
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function lbDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return MONTHS[d.getMonth()] + ' ' + d.getDate();
}
function lbRender(ol, highlightDate) {
  ol.innerHTML = '';
  const list = lbLoad();
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'lb-empty';
    li.textContent = 'No runs yet — go eat some apples.';
    ol.appendChild(li);
    return;
  }
  list.forEach((e, i) => {
    const li = document.createElement('li');
    li.className = 'lb-row' + (e.date === highlightDate ? ' is-new' : '');
    const mode = MODES[e.mode] ? MODES[e.mode].name : e.mode || '?';
    li.innerHTML =
      '<span class="lb-rank">' + (i + 1) + '</span>' +
      '<span class="lb-name"></span>' +
      '<span class="lb-score">' + e.score + '</span>' +
      '<span class="lb-mode">' + mode + ' &middot; ' + lbDate(e.date) + '</span>';
    li.querySelector('.lb-name').textContent = e.name;
    ol.appendChild(li);
  });
}

/* ---------- State ---------- */
const S = {
  mode: 'title',      // title | playing | paused | gameover
  modeId: 'classic',  // selected game mode
  cfg: MODES.classic,
  snake: [],
  dir: { x: 1, y: 0 },
  pendingDirs: [],
  foods: [],
  walls: new Set(),
  score: 0,
  best: 0,
  moveTimer: 0,
  moveInterval: 165,
  deadFlash: 0,
  dying: false,
  particles: [],
  shake: 0,
  muted: false,
  pendingSave: false,
};

/* ---------- Audio (Web Audio, procedural) ---------- */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function blip(freq, dur, type, vol, slideTo) {
  const ac = ensureAudio();
  if (!ac || S.muted) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur + 0.02);
  } catch { /* ignore */ }
}
const sfx = {
  eat() { blip(520, 0.09, 'square', 0.10, 880); },
  start() { blip(440, 0.08, 'triangle', 0.12, 660); },
  over() { blip(300, 0.45, 'sawtooth', 0.10, 70); },
  turn() { blip(240, 0.03, 'square', 0.03); },
  save() { blip(660, 0.12, 'triangle', 0.10, 990); },
};

/* ---------- Helpers ---------- */
const key = (x, y) => y + ':' + x;
function cellFree(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  if (S.walls.has(key(x, y))) return false;
  return !S.snake.some((s) => s.x === x && s.y === y);
}
function spawnFood() {
  const want = S.cfg.apples;
  while (S.foods.length < want) {
    const free = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (cellFree(x, y) && !S.foods.some((f) => f.x === x && f.y === y)) free.push({ x, y });
    if (free.length === 0) return false;
    S.foods.push(free[(Math.random() * free.length) | 0]);
  }
  return true;
}
function reset() {
  S.cfg = MODES[S.modeId] || MODES.classic;
  S.walls = S.cfg.maze ? MAZE_WALLS : new Set();
  const cy = (ROWS / 2) | 0;
  S.snake = [];
  for (let i = 0; i < START_LEN; i++) S.snake.push({ x: 6 - i, y: cy });
  S.dir = { x: 1, y: 0 };
  S.pendingDirs = [];
  S.score = 0;
  S.moveInterval = S.cfg.startMs;
  S.moveTimer = 0;
  S.dying = false;
  S.deadFlash = 0;
  S.particles.length = 0;
  S.shake = 0;
  S.foods = [];
  spawnFood();
  updateHud();
}
function updateHud() {
  scoreEl.textContent = String(S.score);
  bestEl.textContent = String(S.best);
}
function showPanel(which) {
  panelTitle.classList.add('hidden');
  panelLeaderboard.classList.add('hidden');
  panelPaused.classList.add('hidden');
  panelOver.classList.add('hidden');
  if (which) {
    which.classList.remove('hidden');
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}
function startGame() {
  reset();
  S.mode = 'playing';
  showPanel(null);
  sfx.start();
}
function gameOver() {
  S.dying = true;
  S.deadFlash = 0;
  if (S.score > S.best) S.best = S.score;
  updateHud();
  sfx.over();
}
function finishGameOver() {
  S.dying = false;
  S.mode = 'gameover';
  const modeName = S.cfg.name;
  overStats.textContent = modeName + ' — you ate ' + S.score +
    (S.score === 1 ? ' apple.' : ' apples.') +
    (S.score >= S.best && S.score > 0 ? ' New best!' : '');

  if (lbQualifies(S.score)) {
    S.pendingSave = true;
    nameRow.classList.remove('hidden');
    lbMini.classList.add('hidden');
    nameInput.value = '';
    setTimeout(() => nameInput.focus(), 50);
  } else {
    S.pendingSave = false;
    nameRow.classList.add('hidden');
    lbMini.classList.remove('hidden');
    lbRender(lbListOver, null);
  }
  showPanel(panelOver);
}
function saveScore() {
  if (!S.pendingSave) return;
  S.pendingSave = false;
  const name = nameInput.value.trim() || 'You';
  const { entry } = lbAdd(name, S.score, S.modeId);
  nameRow.classList.add('hidden');
  lbMini.classList.remove('hidden');
  lbRender(lbListOver, entry.date);
  sfx.save();
}
function skipScore() {
  S.pendingSave = false;
  nameRow.classList.add('hidden');
  lbMini.classList.remove('hidden');
  lbRender(lbListOver, null);
}

/* ---------- Input ---------- */
function queueDir(x, y) {
  const last = S.pendingDirs.length ? S.pendingDirs[S.pendingDirs.length - 1] : S.dir;
  if ((x === -last.x && y === -last.y) || (x === last.x && y === last.y)) return;
  if (S.pendingDirs.length < 3) S.pendingDirs.push({ x, y });
}
function applyDir() {
  if (S.pendingDirs.length) {
    const d = S.pendingDirs.shift();
    if (!(d.x === -S.dir.x && d.y === -S.dir.y)) S.dir = d;
  }
}

const KEY_DIRS = {
  ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
};

document.addEventListener('keydown', (e) => {
  // Don't hijack keys while typing a leaderboard name
  if (e.target && e.target.tagName === 'INPUT') return;

  if (e.code === 'KeyM') { toggleMute(); return; }
  const d = KEY_DIRS[e.code];
  if (d) {
    e.preventDefault();
    if (S.mode === 'title') { startGame(); }
    if (S.mode === 'playing') { queueDir(d.x, d.y); if (S.pendingDirs.length === 1) sfx.turn(); }
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (S.mode === 'title') startGame();
    else if (S.mode === 'playing') pause();
    else if (S.mode === 'paused') resume();
    else if (S.mode === 'gameover') startGame();
  }
});

btnStart.addEventListener('click', () => { ensureAudio(); startGame(); });
btnResume.addEventListener('click', resume);
btnRetry.addEventListener('click', startGame);
btnLeaderboard.addEventListener('click', () => { lbRender(lbListTitle, null); showPanel(panelLeaderboard); });
btnBack.addEventListener('click', () => showPanel(panelTitle));
btnSaveScore.addEventListener('click', saveScore);
btnSkipScore.addEventListener('click', skipScore);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); saveScore(); }
  e.stopPropagation();
});

/* Mode selection */
modeGroup.addEventListener('click', (e) => {
  const chip = e.target.closest('.mode-chip');
  if (!chip) return;
  selectMode(chip.dataset.mode);
});
function selectMode(id) {
  if (!MODES[id]) return;
  S.modeId = id;
  modeDesc.textContent = MODES[id].desc;
  for (const chip of modeGroup.children) {
    const on = chip.dataset.mode === id;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-checked', on ? 'true' : 'false');
  }
}

function pause() {
  if (S.mode === 'playing') {
    S.mode = 'paused';
    pausedModeLabel.textContent = S.cfg.name + ' — ' + S.score + (S.score === 1 ? ' apple' : ' apples');
    showPanel(panelPaused);
  }
}
function resume() { if (S.mode === 'paused') { S.mode = 'playing'; showPanel(null); } }

/* Touch: swipe anywhere on the board */
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
  ensureAudio();
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (S.mode === 'title' || S.mode === 'gameover') startGame();
  else if (S.mode === 'paused') resume();
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (!touchStart || S.mode !== 'playing') return;
  const dx = e.touches[0].clientX - touchStart.x;
  const dy = e.touches[0].clientY - touchStart.y;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? 1 : -1, 0);
  else queueDir(0, dy > 0 ? 1 : -1);
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
canvas.addEventListener('touchend', () => { touchStart = null; }, { passive: true });

/* Mute toggle */
function toggleMute() {
  S.muted = !S.muted;
  if (btnMute) {
    btnMute.setAttribute('aria-label', S.muted ? 'Unmute sound' : 'Mute sound');
    btnMute.classList.toggle('is-muted', S.muted);
  }
}
if (btnMute) btnMute.addEventListener('click', toggleMute);

/* ---------- Particles ---------- */
function burst(cx, cy, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 140;
    S.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
      life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
      size: 3 + Math.random() * 4, color,
    });
  }
}

/* ---------- Update ---------- */
function step() {
  applyDir();
  const head = S.snake[0];
  let nx = head.x + S.dir.x;
  let ny = head.y + S.dir.y;

  if (S.cfg.wrap) {
    nx = (nx + COLS) % COLS;
    ny = (ny + ROWS) % ROWS;
  } else if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
    gameOver();
    return;
  }
  // Stone walls
  if (S.walls.has(key(nx, ny))) { gameOver(); return; }

  // Self (tail moves away unless we just ate)
  const foodIdx = S.foods.findIndex((f) => f.x === nx && f.y === ny);
  const willEat = foodIdx >= 0;
  for (let i = 0; i < S.snake.length - (willEat ? 0 : 1); i++) {
    if (S.snake[i].x === nx && S.snake[i].y === ny) { gameOver(); return; }
  }

  S.snake.unshift({ x: nx, y: ny });
  if (willEat) {
    const f = S.foods.splice(foodIdx, 1)[0];
    S.score++;
    S.moveInterval = Math.max(S.cfg.minMs, S.moveInterval - S.cfg.speedup);
    burst((f.x + 0.5) * CELL, (f.y + 0.5) * CELL, C.apple, 14);
    burst((f.x + 0.5) * CELL, (f.y + 0.5) * CELL, C.light, 6);
    S.shake = 5;
    sfx.eat();
    if (!spawnFood()) { // board full — you win
      if (S.score > S.best) S.best = S.score;
      updateHud();
      overStats.textContent = 'Perfect run — ' + S.score + ' apples. The board is full!';
      S.mode = 'gameover';
      if (lbQualifies(S.score)) {
        S.pendingSave = true;
        nameRow.classList.remove('hidden');
        lbMini.classList.add('hidden');
      }
      showPanel(panelOver);
      return;
    }
  } else {
    S.snake.pop();
  }
  updateHud();
}

function update(dt) {
  if (S.dying) {
    S.deadFlash += dt;
    if (S.deadFlash > 0.9) finishGameOver();
    return;
  }
  if (S.mode !== 'playing') return;

  S.moveTimer += dt * 1000;
  while (S.moveTimer >= S.moveInterval && S.mode === 'playing' && !S.dying) {
    S.moveTimer -= S.moveInterval;
    step();
  }

  // particles
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 300 * dt;
    p.life -= dt;
    if (p.life <= 0) S.particles.splice(i, 1);
  }
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30);
}

/* ---------- Render ---------- */
function drawBoard() {
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? C.light : C.dark;
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  // maze stones
  if (S.walls.size) {
    for (const k of S.walls) {
      const [y, x] = k.split(':').map(Number);
      ctx.fillStyle = C.stoneEdge;
      roundRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4, 7);
      ctx.fill();
      ctx.fillStyle = C.stone;
      roundRect(x * CELL + 4, y * CELL + 4, CELL - 8, CELL - 8, 5);
      ctx.fill();
    }
  }
}

function drawFood(t) {
  for (const f of S.foods) {
    const cx = (f.x + 0.5) * CELL;
    const cy = (f.y + 0.5) * CELL;
    const pulse = 1 + Math.sin(t * 4) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = C.stem;
    ctx.fillRect(-1.5, -15, 3, 6);
    ctx.fillStyle = C.leaf;
    ctx.beginPath();
    ctx.ellipse(6, -12, 5, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.apple;
    ctx.beginPath();
    ctx.arc(0, 1, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.appleShine;
    ctx.beginPath();
    ctx.arc(-4, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSnake() {
  const flash = S.dying && Math.floor(S.deadFlash * 10) % 2 === 0;
  const body = flash ? C.snakeDead : C.snake;

  for (let i = S.snake.length - 1; i >= 1; i--) {
    const s = S.snake[i];
    const inset = i === S.snake.length - 1 ? 3 : 2;
    ctx.fillStyle = i % 2 === 0 ? body : (flash ? C.snakeDead : C.snakeAlt);
    roundRect(s.x * CELL + inset, s.y * CELL + inset, CELL - inset * 2, CELL - inset * 2, 8);
    ctx.fill();
  }

  const h = S.snake[0];
  if (h) {
    ctx.fillStyle = flash ? C.snakeDead : C.snake;
    roundRect(h.x * CELL + 1, h.y * CELL + 1, CELL - 2, CELL - 2, 9);
    ctx.fill();

    const dx = S.dir.x, dy = S.dir.y;
    const ex = 8 * dx, ey = 8 * dy;
    const e1 = { x: h.x * CELL + CELL / 2 - 6 + ex + (dy !== 0 ? -5 : 0) + (dx < 0 ? -2 : 0), y: h.y * CELL + CELL / 2 - 6 + ey + (dx !== 0 ? -5 : 0) + (dy < 0 ? -2 : 0) };
    const e2 = { x: h.x * CELL + CELL / 2 - 6 + ex + (dy !== 0 ? 5 : 0) + (dx < 0 ? -2 : 0), y: h.y * CELL + CELL / 2 - 6 + ey + (dx !== 0 ? 5 : 0) + (dy < 0 ? -2 : 0) };
    for (const e of [e1, e2]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(e.x + 4, e.y + 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2437';
      ctx.beginPath();
      ctx.arc(e.x + 4 + dx * 1.8, e.y + 4 + dy * 1.8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // tongue when near food
    let near = false;
    for (const f of S.foods) {
      if (Math.abs(h.x - f.x) + Math.abs(h.y - f.y) <= 2) { near = true; break; }
    }
    if (near) {
      ctx.strokeStyle = '#e7471d';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const hx = h.x * CELL + CELL / 2, hy = h.y * CELL + CELL / 2;
      ctx.moveTo(hx + dx * 12, hy + dy * 12);
      ctx.lineTo(hx + dx * 20, hy + dy * 20);
      ctx.stroke();
    }
  }
}

function drawParticles() {
  for (const p of S.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/* Debug FPS overlay (required for automated QA) */
let _frames = 0, _last = performance.now(), _fps = 0, _ft = 0, _prev = 0;
function updateDebug() {
  _frames++;
  const n = performance.now();
  _ft = n - (_prev || n);
  _prev = n;
  if (n - _last >= 1000) {
    _fps = (_frames * 1000) / (n - _last);
    _frames = 0;
    _last = n;
  }
}
function drawDebug() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(0, 0, 118, 20);
  ctx.font = '11px monospace';
  ctx.fillStyle = _fps < 30 ? '#f66' : '#cfe8a0';
  ctx.fillText('FPS:' + _fps.toFixed(0) + ' ' + _ft.toFixed(1) + 'ms', 6, 14);
  ctx.restore();
}

function render(t) {
  ctx.save();
  if (S.shake > 0.2) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
  drawBoard();
  drawFood(t);
  drawSnake();
  drawParticles();
  ctx.restore();
  drawDebug();
}

/* ---------- Main loop (fixed timestep) ---------- */
const TICK = 1 / 60;
let lastTime = performance.now();
let accumulator = 0;
let rafId = 0;

function gameLoop(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += delta;
  while (accumulator >= TICK) {
    update(TICK);
    accumulator -= TICK;
  }
  updateDebug();
  render(now / 1000);
  rafId = requestAnimationFrame(gameLoop);
}

/* ---------- Test hooks ---------- */
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) update(1 / 60);
  render(performance.now() / 1000);
};
window.render_game_to_text = () => JSON.stringify({
  note: 'grid origin top-left, +x right, +y down; snake[0] is head',
  mode: S.mode,
  modeId: S.modeId,
  score: S.score,
  best: S.best,
  dir: S.dir,
  snake: S.snake,
  foods: S.foods,
  wallCount: S.walls.size,
  moveIntervalMs: S.moveInterval,
  leaderboard: lbLoad(),
  pendingSave: S.pendingSave,
});
window.__snake = S; // test access
window.__lb = { load: lbLoad, add: lbAdd, render: lbRender };

/* ---------- Boot ---------- */
reset();
S.mode = 'title';
selectMode('classic');
showPanel(panelTitle);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render(performance.now() / 1000));
rafId = requestAnimationFrame(gameLoop);
