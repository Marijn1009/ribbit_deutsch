#!/usr/bin/env python3
"""Generate Quak puzzle packs (4x4 Ribbit-style boards) from the German word list.

Usage:  python3 scripts/generate_puzzles.py [--count N] [--levels A2,B1,B2] [--seed S]

Algorithm (see docs/DESIGN.md §4):
  1. dictionary for the level  2. lay a long "star" word as a random path
  3. lay more words to fill the grid  4. enumerate all dictionary words with all 42 connections
  5. block connections greedily to prune unwanted words  6. block unused connections, validate, emit.
"""
import argparse
import collections
import datetime
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import (SIZE, DIRS, build_dictionary, build_trie, load_dataset,  # noqa: E402
                    all_pairs, find_words, walls_from_edges)

# German letter frequencies (rough, for filling leftover cells).
LETTER_FREQ = {
    "E": 16.4, "N": 9.8, "I": 7.6, "S": 7.3, "R": 7.0, "A": 6.5, "T": 6.2, "D": 5.1, "H": 4.6,
    "U": 4.2, "L": 3.4, "C": 3.0, "G": 3.0, "M": 2.5, "O": 2.5, "B": 1.9, "W": 1.9, "F": 1.7,
    "K": 1.2, "Z": 1.1, "P": 0.8, "V": 0.8, "Ü": 0.7, "Ä": 0.5, "Ö": 0.3, "J": 0.3, "Y": 0.1,
    "X": 0.05, "Q": 0.02, "ß": 0.3,
}

TARGETS = {  # per level: (min words, max words, min star length)
    "A2": (7, 13, 7),
    "B1": (8, 14, 7),
    "B2": (8, 14, 7),
}


def neighbours(pos):
    r, c = pos
    for dr, dc in DIRS:
        rr, cc = r + dr, c + dc
        if 0 <= rr < SIZE and 0 <= cc < SIZE:
            yield (rr, cc)


def place_word(grid, word, rng, require_new=1):
    """Try to lay `word` on the grid reusing matching letters and filling empty cells.

    Returns the path or None. `require_new` = minimum number of empty cells it must fill.
    """
    cells = [(r, c) for r in range(SIZE) for c in range(SIZE)]
    rng.shuffle(cells)

    def dfs(pos, i, path, new):
        if i == len(word):
            return list(path) if new >= require_new else None
        nbrs = list(neighbours(pos))
        rng.shuffle(nbrs)
        for n in nbrs:
            if n in path:
                continue
            cur = grid[n[0]][n[1]]
            if cur is None or cur == word[i]:
                path.append(n)
                res = dfs(n, i + 1, path, new + (cur is None))
                path.pop()
                if res:
                    return res
        return None

    for start in cells:
        cur = grid[start[0]][start[1]]
        if cur is None or cur == word[0]:
            res = dfs(start, 1, [start], int(cur is None))
            if res:
                for (r, c), ch in zip(res, word):
                    grid[r][c] = ch
                return res
    return None


def weighted_choice(rng, items):
    """Prefer common words: pick from a frequency-sorted list with a bias to the front."""
    n = len(items)
    idx = int(n * (rng.random() ** 2))
    return items[min(idx, n - 1)]


def carve(grid, trie, seeds, rng, target_max):
    """Block connections so that the traceable word set shrinks towards the seeds."""
    edges = set(all_pairs())
    words = find_words(grid, edges, trie)
    if any(s not in words for s in seeds):
        return None, None
    # Wanted = seeds + a few frequent extra words; everything else we try to kill.
    extras = sorted((w for w in words if w not in seeds), key=lambda w: (len(w), w))
    rng.shuffle(extras)
    keep = set(seeds)
    for w in extras:
        if len(keep) >= target_max:
            break
        if rng.random() < 0.5:
            keep.add(w)
    unwanted = set(words) - keep

    def alive(word_paths, edge_set):
        return any(all(frozenset((a, b)) in edge_set for a, b in zip(p, p[1:])) for p in word_paths)

    while unwanted:
        best, best_kill = None, 0
        candidates = list(edges)
        rng.shuffle(candidates)
        for e in candidates:
            trial = edges - {e}
            if any(not alive(words[k], trial) for k in keep):
                continue
            kill = sum(1 for u in unwanted if not alive(words[u], trial))
            if kill > best_kill:
                best, best_kill = e, kill
        if best is None:
            break
        edges.discard(best)
        unwanted = {u for u in unwanted if alive(words[u], edges)}

    words = find_words(grid, edges, trie)
    # Every drawn connection must be needed by some word (as in the reference game).
    used = set()
    for paths in words.values():
        for p in paths:
            for a, b in zip(p, p[1:]):
                used.add(frozenset((a, b)))
    edges &= used
    return edges, words


