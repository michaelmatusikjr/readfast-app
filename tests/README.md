# Tooz eReader tests

Browser tests written with Playwright. They drive the built app (`index.html` at the repo root) in headless Chromium.

## Setup

1. Build the app first: `cd src && python3 assemble.py`
2. Serve the repo root on port 8750: `python3 -m http.server 8750`
3. Install Playwright: `npm install playwright-core` (some tests also use `jszip` for making test EPUBs).

## Paths to adjust

These scripts were written in a cloud workspace, so a few paths are absolute:

- Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (the `executablePath` in each script). Change it to your own Chromium, or remove the option to use Playwright's own browser.
- Scratch folder: `/tmp/claude-0/.../scratchpad/` for screenshots, fixtures and the `redteam-epub` folder. Change the `EP`/`S` constants at the top of a script.

## What's here

- `feature/` — one script per feature batch (selection, notes, library, shelf, Bible, contents, footnotes, rotation, tutorial, and `batch13.js` for the November 12 update). Each prints `PASS`/`FAIL` lines or values to check.
- `regression/` — the wider suite (`rt-v3`, `rt-modes`, `rt-data`, `rt-v2`, and the EPUB import harness). `runall.sh` runs them all and writes the output to `rt-v3/out/`. Look for `exit 0` at the end of each output file and no `pageerror` lines.

Tests set `window.__toozKeepSample=true` so the tutorial book stays in the library.
