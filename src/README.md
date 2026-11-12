# Tooz eReader source

The app is a single file, `index.html` at the repo root, which GitHub Pages serves. Don't edit `index.html` directly. Edit the parts here and rebuild.

## Build

```
cd src
python3 assemble.py        # writes ../index.html
python3 to_artifact.py out.html   # optional: the version used for the Claude test artifact
```

## Parts, in build order

| File | What it holds |
|---|---|
| `a_head.html` | `<head>` and all CSS |
| `b_body.html` | The page markup: library, notes, stats, settings, reader, sheets |
| `c_js1.js` | Settings (`S`, `DEFAULTS`), storage helpers, fonts, themes |
| `old.html` | The original app. `assemble.py` copies line ranges from it wherever a part contains `/*@@OLD:a-b@@*/`, and applies small `rep()`/`fill()` patches |
| `e_reader.js` | The reader: Pages, Scroll, Speed, read aloud, selection, highlights, reading clock |
| `g_extra.js` | What's new and version, storage use, search inside books, export, year in books |
| `f_js3.js` | Stats, settings, backup, library, tags, archive, notes tab, tutorial book, boot |

`APP_VERSION` and the `WHATSNEW` list are at the top of `g_extra.js`. The tutorial text is `SAMPLE_HTML` in `f_js3.js`; raise `SAMPLE_V` whenever it changes so existing installs get the new version.
