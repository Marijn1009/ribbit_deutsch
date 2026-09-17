"""Shared helpers for puzzle generation and validation."""
import json
import os
import re
import urllib.request

DATA_URL = ("https://raw.githubusercontent.com/vbvss199/Language-Learning-decks/"
            "refs/heads/main/german/german.json")
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "german.json")

CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
LETTER_RE = re.compile(r"^[A-ZÄÖÜß]+$")
# Part-of-speech tags in the dataset that mark junk / un-normalised entries.
BAD_POS = {"discard", "unclear", "[keep as-is]", "[as-is]", "none"}

SIZE = 4
DIRS = [(dr, dc) for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr, dc) != (0, 0)]


def upper_de(word: str) -> str:
    """Upper-case a German word but keep ß as a single letter (str.upper turns it into SS)."""
    return "".join("ß" if ch == "ß" else ch.upper() for ch in word)


def load_dataset():
    if not os.path.exists(DATA_PATH):
        os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
        print(f"Downloading {DATA_URL} ...")
        urllib.request.urlretrieve(DATA_URL, DATA_PATH)
    with open(DATA_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def build_dictionary(entries, max_level: str, min_len=4, max_len=10):
    """Return {UPPER_WORD: entry} for all usable words up to the given CEFR level."""
    allowed = set(CEFR_ORDER[: CEFR_ORDER.index(max_level) + 1])
    out = {}
    for e in entries:
        w = e.get("word", "")
        if e.get("cefr_level") not in allowed or e.get("pos") in BAD_POS:
            continue
        up = upper_de(w)
        if not LETTER_RE.match(up) or not (min_len <= len(up) <= max_len):
            continue
        prev = out.get(up)
        if prev is None or e.get("word_frequency", 10**9) < prev.get("word_frequency", 10**9):
            out[up] = e
    return out


class Trie:
    __slots__ = ("children", "word")

    def __init__(self):
        self.children = {}
        self.word = None

    def insert(self, word):
        node = self
        for ch in word:
            node = node.children.setdefault(ch, Trie())
        node.word = word


def build_trie(words):
    t = Trie()
    for w in words:
        t.insert(w)
    return t


def all_pairs():
    """All unordered 8-neighbour pairs on the grid as frozensets of (r, c)."""
    pairs = set()
    for r in range(SIZE):
        for c in range(SIZE):
            for dr, dc in DIRS:
                rr, cc = r + dr, c + dc
                if 0 <= rr < SIZE and 0 <= cc < SIZE:
                    pairs.add(frozenset(((r, c), (rr, cc))))
    return pairs


def find_words(grid, edges, trie):
    """Enumerate every (word -> list of paths) traceable on the grid using only `edges`."""
    found = {}

    def dfs(pos, node, path):
        if node.word is not None:
            found.setdefault(node.word, []).append(list(path))
        r, c = pos
        for dr, dc in DIRS:
            nxt = (r + dr, c + dc)
            if not (0 <= nxt[0] < SIZE and 0 <= nxt[1] < SIZE):
                continue
            if nxt in path or frozenset((pos, nxt)) not in edges:
                continue
            child = node.children.get(grid[nxt[0]][nxt[1]])
            if child is None:
                continue
            path.append(nxt)
            dfs(nxt, child, path)
            path.pop()

    for r in range(SIZE):
        for c in range(SIZE):
            child = trie.children.get(grid[r][c])
            if child is not None:
                dfs((r, c), child, [(r, c)])
    return found


def edges_from_walls(walls):
    blocked = {frozenset((tuple(a), tuple(b))) for a, b in walls}
    return all_pairs() - blocked


def walls_from_edges(edges):
    blocked = all_pairs() - edges
    return sorted([sorted(map(list, e)) for e in blocked])
