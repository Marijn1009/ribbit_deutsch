// Pure game logic for Quak – no DOM access, so it can be unit-tested in Node.

export const SIZE = 4;
export const MIN_LEN = 4;
/** Play time without a found word (or hint) before the hint button unlocks. */
export const HINT_DELAY_MS = 60 * 1000;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export const cellKey = (r, c) => `${r},${c}`;

export function edgeKey(a, b) {
  const ka = cellKey(a[0], a[1]);
  const kb = cellKey(b[0], b[1]);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Every unordered 8-neighbour pair on the board. */
export function allPairs() {
  const pairs = new Map();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) continue;
        pairs.set(edgeKey([r, c], [rr, cc]), [[r, c], [rr, cc]]);
      }
    }
  }
  return pairs;
}

/** Allowed connections = all neighbour pairs minus the puzzle's walls. Returns Map edgeKey -> [a, b]. */
export function buildEdges(walls) {
  const edges = allPairs();
  for (const [a, b] of walls) edges.delete(edgeKey(a, b));
  return edges;
}

/** All paths spelling `word` on the grid using only `edges`. */
export function findPaths(grid, edges, word) {
  const paths = [];
  const dfs = (pos, i, path) => {
    if (i === word.length) { paths.push(path.slice()); return; }
    for (const [dr, dc] of DIRS) {
      const n = [pos[0] + dr, pos[1] + dc];
      if (n[0] < 0 || n[1] < 0 || n[0] >= SIZE || n[1] >= SIZE) continue;
      if (grid[n[0]][n[1]] !== word[i]) continue;
      if (!edges.has(edgeKey(pos, n))) continue;
      if (path.some(p => p[0] === n[0] && p[1] === n[1])) continue;
      path.push(n); dfs(n, i + 1, path); path.pop();
    }
  };
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === word[0]) dfs([r, c], 1, [[r, c]]);
    }
  }
  return paths;
}

/** Upper-case a typed German string, keeping ß as one letter. */
export function normalizeTyped(s) {
  return Array.from(s).map(ch => (ch === 'ß' ? 'ß' : ch.toUpperCase())).join('');
}

const ALIASES = [['AE', 'Ä'], ['OE', 'Ö'], ['UE', 'Ü'], ['SS', 'ß']];

/** All spellings of a typed word where AE/OE/UE/SS may stand for Ä/Ö/Ü/ß (original first). */
export function typedVariants(word) {
  let variants = [normalizeTyped(word)];
  for (const [pair, letter] of ALIASES) {
    const next = [];
    for (const v of variants) {
      next.push(v);
      let idx = v.indexOf(pair);
      while (idx !== -1) {
        next.push(v.slice(0, idx) + letter + v.slice(idx + 2));
        idx = v.indexOf(pair, idx + 1);
      }
    }
    variants = Array.from(new Set(next)).slice(0, 64);
  }
  return variants;
}

