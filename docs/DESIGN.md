# Quak – Design Document

*A German-language word puzzle in the style of Ribbit (Puzzmo), built for learning German vocabulary.*

> **Naming.** "Ribbit" is the name of Puzzmo's game and is very likely a trademark of Puzzmo / Hearst.
> This project is called **Quak** (the German frog sound). The repository name `ribbit_deutsch` is only
> a working name. See `docs/LEGAL.md` for why the name, artwork and puzzle content must be our own.

---

## 1. Reference: how Ribbit (Puzzmo) works

Everything below is reconstructed from public descriptions of the game (Puzzmo's own "how to play" text as
quoted by press, reviews, and the public puzzle JSON format from the Puzzmo team's lexicon gist). No
Puzzmo code or assets were used.

### 1.1 Board
- A fixed **4×4 grid of 16 lettered tiles** ("lily pads"). Under every tile hides a frog.
- Tiles are connected by drawn **paths**. A path may join two tiles that are orthogonal *or diagonal*
  neighbours (8-neighbourhood). Not every neighbouring pair is connected: **walls** block some
  orthogonal pairs and some diagonal pairs ("corners").
- Visual focus is on the paths (solid lines) rather than the walls (light). Only connected tiles can be
  traced consecutively.
- Puzzmo's internal format for a puzzle is (coordinates are `[row, col]`):
  ```json
  { "grid": [["I","N","I","D"],["P","G","F","I"],["E","C","X","N"],["D","M","O","T"]],
    "solutions": ["COME","CONFIDING","DECO", "..."],
    "walls":   [[[0,2],[1,2]], "..."],   // blocked orthogonal pairs
    "corners": [[[0,0],[1,1]], "..."] }  // blocked diagonal pairs
  ```
  Verified against that sample: with walls + corners removed from the 8-neighbour graph, all 13
  solution words are traceable, **every one of the 16 tiles is used by at least one solution**, and
  **every remaining connection (20 of 42) is used by at least one solution**. That is, the initial board
  contains no "decorative" connections – each drawn path is needed by some hidden word.

### 1.2 Rules
- A word is a path that hops from tile to tile along connections, **without reusing a tile**.
- Words must be **4 letters or longer**.
- Each puzzle has a fixed, finite list of hidden words (typically ~10–15). Only those count.
- **When a word is found**, connections that are no longer needed by any *unfound* word disappear.
  Tiles that are no longer needed by any unfound word disappear too, and the **frog underneath pops
  out**. So the board shrinks and the puzzle gets easier as you go.
- Tiles are shared between words. A tile only clears once *every* word using it is found.
- The **longest word(s)** in the puzzle are "star words" and get a ⭐ when found. Every puzzle has at
  least one long word.
- **Frogs are the score**: uncover all 16 to finish. Puzzmo also tracks time; abandoning the puzzle
  reduces the score by the number of frogs still hidden.
- **No hint button.** The tip Puzzmo gives is "try short words first – the board gets smaller".

### 1.3 Input
- Drag across tiles (mouse or touch) to trace a word; release to submit.
- Or tap tiles one at a time; tap the last tile again (or a submit control) to submit.
- Or type on a physical keyboard; Enter submits, Backspace deletes.
- Illegal moves (non-connected tile, tile already used) are simply not accepted.

### 1.4 Feedback & completion
- The word being traced is shown above the board.
- Valid word: tiles pulse, word goes to the found list, paths/tiles/frogs update with animation.
- Already found / not in puzzle / too short: short shake and a message.
- On completion: all frogs bounce, a results panel shows time and a shareable summary.

---

## 2. Quak – what the app must do

### 2.1 Core gameplay (parity with Ribbit)
| # | Feature | Behaviour |
|---|---------|-----------|
| G1 | 4×4 board | 16 letter tiles, 8-neighbour connections minus walls, drawn as solid lines. |
| G2 | Tracing | Drag (pointer events, works with touch), tap-by-tap, and keyboard entry. Only connected, unused tiles can be appended. |
| G3 | Word rules | ≥4 letters; must be in the puzzle's solution list; no tile reuse. |
| G4 | Board shrinking | After each found word, recompute needed edges/tiles from the *remaining* words (all of their possible paths). Unneeded edges fade out; unneeded tiles flip to a frog 🐸. |
| G5 | Star words | The longest word(s) of the puzzle get a ⭐ in the found list and on submit. |
| G6 | Progress | Frogs revealed `x / 16`, words found `y / N`, elapsed time. |
| G7 | Completion | All 16 frogs shown, bouncing; results panel with time, word count, share text (emoji grid). |
| G8 | Feedback | Messages: *Zu kurz*, *Schon gefunden*, *Nicht in diesem Rätsel*, *Keine Verbindung*. |
| G9 | Persistence | Progress per puzzle stored in `localStorage`, so a reload continues where you were. |
| G10 | Daily puzzle | One puzzle per calendar day per level, chosen deterministically from the puzzle pack. Streak counter. |
| G11 | Hints (deviation) | Ribbit has no hint button. Quak has one, but it only unlocks after **3 minutes of play time without a found word** (counted from puzzle start or the last found word). A hint shows translation, length, word class and pulses the starting pad of one remaining word (shortest first), then locks again for 3 minutes. Hints used are shown in the results/share text. |

### 2.2 German-learning extensions (deviations from Ribbit, all opt-in or post-game)
| # | Feature | Behaviour |
|---|---------|-----------|
| L1 | Translations | Every found word shows its English translation; tapping a found word shows the example sentence (DE + EN), part of speech and CEFR level. |
| L2 | Articles | Nouns are listed with their article (*der/die/das*) derived from the gender field. |
| L3 | Levels | Puzzle packs per CEFR ceiling: **A2** (A1–A2 words), **B1** (A1–B1), **B2** (A1–B2). The level determines which words can appear *at all*, so a beginner never has to find a C1 word. |
| L4 | Practice mode | "Zufälliges Rätsel" – any puzzle from the pack, unlimited. |
| L5 | Give up | "Aufgeben" ends the puzzle and reveals the remaining words *with translations* – for learning. Counted as not solved. |
| L6 | Umlauts | Ä, Ö, Ü and ß are their own tiles (as in real German spelling). Keyboard entry accepts `ae/oe/ue/ss` as aliases. |
| L7 | Word review | The results panel lists all words with translations so the vocabulary can be reviewed after playing. |

### 2.3 Non-functional
- **Runs locally with zero build step**: plain HTML/CSS/JS (ES modules). `npm start` serves the `app/`
  folder; opening via any static server works.
- **Installable PWA** (manifest + service worker, offline after first load) so it can be added to the
  home screen of a Pixel 10 from Chrome. Later options: Bubblewrap/TWA or Capacitor for an APK.
- Works on phone width (≥360 px) and desktop; touch-friendly tile size.
- No backend, no accounts, no network calls at runtime other than loading the static files.
- Puzzle packs are pre-generated and shipped as JSON; the generator is part of the repo.

---

## 3. Data model

### 3.1 Puzzle (as shipped in `app/puzzles/<level>.json`)
```json
{
  "level": "B1",
  "generated": "2026-09-17",
  "source": "vbvss199/Language-Learning-decks german.json (MIT, data CC BY-SA 4.0 via wordfreq)",
  "puzzles": [
    {
      "id": "b1-0001",
      "grid": [["H","A","U","S"],["...","...","...","..."],["..."],["..."]],
      "walls": [[[0,2],[1,2]], "..."],        // blocked pairs, Puzzmo-compatible (row, col)
      "words": [
        { "w": "HAUS", "lemma": "Haus", "en": "house", "pos": "noun", "gender": "neuter",
          "cefr": "A1", "ex": "Das Haus hat einen großen Garten.", "exEn": "The house has a big garden.",
          "star": false }
      ]
    }
  ]
}
```
Paths are **not** stored; the app recomputes all paths of each solution word by DFS on load
(16 tiles, trivial cost). This is what drives the "needed edge / needed tile" logic.

### 3.2 Runtime state
```
puzzleId, elapsedMs, lastEventElapsed, foundWords[], hintsUsed, hinted[], gaveUp, done
```
stored under `quak:progress:<puzzleId>`; streak/meta under `quak:meta`.

---

## 4. Puzzle generation (`scripts/generate_puzzles.py`)

1. **Word pool.** Load `german.json`; keep entries whose `word` is purely letters `[A-ZÄÖÜß]` after
   upper-casing, length 4–10, CEFR ≤ level, `pos` not in {discard, unclear}. De-duplicate by upper-case
   form (keep the most frequent entry). This is the *dictionary* for the level: any dictionary word that
   is traceable on a board is a solution and must be found.
2. **Seed.** Pick a star word (7–10 letters, preferring common words) and lay it on the empty 4×4 grid
   as a random self-avoiding 8-neighbour path.
3. **Fill.** Repeatedly pick medium words (4–7 letters) and try to lay them so they reuse existing
   matching letters and fill empty cells. If cells remain empty, fill with letters drawn from German
   letter frequencies.
4. **Enumerate.** With all 42 connections present, DFS with a trie to collect every `(word, path)` in
   the dictionary.
5. **Carve walls.** Choose a *keep* set (the seed words plus a few others up to the target word count)
   and iteratively block the connection that kills the most *unwanted* words while every kept word
   still has at least one path. Stop when the surviving word count is within target (8–14).
6. **Tidy & validate.** Block every remaining connection that no surviving word uses (so, as in Ribbit,
   every drawn path is needed). Reject the board unless: every tile is used by ≥1 word, the star word
   survived, word count is within range, and there is at least one word of length ≥7.
7. **Emit** the puzzle with the full word metadata copied from the dataset.

`scripts/validate_puzzles.py` re-derives the solution set with the same dictionary and asserts that
the shipped solution list is exactly the set of traceable dictionary words (no missing, no extra).

---

## 5. UI layout

```
┌──────────────────────────────┐
│ Quak            A2 B1 B2  ⚙ │  header: level switch, menu (daily / random / archive)
│ Rätsel #123 · 17.9.2026  ⏱ 01:23 │
│                              │
│      [ current word ]        │  traced letters, big
│                              │
│   ○───○   ○───○              │
│   │ ╲ │   │                  │  board (SVG): paths under tiles, tiles as circles,
│   ○   ○───○   ○              │  frog emoji where tile cleared
│    ╲  │       │              │
│   ○───○───○───○              │
│                              │
│  🐸 5/16   Wörter 4/12  ⭐0/1 │  progress row
│                              │
│  Gefunden: HAUS (house) …    │  found list, tap for details
│  [Heute] [Zufällig] [Hinweis (2:31)] [Aufgeben] │
└──────────────────────────────┘
```

Colours: our own palette (pond greens/blues), our own frog emoji, no Puzzmo assets.

---

## 6. Later: getting it on a Pixel 10
1. **PWA (easiest).** Host `app/` on GitHub Pages, open it in Chrome on the phone, "Add to Home screen".
   Offline works through the service worker. No store, no signing.
2. **TWA / Bubblewrap.** Wrap the hosted PWA into an APK for a real Android app (still just a web view).
3. **Capacitor.** If native features are ever needed.
The code is written so that none of these require changes to the game itself.
