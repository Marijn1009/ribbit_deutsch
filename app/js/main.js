import { Game, SIZE, MIN_LEN, cellKey, edgeKey, dailyIndex, formatTime, shareText, displayLemma, normalizeTyped } from './engine.js';
import { store, KEYS, localDateStr } from './store.js';

const LEVELS = ['A2', 'B1', 'B2'];
const CELL = 100, R = 36;
const $ = id => document.getElementById(id);
const el = {
  board: $('board'), current: $('current'), message: $('message'), timer: $('timer'),
  puzzleLabel: $('puzzleLabel'), frogs: $('frogs'), wordsFound: $('wordsFound'), wordsTotal: $('wordsTotal'),
  stars: $('stars'), starsTotal: $('starsTotal'), streak: $('streak'), found: $('found'),
  results: $('results'), resultsTitle: $('resultsTitle'), resultsStats: $('resultsStats'), resultsWords: $('resultsWords'),
  help: $('help'),
};

const state = {
  level: LEVELS.includes(store.get(KEYS.level)) ? store.get(KEYS.level) : 'B1',
  packs: {},
  index: 0,            // puzzle index within the pack
  game: null,
  puzzle: null,
  selection: [],       // array of [r, c]
  typed: '',
  elapsed: 0,          // ms accumulated before resumeAt
  resumeAt: null,      // timestamp while the clock runs
  pads: new Map(),     // cellKey -> <g>
  edgeEls: new Map(),  // edgeKey -> <line>
  trail: null,
};

// ---------- data ----------
async function loadPack(level) {
  if (!state.packs[level]) {
    const res = await fetch(`puzzles/${level.toLowerCase()}.json`);
    if (!res.ok) throw new Error(`Rätselpaket ${level} konnte nicht geladen werden`);
    state.packs[level] = await res.json();
  }
  return state.packs[level];
}

function todayIndex(pack) { return dailyIndex(new Date(), pack.puzzles.length); }

// ---------- timer ----------
function elapsedNow() { return state.elapsed + (state.resumeAt ? Date.now() - state.resumeAt : 0); }
function startClock() { if (!state.resumeAt && state.game && !state.game.isOver) state.resumeAt = Date.now(); }
function stopClock() { if (state.resumeAt) { state.elapsed += Date.now() - state.resumeAt; state.resumeAt = null; } }
setInterval(() => { if (state.game) el.timer.textContent = formatTime(elapsedNow()); }, 500);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopClock(); saveProgress(); } else startClock();
});

// ---------- persistence ----------
function saveProgress() {
  if (!state.game) return;
  store.set(KEYS.progress(state.puzzle.id), { ...state.game.toState(), elapsed: elapsedNow(), done: state.game.isOver });
}

function updateStreak() {
  const pack = state.packs[state.level];
  if (state.index !== todayIndex(pack)) return;
  const meta = store.get(KEYS.meta, { streak: 0, last: null, solved: {} });
  const today = localDateStr();
  const key = `${state.level}:${today}`;
  if (meta.solved[key]) return;
  meta.solved[key] = true;
  const y = new Date(); y.setDate(y.getDate() - 1);
  meta.streak = meta.last === localDateStr(y) ? meta.streak + 1 : (meta.last === today ? meta.streak : 1);
  meta.last = today;
  store.set(KEYS.meta, meta);
  el.streak.textContent = meta.streak;
}

// ---------- loading a puzzle ----------
async function showPuzzle(index) {
  const pack = await loadPack(state.level);
  const n = pack.puzzles.length;
  state.index = ((index % n) + n) % n;
  state.puzzle = pack.puzzles[state.index];
  stopClock();
  state.game = new Game(state.puzzle);
  const saved = store.get(KEYS.progress(state.puzzle.id));
  state.game.restore(saved);
  state.elapsed = saved?.elapsed || 0;
  state.resumeAt = null;
  state.selection = []; state.typed = '';
  const isToday = state.index === todayIndex(pack);
  el.puzzleLabel.textContent = `${isToday ? 'Heute · ' : ''}${state.level} #${state.index + 1}`;
  document.querySelectorAll('.levels button').forEach(b => b.classList.toggle('active', b.dataset.level === state.level));
  el.streak.textContent = store.get(KEYS.meta, { streak: 0 }).streak || 0;
  buildBoard();
  renderAll();
  setMessage('');
  startClock();
  location.hash = `${state.level}/${state.index + 1}`;
}

