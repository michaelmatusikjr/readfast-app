# How Tooz got here (Nov 2026)

Short history so a new session understands past decisions. Details are in the PR descriptions (#12–#43) and commit
messages.

- **Nov 10–12:** pivot from speed reader to eReader; library, filters, tags, archive, tutorial, notes tab, stats,
  backups, search across books, export, quote cards. Mick tested from a Claude test artifact at first, then (Nov 12)
  switched to testing the live GitHub Pages site, with Claude merging its own PRs.
- **Nov 12–13, selection:** the phone's own selection showed alongside Tooz's; fixed by suppressing it. Highlight
  bands overlapped lines; handles were too tall; the end of short last lines was hard to reach. All fixed in the
  selection code in `e_reader.js`.
- **Nov 13, voices:** Kokoro (in-browser) was ~2× slower than real time on his iPhone, even with WebGPU → replaced by
  Piper (`piper-worker.js`). Cloud options researched (Kokoro on Modal etc.); rejected because they need a card.
  Supertonic 3 tried as an on-device test: the third-party int8 model came out garbled in onnxruntime-web (its integer
  math), so a weight-only 8-bit copy was made and hosted in the repo; it was clear but too slow on iPhone, so
  Supertonic was removed the same day (old downloads are deleted on first launch; `stGone` flag).
- **Nov 13, settings redesign:** Aa slimmed to the frequently used items; mode-specific options moved next to their
  controls; app Settings holds only app-wide items; Light moved to Settings.
- **Nov 13, read-aloud wording:** Bible references, abbreviations, initialisms, parentheses, dashes, semicolons,
  ellipses. Dash-joined words were split into separate words so highlights can stop at a dash; this accidentally split
  verse ranges ("3:7–" + "8"), fixed by a one-time rejoin migration (`rangeJoinText`).
- **Nov 13, cadence:** moved to one sentence per clip, trimmed silence, exact pauses, speed set at synthesis
  (patched Piper `length_scale`), long sentences split at clauses. Mick then asked for shorter sentence pauses; live
  reading now adds none (the clip switch is the pause).
- **Nov 13, Listen offline:** downloaded book audio (MP3 parts + timing manifest in OPFS `audiobooks/`), lock-screen
  playback, export to MP3 per chapter.
- **Nov 16:** Scroll-mode "previously read" tear; swipe-to-delete bookmarks.
- **Nov 17:** daily scheduled review of pending changes cancelled.
- **Nov 18:** project moved to Claude Code; this file, `CLAUDE.md`, `docs/PRODUCT.md`, and portable tests added.