def generate_one(dictionary, trie, rng, level):
    lo, hi, star_min = TARGETS[level]
    by_rank = sorted(dictionary, key=lambda w: dictionary[w].get("word_frequency", 10**9))
    long_words = [w for w in by_rank if star_min <= len(w) <= 10]
    mid_words = [w for w in by_rank if 4 <= len(w) <= 7]

    grid = [[None] * SIZE for _ in range(SIZE)]
    star = weighted_choice(rng, long_words)
    if not place_word(grid, star, rng, require_new=len(star)):
        return None
    seeds = [star]
    for _ in range(40):
        if all(all(row) for row in grid):
            break
        w = weighted_choice(rng, mid_words)
        if w in seeds:
            continue
        if place_word(grid, w, rng, require_new=1):
            seeds.append(w)
    letters, weights = zip(*LETTER_FREQ.items())
    for r in range(SIZE):
        for c in range(SIZE):
            if grid[r][c] is None:
                grid[r][c] = rng.choices(letters, weights)[0]

    edges, words = carve(grid, trie, seeds, rng, hi)
    if edges is None or not (lo <= len(words) <= hi):
        return None
    max_len = max(len(w) for w in words)
    if max_len < star_min:
        return None
    used_cells = {cell for paths in words.values() for p in paths for cell in p}
    if len(used_cells) != SIZE * SIZE:
        return None
    return grid, edges, words, max_len


def entry_to_meta(word, entry, star):
    gender = entry.get("gender") or ""
    return {
        "w": word,
        "lemma": entry.get("word", word),
        "en": entry.get("english_translation", ""),
        "pos": entry.get("pos", ""),
        "gender": gender if gender in ("masculine", "feminine", "neuter") else "",
        "cefr": entry.get("cefr_level", ""),
        "ex": entry.get("example_sentence_native", ""),
        "exEn": entry.get("example_sentence_english", ""),
        "star": star,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=400, help="puzzles per level")
    ap.add_argument("--levels", default="A2,B1,B2")
    ap.add_argument("--seed", type=int, default=20260917)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "app", "puzzles"))
    args = ap.parse_args()

    entries = load_dataset()
    os.makedirs(args.out, exist_ok=True)
    for level in args.levels.split(","):
        rng = random.Random(f"{args.seed}-{level}")
        dictionary = build_dictionary(entries, level)
        trie = build_trie(dictionary)
        print(f"[{level}] dictionary: {len(dictionary)} words")
        puzzles, seen_stars, attempts = [], collections.Counter(), 0
        while len(puzzles) < args.count:
            attempts += 1
            res = generate_one(dictionary, trie, rng, level)
            if res is None:
                continue
            grid, edges, words, max_len = res
            stars = [w for w in words if len(w) == max_len]
            if any(seen_stars[s] >= 2 for s in stars):  # keep star words varied
                continue
            for s in stars:
                seen_stars[s] += 1
            n = len(puzzles) + 1
            puzzles.append({
                "id": f"{level.lower()}-{n:04d}",
                "grid": grid,
                "walls": walls_from_edges(edges),
                "words": [entry_to_meta(w, dictionary[w], len(w) == max_len)
                          for w in sorted(words, key=lambda w: (-len(w), w))],
            })
            if n % 50 == 0:
                print(f"[{level}] {n}/{args.count} (attempts {attempts})")
        pack = {
            "level": level,
            "generated": datetime.date.today().isoformat(),
            "source": "vbvss199/Language-Learning-decks german.json (MIT; frequency data via wordfreq, CC BY-SA 4.0)",
            "puzzles": puzzles,
        }
        path = os.path.join(args.out, f"{level.lower()}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(pack, fh, ensure_ascii=False, separators=(",", ":"))
        sizes = collections.Counter(len(p["words"]) for p in puzzles)
        print(f"[{level}] wrote {path}: {len(puzzles)} puzzles, words/puzzle {dict(sorted(sizes.items()))}, "
              f"acceptance {len(puzzles)/attempts:.1%}")


if __name__ == "__main__":
    main()