function buildBoard() {
  const svg = el.board;
  svg.innerHTML = '';
  state.pads.clear(); state.edgeEls.clear();
  const ns = 'http://www.w3.org/2000/svg';
  const center = ([r, c]) => [c * CELL + CELL / 2, r * CELL + CELL / 2];
  for (const [key, [a, b]] of state.game.edges) {
    const line = document.createElementNS(ns, 'line');
    const [x1, y1] = center(a), [x2, y2] = center(b);
    line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
    line.setAttribute('class', 'edge');
    svg.appendChild(line);
    state.edgeEls.set(key, line);
  }
  state.trail = document.createElementNS(ns, 'polyline');
  state.trail.setAttribute('class', 'trail');
  svg.appendChild(state.trail);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'pad');
      g.dataset.r = r; g.dataset.c = c;
      const [x, y] = center([r, c]);
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', R);
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', x); text.setAttribute('y', y);
      text.textContent = state.game.grid[r][c];
      g.append(circle, text);
      svg.appendChild(g);
      state.pads.set(cellKey(r, c), g);
    }
  }
}

// ---------- rendering ----------
function renderBoard(clearedNow = []) {
  const g = state.game;
  for (const [key, line] of state.edgeEls) line.classList.toggle('gone', g.gaveUp || !g.neededEdges.has(key));
  const selKeys = new Set(state.selection.map(([r, c]) => cellKey(r, c)));
  for (const [key, pad] of state.pads) {
    const [r, c] = key.split(',').map(Number);
    const frog = !g.isCellActive(r, c);
    if (frog && !pad.classList.contains('frog')) {
      pad.querySelector('text').textContent = '🐸';
      pad.classList.add('frog');
      if (clearedNow.includes(key)) { pad.classList.add('pop'); setTimeout(() => pad.classList.remove('pop'), 700); }
    }
    pad.classList.toggle('sel', selKeys.has(key));
    pad.classList.toggle('dim', g.gaveUp && !frog);
  }
  state.trail.setAttribute('points', state.selection.map(([r, c]) => `${c * CELL + CELL / 2},${r * CELL + CELL / 2}`).join(' '));
  el.board.classList.toggle('done', g.isComplete);
}

function renderCurrent(cls = '') {
  const word = state.typed || (state.game ? state.game.wordFromPath(state.selection) : '');
  el.current.textContent = word || ' ';
  el.current.className = `current-word ${cls}`;
}

function renderProgress() {
  const g = state.game;
  el.frogs.textContent = g.frogsRevealed();
  el.wordsFound.textContent = g.foundCount; el.wordsTotal.textContent = g.totalWords;
  el.stars.textContent = g.starsFound; el.starsTotal.textContent = g.starWords.length;
  $('giveUpBtn').disabled = g.isOver;
}

function wordItem(meta, { missed = false } = {}) {
  const li = document.createElement('li');
  if (missed) li.classList.add('missed');
  const star = meta.star ? ' ⭐' : '';
  li.innerHTML = `<span class="w">${meta.w}</span>${star}<span class="lemma">${displayLemma(meta)}</span>` +
    `<span class="en">${meta.en}</span>` +
    `<div class="detail">${meta.ex ? `„${meta.ex}“<br><i>${meta.exEn}</i><br>` : ''}${meta.pos}${meta.cefr ? ` · ${meta.cefr}` : ''}</div>`;
  li.addEventListener('click', () => li.classList.toggle('open'));
  return li;
}

function renderFound() {
  el.found.innerHTML = '';
  const g = state.game;
  const list = Array.from(g.found).reverse().map(w => g.words.get(w));
  for (const meta of list) el.found.appendChild(wordItem(meta));
  if (g.gaveUp) for (const meta of g.remainingWords()) el.found.appendChild(wordItem(meta, { missed: true }));
}

function renderAll(clearedNow) { renderBoard(clearedNow); renderCurrent(); renderProgress(); renderFound(); }

let msgTimer = null;
function setMessage(text, ms = 2500) {
  el.message.textContent = text;
  clearTimeout(msgTimer);
  if (text && ms) msgTimer = setTimeout(() => { el.message.textContent = ''; }, ms);
}

