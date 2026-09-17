import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game, buildEdges, findPaths, dailyIndex, shareText, normalizeTyped, typedVariants } from '../app/js/engine.js';

// The public Puzzmo sample board (English) – used to verify the wall/corner semantics.
const sample = {
  grid: [['I', 'N', 'I', 'D'], ['P', 'G', 'F', 'I'], ['E', 'C', 'X', 'N'], ['D', 'M', 'O', 'T']],
  walls: [[[0, 2], [1, 2]], [[1, 0], [1, 1]], [[1, 0], [2, 0]], [[1, 1], [1, 2]], [[1, 1], [2, 1]], [[1, 2], [2, 2]],
    [[2, 1], [2, 2]], [[2, 1], [3, 1]], [[2, 2], [2, 3]], [[3, 0], [3, 1]],
    [[0, 0], [1, 1]], [[0, 1], [1, 0]], [[0, 1], [1, 2]], [[0, 2], [1, 1]], [[0, 2], [1, 3]], [[0, 3], [1, 2]],
    [[1, 0], [2, 1]], [[1, 1], [2, 2]], [[1, 2], [2, 1]], [[2, 1], [3, 0]], [[2, 2], [3, 1]], [[2, 2], [3, 3]]],
  words: 'COME CONFIDING DECO DEMO DEMON DING DINGE DINO DINT INTO PING TOME TOXIN'.split(' ').map(w => ({ w, lemma: w })),
};

test('sample board: 20 connections, every word traceable, all cells needed', () => {
  const g = new Game(sample);
  assert.equal(g.edges.size, 20);
  for (const w of g.words.keys()) assert.ok(g.paths.get(w).length > 0, w);
  assert.equal(g.neededCells.size, 16);
  assert.equal(g.neededEdges.size, 20);
});

test('submit lifecycle: short, notfound, ok, dup, board shrinks, completion', () => {
  const g = new Game(sample);
  assert.equal(g.submit('COM').status, 'short');
  assert.equal(g.submit('COMB').status, 'notfound');
  const r = g.submit('come');
  assert.equal(r.status, 'ok');
  assert.equal(g.submit('COME').status, 'dup');
  assert.equal(g.submit('CONFIDING').star, true);
  // PING is the only word using P (1,0): finding it must reveal that frog.
  const res = g.submit('PING');
  assert.ok(res.cleared.includes('1,0'));
  assert.equal(g.isCellActive(1, 0), false);
  for (const w of g.words.keys()) g.submit(w);
  assert.ok(g.isComplete);
  assert.equal(g.frogsRevealed(), 16);
  assert.equal(g.neededEdges.size, 0);
  assert.equal(g.submit('DECO').status, 'over');
});

test('keyboard entry finds a live path and respects removed edges', () => {
  const g = new Game(sample);
  assert.ok(g.pathForTyped('ping'));
  g.submit('PING');
  assert.equal(g.pathForTyped('ping'), null); // P is gone now
});

test('giving up keeps the honest frog count', () => {
  const g = new Game(sample);
  g.submit('PING');
  g.giveUp();
  assert.ok(g.isOver && !g.isComplete);
  assert.equal(g.frogsRevealed(), 2); // P and the top-left I are only used by PING
  assert.equal(g.remainingWords().length, 12);
});

test('state round trip', () => {
  const g = new Game(sample);
  g.submit('DEMO');
  const g2 = new Game(sample);
  g2.restore(g.toState());
  assert.deepEqual(Array.from(g2.found), ['DEMO']);
});

test('normalizeTyped keeps ß', () => {
  assert.equal(normalizeTyped('straße'), 'STRAßE');
});

test('typed umlaut aliases resolve against puzzle words', () => {
  assert.deepEqual(typedVariants('saege'), ['SAEGE', 'SÄGE']);
  assert.ok(typedVariants('strasse').includes('STRAßE'));
  const p = { grid: [['S', 'Ä', 'G', 'E'], ['X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X'], ['X', 'X', 'X', 'X']],
    walls: [], words: [{ w: 'SÄGE', lemma: 'Säge' }, { w: 'XXXXXXX', lemma: 'x' }] };
  const g = new Game(p);
  assert.ok(g.pathForTyped('saege'));
  assert.equal(g.submit('saege').status, 'ok');
});

test('dailyIndex is stable and wraps', () => {
  assert.equal(dailyIndex(new Date(2026, 8, 17), 400), 0);
  assert.equal(dailyIndex(new Date(2026, 8, 18), 400), 1);
  assert.equal(dailyIndex(new Date(2026, 8, 16), 400), 399);
});

test('share text has a 4x4 emoji board', () => {
  const g = new Game(sample);
  const txt = shareText(g, 'B1 #1', 65000);
  assert.equal(txt.split('\n').length, 5);
  assert.match(txt, /1:05/);
});

for (const level of ['a2', 'b1', 'b2']) {
  test(`shipped pack ${level}: every puzzle is consistent`, () => {
    const pack = JSON.parse(fs.readFileSync(new URL(`../app/puzzles/${level}.json`, import.meta.url)));
    assert.ok(pack.puzzles.length >= 100);
    const ids = new Set();
    for (const p of pack.puzzles) {
      assert.ok(!ids.has(p.id)); ids.add(p.id);
      const g = new Game(p);
      assert.equal(g.neededCells.size, 16, `${p.id}: all cells used`);
      assert.equal(g.neededEdges.size, g.edges.size, `${p.id}: all connections needed`);
      assert.ok(g.starWords.length >= 1 && g.maxLen >= 7, `${p.id}: star word`);
      for (const w of g.words.keys()) {
        assert.ok(w.length >= 4 && findPaths(p.grid, buildEdges(p.walls), w).length > 0, `${p.id}: ${w}`);
      }
      assert.ok(p.words.every(m => m.en && m.lemma), `${p.id}: metadata`);
    }
  });
}
