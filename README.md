# Quak – Deutsche Wortsuche 🐸

A German word puzzle for learning vocabulary, inspired by
[Ribbit by Puzzmo](https://www.puzzmo.com/): trace words of four or more letters across a 4×4 board
of connected letter pads. Every found word removes the connections nobody needs any more; when a
letter is no longer needed, its frog pops out. Free all 16 frogs to win. Each found word shows its
English translation, article and an example sentence.

Unofficial, non-commercial, not affiliated with Puzzmo or Hearst. See `NOTICE.md` and `docs/LEGAL.md`.

## Play

**https://marijn1009.github.io/ribbit_deutsch/**

Works in any browser. On a phone, open the link in Chrome and choose *Add to Home screen* to install it
as an app; it works offline after the first load.

- **Levels** A2 / B1 / B2 = the highest CEFR level of the words that can appear in a puzzle.
- **Heute** = today's puzzle for the level (one per day); ‹ › browse, **Zufällig** picks any.
- Input: drag across pads, tap pads one by one (tap the last pad again to submit), or type on a
  keyboard (Enter submits; `ae/oe/ue/ss` work for ä/ö/ü/ß).
- **Hinweis** unlocks after 1 minute of play without a found word and locks again after use.
- Progress, streak and level are stored in the browser.

## Development

```bash
npm start            # serves ./app on http://localhost:8080  (no dependencies)
npm test             # engine unit tests + consistency of shipped puzzle packs
```
Pushes to `main` deploy `app/` to GitHub Pages via `.github/workflows/pages.yml`.

## Puzzle generation

```bash
python3 scripts/generate_puzzles.py --count 400        # regenerates app/puzzles/{a2,b1,b2}.json
python3 scripts/validate_puzzles.py                    # re-derives every solution set and checks it
```
The generator downloads the word list on first run into `data/` (git-ignored). Algorithm and
data format are described in `docs/DESIGN.md`.

## Repository layout

```
app/            the game (static HTML/CSS/JS, PWA)
app/puzzles/    generated puzzle packs per level
scripts/        puzzle generator + validator (Python 3, no dependencies)
tests/          Node test suite (node --test)
docs/DESIGN.md  design document: how Ribbit works and what Quak does
docs/LEGAL.md   legal notes on publishing a Ribbit-style game
serve.cjs        tiny static server for local play
```
