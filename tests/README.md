# Tooz eReader tests

Browser tests written with Playwright. They drive the built app (`index.html` at the repo root) in headless Chromium,
at iPhone size. Each script prints `PASS`/`FAIL` lines (some print values to check) and is run on its own.

## Setup (once)

```
npm install                       # Playwright, jszip, pdf.js, onnxruntime-web, Piper's wasm (versions pinned in package.json)
npx playwright install chromium   # skip if PLAYWRIGHT_BROWSERS_PATH already points at a Chromium for this Playwright version
npm run fixtures                  # makes the test books in tests/fixtures/ (not committed)
```

## Running

```
npm run build                     # rebuild index.html from src/
npm run serve                     # serves the repo root on http://localhost:8750 (leave it running)
node tests/feature/tear.js        # any test
```

Screenshots and other output go to `$TOOZ_SCRATCH` (default: `<system temp>/tooz-tests/`). Paths are set in
`tests/env.js`.

## What's here

- `feature/` — one script per feature or fix, newest first by date. The ones to run after read-aloud or reader
  changes: `smoke`, `batch14`, `batch15`, `selend`, `seledge`, `audioctl`, `piper`, `cadence`, `offline`, `refsplit`,
  `range`, `dash`, `dashsplit`, `paren`, `ellip`, `acro`, `bmswipe`, `tear`.
  - `cadence.js` and `offline.js` use a real Piper voice from Hugging Face (network needed).
  - `piper.js` and `audioctl.js` use the tiny fake voice in `feature/fake-piper/` instead.
  - `dbg*.js`, `shots*.js`, `nshot.js` and `ttsbarshot.js` are one-off debugging or screenshot scripts, not tests.
- `fixtures/make-fixtures.js` — makes the EPUBs and PDF the tests import (`epub_large.epub` is "Big Book", etc.).
- `regression/` — the older, wider suite (`rt-v3`, `rt-modes`, `rt-v2`, `rt-data`, and the EPUB import harness).
  Its fixtures were made in a workspace that no longer exists; `npm run fixtures` re-creates the EPUB/PDF files
  under the same names, but `rt-data/` also needs an older build of the app (`old.html`, `new.html`) and a
  `cases/` folder of odd EPUBs, which are gone. Treat failures there as "check whether the test or the fixture is
  out of date" before assuming the app is broken.

Tests set `window.__toozKeepSample=true` so the tutorial book stays in the library.
