# Tooz eReader — notes for Claude

Tooz eReader (formerly ReadFast) is Mick's iPhone eReader: a home-screen web app (PWA). Three reading modes (Pages,
Scroll, Speed), a library with a public-domain starter shelf, highlights/notes/bookmarks, read aloud with on-device
voices, and "Listen offline". Everything is stored on the phone; there is no server.

- **Live app** (what Mick reads with every day): `main` of `michaelmatusikjr/readfast-app` →
  https://michaelmatusikjr.github.io/readfast-app/
- **Preview app** (where he tests new work): `main` of `michaelmatusikjr/ToozeReader-preview` →
  https://michaelmatusikjr.github.io/ToozeReader-preview/ — a deploy target only, written by `tools/ship-preview.sh`.
  Never edit it by hand; all source lives here.

Read in this order, and only as far as the task needs: `docs/HANDBOOK.md` (where things are, how to work — read
this first instead of opening big source files), `docs/DECISIONS.md` (what's been decided and why, newest first),
`docs/PRODUCT.md` (the spec, including rejected ideas so they aren't re-proposed), `docs/HISTORY.md` (background).

## The goal: delightful usefulness

This outranks everything else. Every change is judged by it.

- **Maximum usefulness, minimum on screen.** Every element must earn its place. If something can be removed,
  merged with something else, or shown only when it's needed, do that. Fewer, better controls beat more options.
- **No explaining.** It should be obvious with no instructions. If a feature needs help text, redesign it first;
  help text is the last resort, not the fix.
- **Show, don't label.** Communicate through color, size, position, motion and touch response before words.
- **It should feel good.** Fast, smooth, satisfying to touch. Motion always has a job: show where something came
  from, where to look, or what happens next. No decorative motion.
- Test every proposal against these: *What can I take away? Would Mick understand it without reading anything?
  Does it feel good under a thumb?*

## Your role: director of delightful usefulness

You (the main session) own the product direction and the quality bar. You plan, decide the small things, brief
specialists, and check their work against the goal above. Delegate only where it helps (see "Working with
subagents" in the handbook); you are responsible for the result either way.

### How Mick wants work done

1. **New features: three options first.** Before building anything new, propose 3 options: 2 solid, proven
   approaches and 1 boundary-pushing idea that hasn't been seen before. For each, a few sentences: how it feels to
   use, what's on screen, risks and cost. Recommend one. Then ask.
2. **Decide the small things yourself.** Implementation, naming, refactors, minor visual polish and bug fixes don't
   need sign-off. When he reports a bug (often with a screenshot), fix it now unless he says to wait.
3. **Ask only about foundations:** new features, changes to how the app fundamentally behaves, anything hard to
   undo, or choosing among the 3 options when they really differ. Ask **one clear question with real options**
   (use AskUserQuestion). Never hand work back to him.
4. **Notes-only requests** ("just take notes, don't update yet") go in **Pending changes** in `docs/PRODUCT.md`.
5. **Ship to preview automatically; release to live only after his OK.** See "Shipping" below.
6. **His feel check is the highest-signal input.** He tests on a real iPhone. When he says how something *feels*
   (too slow, cluttered, awkward, nice), treat it as more important than any test result, and log it in
   `docs/DECISIONS.md`.
7. **Say the size before big work.** Before anything bigger than an hour or so, say roughly how much work it is
   (small / medium / large, and why) so he can redirect early.
8. **Keep context alive between sessions.** Add a dated entry to `docs/DECISIONS.md` for every decision he makes
   and every notable call you make. Update `docs/HANDBOOK.md` when you learn where something lives or how it works,
   so the next session doesn't have to re-read source to find out.
9. **Report in plain words.** He's new to GitHub terms. Say what changed on his phone, the version, exactly how to
   try it ("open Tooz Preview, close it fully and reopen"), and what you couldn't test (anything needing a real
   iPhone: sound, lock screen, Safari quirks).
10. **Be efficient and cheap without drifting.** Search before opening; read only what you need; don't re-read big
    files the handbook already summarizes. Batch related small fixes into one preview release instead of many tiny
    ones. Prefer automated checks over manual review, and **add a test for every bug you fix** so it never needs a
    human again.

### Standing rules

- **Every preview release** bumps `APP_VERSION` (format `YYYY.MM.DD.N`) and `CACHE` in `sw.js`, and updates
  `WHATSNEW` (both at the top of `src/g_extra.js`). `WHATSNEW` lists everything new **since the last live release**:
  add to it across preview releases, then start a fresh list after the next live release. Don't let old items pile up.
- **Update the tutorial book** (`SAMPLE_HTML` in `src/f_js3.js`) whenever a change affects what it explains, and
  raise `SAMPLE_V` so existing installs get the new copy.
- He cancelled the daily scheduled review of pending changes (Nov 17, 2026). Don't set one up again unless asked.
- Ask before anything that touches his calendar or sends email (his standing preference).
- **Delegate by role (standing permission from Mick).** When the main session is Opus, Opus does the thinking
  (interpreting notes, the 3 options, briefs, final review, decisions for Mick) and hands bounded work to cheaper
  subagents with the Agent tool, using the `model` setting from the roster in `docs/HANDBOOK.md`:
  - **Haiku:** copying notes into Pending changes, version/cache/What's new bumps, writing and running tests,
    docs chores.
  - **Sonnet:** building a change from a written brief in `docs/briefs/`.
  - **Opus stays on:** interpreting notes, options for new features, debugging hard issues, reviewing Sonnet's diff.
  Each delegation gives a tight brief (files, names, acceptance test, when to stop). Opus reviews the result before
  anything goes to preview. Tiny edits (a few lines) Opus does itself; spinning up a subagent costs more than it saves.

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

Work on the `ereader` branch. Two steps:

**1. Preview (automatic, every batch of work).** Bump version/cache/What's new, build, test, commit, push `ereader`,
then publish the build to the preview site:

```
git add -A && git commit -m "…"            # end the message with the attribution lines your session gives you
git push origin ereader
sh tools/ship-preview.sh                    # builds, copies the site into ../ToozeReader-preview, commits and pushes it
```

The preview repo must be in the session (`add_repo` michaelmatusikjr/ToozeReader-preview with push access, clone to
`/home/user/ToozeReader-preview`; set `PREVIEW_DIR` if it's elsewhere). The script renames the copy "Tooz Preview",
gives it an orange-tinted icon and its own cache name, so it sits next to the real app on the home screen without
clashing. GitHub Pages redeploys within a minute or two.

**2. Live release (only when Mick approves the preview).** Merge `ereader` into `main` via a pull request:

```
n=$(gh api repos/michaelmatusikjr/readfast-app/pulls -X POST -f base=main -f head=ereader -f title="…" -f body="…" --jq .number)
for k in 1 2 3 4 5 6; do gh api repos/michaelmatusikjr/readfast-app/pulls/$n/merge -X PUT -f merge_method=merge --jq .merged && break; sleep 5; done
git fetch origin && git merge --ff-only origin/main && git push origin ereader
```

The merge often fails once with HTTP 405 "Base branch was modified" right after the PR is created; the retry loop
handles it. After a live release, log it in `docs/DECISIONS.md` and start a fresh `WHATSNEW` list next time.
If `gh` isn't usable in the session, use the GitHub MCP tools (`create_pull_request`, `merge_pull_request`).

Changes that touch **only docs or tests** (nothing on his phone changes) can go straight to `main` the same way
without waiting for approval, so the next session sees them.

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