// ---------- results ----------
function showResults() {
  const g = state.game;
  const label = `${state.level} #${state.index + 1}`;
  el.resultsTitle.textContent = g.isComplete ? 'Alle Frösche befreit! 🐸' : 'Aufgegeben 🐸💤';
  el.resultsStats.textContent = `🐸 ${g.frogsRevealed()}/16 · Wörter ${g.foundCount}/${g.totalWords} · ⭐ ${g.starsFound}/${g.starWords.length} · ⏱ ${formatTime(elapsedNow())}`;
  el.resultsWords.innerHTML = '';
  for (const meta of state.puzzle.words) {
    const li = document.createElement('li');
    const missed = !g.found.has(meta.w);
    if (missed) li.classList.add('missed');
    li.innerHTML = `<span class="w">${missed ? '✗' : '✓'} ${meta.w}${meta.star ? ' ⭐' : ''}</span><span>${displayLemma(meta)} – ${meta.en}</span>`;
    el.resultsWords.appendChild(li);
  }
  $('shareBtn').onclick = async () => {
    const text = shareText(g, label, elapsedNow());
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setMessage('In die Zwischenablage kopiert'); }
    } catch { /* user cancelled */ }
  };
  el.results.showModal();
}

function finish(clearedNow) {
  stopClock();
  saveProgress();
  if (state.game.isComplete) updateStreak();
  renderAll(clearedNow);
  setTimeout(showResults, state.game.isComplete ? 900 : 200);
}

// ---------- input ----------
let clearTimer = null;
function clearSelection() { clearTimeout(clearTimer); clearTimer = null; state.selection = []; state.typed = ''; renderBoard(); renderCurrent(); }
/** A rejected word stays visible briefly; any new input cancels that so it never wipes a fresh selection. */
function clearSelectionSoon() { clearTimeout(clearTimer); clearTimer = setTimeout(clearSelection, 450); }
function cancelPendingClear() { if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; state.selection = []; state.typed = ''; renderCurrent(); } }

function submitCurrent() {
  const g = state.game;
  if (!g || g.isOver) return;
  const word = state.typed || g.wordFromPath(state.selection);
  if (!word) return;
  const res = g.submit(word);
  if (res.status === 'ok') {
    renderCurrent('ok');
    for (const [r, c] of state.selection) {
      const pad = state.pads.get(cellKey(r, c));
      pad.classList.add('flash'); setTimeout(() => pad.classList.remove('flash'), 600);
    }
    setMessage(`${res.star ? '⭐ ' : '✓ '}${displayLemma(res.meta)} – ${res.meta.en}`, 4000);
    state.selection = []; state.typed = '';
    saveProgress();
    if (g.isComplete) { finish(res.cleared); return; }
    renderAll(res.cleared);
    return;
  }
  renderCurrent('bad');
  const msgs = { short: `Mindestens ${MIN_LEN} Buchstaben`, dup: 'Schon gefunden', notfound: 'Nicht in diesem Rätsel' };
  setMessage(msgs[res.status] || '');
  clearSelectionSoon();
}

function padAtPoint(clientX, clientY) {
  const pt = new DOMPoint(clientX, clientY).matrixTransform(el.board.getScreenCTM().inverse());
  const c = Math.floor(pt.x / CELL), r = Math.floor(pt.y / CELL);
  if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
  const dx = pt.x - (c * CELL + CELL / 2), dy = pt.y - (r * CELL + CELL / 2);
  return dx * dx + dy * dy <= (R + 4) * (R + 4) ? [r, c] : null;
}

const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

function tap(cell) {
  const g = state.game;
  state.typed = '';
  const sel = state.selection;
  const last = sel[sel.length - 1];
  if (!g.isCellActive(cell[0], cell[1])) return;
  if (!last) sel.push(cell);
  else if (same(last, cell)) { submitCurrent(); return; }
  else {
    const idx = sel.findIndex(p => same(p, cell));
    if (idx >= 0) sel.length = idx + 1;
    else if (g.canStep(last, cell, sel)) sel.push(cell);
    else { state.selection = [cell]; }
  }
  renderBoard(); renderCurrent();
}

