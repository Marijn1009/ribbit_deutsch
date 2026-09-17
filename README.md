# Quak – Deutsche Wortsuche 🐸

A German word puzzle for learning vocabulary, inspired by
[Ribbit by Puzzmo](https://www.puzzmo.com/): trace words of four or more letters across a 4×4 board
of connected letter pads. Every found word removes the connections nobody needs any more; when a
letter is no longer needed, its frog pops out. Free all 16 frogs to win. Each found word shows its
English translation, article and an example sentence.

Unofficial, non-commercial, not affiliated with Puzzmo or Hearst. See `NOTICE.md` and `docs/LEGAL.md`.

## Play locally

```bash
npm start            # serves ./app on http://localhost:8080  (no dependencies)
```
Or serve the `app/` folder with any static server (`python3 -m http.server -d app 8080`).
Opening `app/index.html` directly from disk does not work because the puzzle packs are loaded with `fetch`.

- **Levels** A2 / B1 / B2 = the highest CEFR level of the words that can appear in a puzzle.
- **Heute** = today's puzzle for the level (one per day, 400-day cycle); ‹ › browse, **Zufällig** picks any.
- Input: drag across pads, tap pads one by one (tap the last pad again to submit), or type on a
  keyboard (Enter submits; `ae/oe/ue/ss` work for ä/ö/ü/ß).
- **Hinweis** unlocks after 1 minute of play without a found word, reveals translation, length and
  starting pad of one remaining word, and locks again for 1 minute.
- Progress, streak and level are stored in the browser's localStorage.
- The app is a PWA: after the first load it works offline and can be installed.

## On a phone (Pixel 10)

1. Host the `app/` folder somewhere reachable over HTTPS. The included workflow
   `.github/workflows/pages.yml` publishes it to GitHub Pages on every push to `main`; enable it once
   under *Settings → Pages → Source: GitHub Actions*. The app then lives at
   `https://<user>.github.io/<repo>/`. Alternatively run `npm start` on a PC and open
   `http://<pc-ip>:8080` on the phone in the same Wi-Fi (playing works over plain HTTP, installing needs HTTPS).
2. Open the URL in Chrome on the phone → menu → **Add to Home screen** / **Install app**.
3. Later options: wrap the PWA as an Android app with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)
   (Trusted Web Activity) or Capacitor. No changes to the game are needed for either.

## Puzzle generation

```bash
python3 scripts/generate_puzzles.py --count 400        # regenerates app/puzzles/{a2,b1,b2}.json
python3 scripts/validate_puzzles.py                    # re-derives every solution set and checks it
npm test                                               # engine unit tests + consistency of shipped packs
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
