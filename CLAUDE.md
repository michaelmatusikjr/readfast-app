# Tooz eReader — notes for Claude

Tooz eReader (formerly ReadFast) is Mick's iPhone eReader. It's a home-screen web app (PWA) served by GitHub Pages
from the `main` branch of `michaelmatusikjr/readfast-app`: https://michaelmatusikjr.github.io/readfast-app/.
It has three reading modes (Pages, Scroll, Speed), a library with a public-domain starter shelf, highlights/notes/
bookmarks, read aloud with on-device voices, and "Listen offline" (downloaded book audio). Everything is stored on
the phone; there is no server.

Read `docs/PRODUCT.md` for what Mick has asked for and decided (it's the spec, and it records rejected ideas so they
aren't re-proposed). Read `docs/HISTORY.md` for how things got the way they are, especially read aloud.

## How Mick wants work done

- **Make the change, then ship it.** Work on the `ereader` branch, then open a pull request to `main` and merge it
  yourself (he asked for this on Nov 12, 2026). Then fast-forward `ereader` to `main` and push. See "Shipping" below.
- **No test artifact** unless it's truly needed. He tests on his iPhone from the live site.
- **Every update bumps `APP_VERSION` and lists only its own items in `WHATSNEW`** (both at the top of
  `src/g_extra.js`). Replace the previous list; don't let it grow. Version format: `YYYY.MM.DD.N`.
- **Standing rule: update the tutorial book** (`SAMPLE_HTML` in `src/f_js3.js`) whenever a change affects what it
  explains, and raise `SAMPLE_V` so existing installs get the new copy.
- **He's new to GitHub terms.** Report results in plain words: what changed on his phone, how to get it ("close and
  reopen the app"), and what you couldn't test (anything that needs a real iPhone: sound, lock screen, Safari quirks).
- When he reports a bug with a screenshot, fix it now unless he says to wait. He sometimes asks for notes only
  ("just take notes, don't update yet"); then add the item to the **Pending changes** list in `docs/PRODUCT.md`.
- He cancelled the daily scheduled review of pending changes (Nov 17, 2026). Don't set one up again unless asked.
- Ask before anything that touches his calendar or sends email (his standing preference).

## Build

The app is one file, `index.html`, assembled from parts in `src/`. **Never edit `index.html` by hand.**

```
cd src && python3 assemble.py          # writes ../index.html
```

Quick syntax check after building (catches most mistakes before a browser run):

```
python3 -c "s=open('index.html').read(); i=s.rindex('<script>'); j=s.rindex('</script>'); open('/tmp/x.js','w').write(s[i+8:j])" && node --check /tmp/x.js
```

`src/README.md` lists the parts and what each holds. In short: `a_head.html` (all CSS), `b_body.html` (markup),
`c_js1.js` (settings/storage/themes), `e_reader.js` (reader, Scroll/Pages/Speed, selection, read-aloud controls,
the Scroll "previously read" tear), `i_speech.js` (what read aloud says), `h_voice.js` (Piper voices, pauses,
playback), `j_audiobook.js` (Listen offline), `g_extra.js` (What's new, search, export), `f_js3.js` (library,
settings, backup, notes tab, tutorial, boot). `old.html` is the original app; `assemble.py` splices line ranges
from it where a part says `/*@@OLD:a-b@@*/`.

### Workers (prebuilt, committed at the repo root)

| File | Source | Rebuild |
|---|---|---|
| `piper-worker.js` | `src/piper/worker-entry.js` + `@mintplex-labs/piper-tts-web@1.0.5` + `onnxruntime-web@1.18.0` | `npm install` then `node src/piper/build.mjs .` |
| `mp3-worker.js` | `src/audiobook/mp3-worker-entry.js` + `@breezystack/lamejs@1.2.7` (LGPL-3.0) | `sh src/audiobook/build.sh .` |

`src/piper/build.mjs` patches piper-tts-web at build time so the speaking speed can be set per sentence
(`length_scale × globalThis.__toozLenMul`). If the library changes, the patch throws instead of silently failing.

### Service worker and caching

`sw.js` caches the app for offline use. **Bump `CACHE` in `sw.js` whenever a worker file or `sw.js` itself changes**,
or phones keep the old copy. `books/` and `voices/` paths are deliberately not cached (they're big and stored
elsewhere). Voice models and saved audio live in the phone's private file storage (OPFS): folders `piper`,
`audiobooks/<book id>`.

## Shipping

```
git add -A && git commit -m "…"            # end the message with the attribution lines your session gives you
git push origin ereader
n=$(gh api repos/michaelmatusikjr/readfast-app/pulls -X POST -f base=main -f head=ereader -f title="…" -f body="…" --jq .number)
for k in 1 2 3 4 5 6; do gh api repos/michaelmatusikjr/readfast-app/pulls/$n/merge -X PUT -f merge_method=merge --jq .merged && break; sleep 5; done
git fetch origin && git merge --ff-only origin/main && git push origin ereader
```

The merge often fails once with HTTP 405 "Base branch was modified" right after the PR is created; the retry loop
handles it. GitHub Pages redeploys `main` within a minute or two.

## Tests

Browser tests with Playwright against the built app served on port 8750. See `tests/README.md` for setup
(`npm install`, `npx playwright install chromium`, `npm run fixtures`, `npm run serve`). Run a test with
`node tests/feature/<name>.js`; each prints `PASS`/`FAIL` lines. When you add a feature, add a test in
`tests/feature/` the same way.

Useful patterns from existing tests:
- `window.__toozKeepSample=true` (init script) keeps the tutorial book in the library.
- Build a small book directly: `Store.put('texts', {id, words, ends, blocks, …})`, push a meta into `LIB`, `touch(m)`,
  then `await openDoc(id)` (see `tests/feature/range.js`).
- Simulate leaving the app by overriding `document.hidden`/`visibilityState` and dispatching `visibilitychange`
  (see `tests/feature/tear.js`).
- Speech text can be checked without audio: `speechChunk(i, max, min).text` / `natChunkAt(i)`.
- Real Piper voices download from Hugging Face; tests that use them need network access to huggingface.co
  (and its CDN, hf.co). `tests/feature/cadence.js` and `offline.js` check timing and saved audio with the real voice.

## Things learned the hard way

- **iPhone Safari:** `FileSystemHandle.remove()` doesn't exist; delete OPFS files with `dir.removeEntry(name)`.
  `navigator.share({files})` only works straight after a tap, so gather files first, then share on a second tap.
  A web app stops completely when swiped away; audio keeps playing with the screen locked only from an `<audio>`
  element that's already playing.
- **The phone's own text-selection UI** must stay suppressed in books (Tooz draws its own selection and handles).
- **GitHub Pages compresses some files**, so `Content-Length` can't be trusted for download progress; use known sizes.
- **Read aloud** builds its spoken text in `i_speech.js` (`speechChunk`). Bible references, initialisms, dashes,
  ellipses, number ranges and footnote markers all have rules there; `docs/PRODUCT.md` lists what he asked for.
  Live reading plays one sentence per clip; the gap when switching clips is the only pause between sentences.
  Saved audio (Listen offline) has exact pauses baked in.
- **Dash-joined words are split into separate words** (so highlights can stop at a dash), but number ranges like
  `3:7–8` are kept whole. Existing books are converted once on open (`dashSplitText`, `rangeJoinText` in
  `e_reader.js`), renumbering positions, highlights and bookmarks. Any future change to word splitting needs the
  same kind of one-time migration.
- **Voices tried and removed:** Kokoro (too slow on iPhone, even with WebGPU) and Supertonic 3 (too slow; a
  third-party int8 copy also came out garbled in onnxruntime-web). Piper is the natural voice. A paid cloud voice
  (Kokoro on Modal) was rejected because it needs a credit card.