export class Game {
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.grid = puzzle.grid;
    this.edges = buildEdges(puzzle.walls);
    this.words = new Map(puzzle.words.map(w => [w.w, w]));
    this.paths = new Map();
    for (const w of this.words.keys()) this.paths.set(w, findPaths(this.grid, this.edges, w));
    this.found = new Set();
    this.gaveUp = false;
    this.hintsUsed = 0;
    this.hinted = new Set();
    this.maxLen = Math.max(...Array.from(this.words.keys()).map(w => w.length));
    this._recompute();
  }

  get totalWords() { return this.words.size; }
  get foundCount() { return this.found.size; }
  get isComplete() { return this.found.size === this.words.size; }
  get isOver() { return this.isComplete || this.gaveUp; }
  get starWords() { return Array.from(this.words.keys()).filter(w => w.length === this.maxLen); }
  get starsFound() { return this.starWords.filter(w => this.found.has(w)).length; }

  /** Recompute which edges / cells are still needed by unfound words. */
  _recompute() {
    this.neededEdges = new Set();
    this.neededCells = new Set();
    for (const [w, paths] of this.paths) {
      if (this.found.has(w)) continue;
      for (const p of paths) {
        for (let i = 0; i < p.length; i++) {
          this.neededCells.add(cellKey(p[i][0], p[i][1]));
          if (i > 0) this.neededEdges.add(edgeKey(p[i - 1], p[i]));
        }
      }
    }
  }

  isCellActive(r, c) { return this.neededCells.has(cellKey(r, c)); }
  isEdgeActive(a, b) { return this.neededEdges.has(edgeKey(a, b)); }
  frogsRevealed() { return SIZE * SIZE - this.neededCells.size; }

  /** Can `to` be appended to a selection currently ending at `from`? */
  canStep(from, to, path) {
    if (!this.isCellActive(to[0], to[1])) return false;
    if (path.some(p => p[0] === to[0] && p[1] === to[1])) return false;
    return this.neededEdges.has(edgeKey(from, to));
  }

  wordFromPath(path) { return path.map(([r, c]) => this.grid[r][c]).join(''); }

  /** Find a currently-legal path spelling `word` (for keyboard entry). */
  pathForTyped(word) {
    if (!word) return null;
    const live = new Map();
    for (const [k, v] of this.edges) if (this.neededEdges.has(k)) live.set(k, v);
    const grid = this.grid.map((row, r) => row.map((ch, c) => (this.isCellActive(r, c) ? ch : null)));
    for (const w of typedVariants(word)) {
      const paths = findPaths(grid, live, w);
      if (paths.length) return paths[0];
    }
    return null;
  }

  /** The spelling of a typed word that is a puzzle word (umlaut aliases resolved), else the plain form. */
  resolveTyped(word) {
    return typedVariants(word).find(v => this.words.has(v)) || normalizeTyped(word);
  }

  /**
   * Submit a word. Returns {status, word, star?, meta?, cleared?} where status is one of
   * 'ok' | 'short' | 'dup' | 'notfound' | 'over'.
   */
  submit(word) {
    if (this.isOver) return { status: 'over', word };
    const w = this.resolveTyped(word);
    if (w.length < MIN_LEN) return { status: 'short', word: w };
    if (this.found.has(w)) return { status: 'dup', word: w };
    if (!this.words.has(w)) return { status: 'notfound', word: w };
    const before = new Set(this.neededCells);
    this.found.add(w);
    this._recompute();
    const cleared = Array.from(before).filter(k => !this.neededCells.has(k));
    return { status: 'ok', word: w, star: w.length === this.maxLen, meta: this.words.get(w), cleared };
  }

  giveUp() {
    this.gaveUp = true;
    this._recompute();
  }

  /** Words not yet found, longest first. */
  remainingWords() {
    return Array.from(this.words.values()).filter(m => !this.found.has(m.w));
  }

  /**
   * Give a hint for one unfound word: its metadata (translation, length) and the pad it starts on.
   * Prefers short words that have not been hinted yet. Returns null when nothing is left.
   */
  hint() {
    if (this.isOver) return null;
    const remaining = this.remainingWords().sort((a, b) => a.w.length - b.w.length || a.w.localeCompare(b.w));
    if (!remaining.length) return null;
    const meta = remaining.find(m => !this.hinted.has(m.w)) || remaining[0];
    this.hinted.add(meta.w);
    this.hintsUsed += 1;
    const path = this.paths.get(meta.w)[0];
    return { meta, start: path[0], length: meta.w.length };
  }

  /** Serialise progress. */
  toState() {
    return { found: Array.from(this.found), gaveUp: this.gaveUp, hintsUsed: this.hintsUsed, hinted: Array.from(this.hinted) };
  }

  restore(state) {
    if (!state) return;
    for (const w of state.found || []) if (this.words.has(w)) this.found.add(w);
    this.gaveUp = !!state.gaveUp;
    this.hintsUsed = state.hintsUsed || 0;
    for (const w of state.hinted || []) this.hinted.add(w);
    this._recompute();
  }
}

/** Article for a noun by gender. */
export function article(gender) {
  return { masculine: 'der', feminine: 'die', neuter: 'das' }[gender] || '';
}

export function displayLemma(meta) {
  const art = meta.pos === 'noun' ? article(meta.gender) : '';
  return art ? `${art} ${meta.lemma}` : meta.lemma;
}

/** Deterministic index of today's puzzle. */
export function dailyIndex(date, count, epoch = '2026-09-17') {
  const d = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const [y, m, day] = epoch.split('-').map(Number);
  const e = Date.UTC(y, m - 1, day);
  const days = Math.round((d - e) / 86400000);
  return ((days % count) + count) % count;
}

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Share text: emoji board of frogs (🐸 revealed, 🟩 hidden). */
export function shareText(game, label, elapsedMs) {
  const rows = [];
  for (let r = 0; r < SIZE; r++) {
    let row = '';
    for (let c = 0; c < SIZE; c++) row += game.isCellActive(r, c) ? '🟩' : '🐸';
    rows.push(row);
  }
  const head = `Quak ${label} · 🐸 ${game.frogsRevealed()}/16 · Wörter ${game.foundCount}/${game.totalWords}` +
    ` · ⭐ ${game.starsFound}/${game.starWords.length} · ⏱ ${formatTime(elapsedMs)}` +
    (game.hintsUsed ? ` · 💡 ${game.hintsUsed}` : '');
  return `${head}\n${rows.join('\n')}`;
}
