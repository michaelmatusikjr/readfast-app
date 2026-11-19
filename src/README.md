# Tooz eReader source

The app is a single file, `index.html` at the repo root, which GitHub Pages serves. Don't edit `index.html` directly. Edit the parts here and rebuild.

## Build

```
cd src
python3 assemble.py        # writes ../index.html
```

## Parts, in build order

| File | What it holds |
|---|---|
| `a_head.html` | `<head>` and all CSS |
| `b_body.html` | The page markup: library, notes, stats, settings, reader, sheets |
| `c_js1.js` | Settings (`S`, `DEFAULTS`), storage helpers, fonts, themes |
| `old.html` | The original app. `assemble.py` copies line ranges from it wherever a part contains `/*@@OLD:a-b@@*/`, and applies small `rep()`/`fill()` patches |
| `e_reader.js` | The reader: Pages, Scroll, Speed, read aloud, selection, highlights, reading clock |
| `i_speech.js` | What read-aloud says: scripture references and abbreviations in full, no "colon", notes skipped, paragraph and heading pauses |
| `h_voice.js` | Natural read-aloud voices (Piper, via `../piper-worker.js`) and the iPhone voice list |
| `j_audiobook.js` | Listen offline: downloading a book's read-aloud audio, playing it, saving MP3s (encoder in `../mp3-worker.js`) |
| `g_extra.js` | What's new and version, storage use, search inside books, export, year in books |
| `k_tour.js` | The first-run tour (demo layer) |
| `l_guide.js` | The Guide: one accent blob that flies to where you look or tap next (`guideTo`) |
| `f_js3.js` | Stats, settings, backup, library, tags, archive, notes tab, tutorial book, boot |

`APP_VERSION` and the `WHATSNEW` list are at the top of `g_extra.js`. The tutorial text is `SAMPLE_HTML` in `f_js3.js`; raise `SAMPLE_V` whenever it changes so existing installs get the new version.

## Workers

- `../piper-worker.js`: `piper/worker-entry.js` bundled with `@mintplex-labs/piper-tts-web@1.0.5` and
  `onnxruntime-web@1.18.0`. Rebuild with `npm install` then `node src/piper/build.mjs .` from the repo root.
  `build.mjs` patches the library so the speaking speed can be set per sentence. Voice files download from
  Hugging Face on first use and are kept in the phone's private file storage.
- `../mp3-worker.js`: `audiobook/mp3-worker-entry.js` with `@breezystack/lamejs@1.2.7` (LGPL-3.0). Rebuild with
  `sh src/audiobook/build.sh .` from the repo root.

After changing a worker, bump `CACHE` in `../sw.js`.