let drag = null;
el.board.addEventListener('pointerdown', e => {
  if (!state.game || state.game.isOver) return;
  const cell = padAtPoint(e.clientX, e.clientY);
  if (!cell) return;
  e.preventDefault();
  cancelPendingClear();
  el.board.setPointerCapture(e.pointerId);
  drag = { start: cell, moved: false, path: null };
});
el.board.addEventListener('pointermove', e => {
  if (!drag) return;
  const cell = padAtPoint(e.clientX, e.clientY);
  if (!cell) return;
  if (!drag.moved) {
    if (same(cell, drag.start)) return;
    // Dragging started: begin a fresh path from the start pad.
    if (!state.game.isCellActive(drag.start[0], drag.start[1])) return;
    drag.moved = true; state.typed = ''; state.selection = [drag.start];
  }
  const sel = state.selection, last = sel[sel.length - 1];
  if (same(cell, last)) return;
  if (sel.length >= 2 && same(cell, sel[sel.length - 2])) sel.pop();
  else if (state.game.canStep(last, cell, sel)) sel.push(cell);
  else return;
  renderBoard(); renderCurrent();
});
const endDrag = e => {
  if (!drag) return;
  const d = drag; drag = null;
  try { el.board.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  if (d.moved) { if (state.selection.length > 1) submitCurrent(); else clearSelection(); }
  else tap(d.start);
};
el.board.addEventListener('pointerup', endDrag);
el.board.addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', e => {
  if (!state.game || state.game.isOver || el.results.open || el.help.open) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter') { e.preventDefault(); submitCurrent(); return; }
  if (e.key === 'Escape') { clearSelection(); return; }
  if (e.key === 'Backspace' || /^[a-zA-ZäöüÄÖÜß]$/.test(e.key)) cancelPendingClear();
  if (e.key === 'Backspace') { state.typed = state.typed.slice(0, -1); }
  else if (/^[a-zA-ZäöüÄÖÜß]$/.test(e.key)) { state.typed += normalizeTyped(e.key); }
  else return;
  e.preventDefault();
  state.selection = state.game.pathForTyped(state.typed) || [];
  renderBoard(); renderCurrent(state.typed && !state.selection.length ? 'bad' : '');
});

// ---------- buttons ----------
document.querySelectorAll('.levels button').forEach(b => b.addEventListener('click', async () => {
  saveProgress();
  state.level = b.dataset.level; store.set(KEYS.level, state.level);
  const pack = await loadPack(state.level);
  showPuzzle(todayIndex(pack));
}));
$('prevBtn').addEventListener('click', () => { saveProgress(); showPuzzle(state.index - 1); });
$('nextBtn').addEventListener('click', () => { saveProgress(); showPuzzle(state.index + 1); });
$('todayBtn').addEventListener('click', async () => { saveProgress(); showPuzzle(todayIndex(await loadPack(state.level))); });
const randomPuzzle = async () => { saveProgress(); const pack = await loadPack(state.level); showPuzzle(Math.floor(Math.random() * pack.puzzles.length)); };
$('randomBtn').addEventListener('click', randomPuzzle);
$('giveUpBtn').addEventListener('click', () => {
  if (!state.game || state.game.isOver) return;
  if (!confirm('Wirklich aufgeben? Die restlichen Wörter werden aufgedeckt.')) return;
  state.game.giveUp();
  clearSelection();
  finish([]);
});
$('nextPuzzleBtn').addEventListener('click', () => { el.results.close(); randomPuzzle(); });
$('closeResultsBtn').addEventListener('click', () => el.results.close());
$('helpBtn').addEventListener('click', () => el.help.showModal());
$('closeHelpBtn').addEventListener('click', () => el.help.close());
window.addEventListener('beforeunload', saveProgress);

// ---------- boot ----------
(async () => {
  try {
    const m = location.hash.match(/^#(A2|B1|B2)\/(\d+)$/);
    if (m) { state.level = m[1]; store.set(KEYS.level, state.level); }
    const pack = await loadPack(state.level);
    await showPuzzle(m ? Number(m[2]) - 1 : todayIndex(pack));
    if (!store.get('quak:seenHelp')) { el.help.showModal(); store.set('quak:seenHelp', true); }
  } catch (err) {
    el.puzzleLabel.textContent = 'Fehler';
    setMessage(String(err.message || err), 0);
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
