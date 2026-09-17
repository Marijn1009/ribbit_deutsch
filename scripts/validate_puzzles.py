#!/usr/bin/env python3
"""Re-derive the solution set of every shipped puzzle and assert it matches exactly."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import build_dictionary, build_trie, load_dataset, find_words, edges_from_walls  # noqa: E402

PACK_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "puzzles")


def main():
    entries = load_dataset()
    ok = True
    for name in sorted(os.listdir(PACK_DIR)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(PACK_DIR, name), encoding="utf-8") as fh:
            pack = json.load(fh)
        trie = build_trie(build_dictionary(entries, pack["level"]))
        bad = 0
        for p in pack["puzzles"]:
            edges = edges_from_walls(p["walls"])
            words = find_words(p["grid"], edges, trie)
            shipped = {w["w"] for w in p["words"]}
            if set(words) != shipped:
                bad += 1
                print(f"{p['id']}: missing {set(words) - shipped} extra {shipped - set(words)}")
            used = {cell for paths in words.values() for path in paths for cell in path}
            if len(used) != 16:
                bad += 1
                print(f"{p['id']}: only {len(used)} cells used")
        print(f"{name}: {len(pack['puzzles'])} puzzles, {bad} problems")
        ok &= bad == 0
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
