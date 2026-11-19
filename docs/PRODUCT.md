# Tooz eReader — what Mick wants (spec and decisions)

Collected from his requests, Nov 2026. "He" is Mick, the owner. Keep this up to date when he decides something new,
and move items out of **Pending changes** once they're built.

## Pending changes (not yet built)

- (none)

## The app

- Started as a speed reader (ReadFast); pivoted in Nov 2026 to an eReader with a speed-reading option, renamed
  **Tooz eReader**. He wants other people to be able to use it too, from the same link.
- Installable web app on the iPhone home screen; works offline. No App Store build.
- All reading data stays on the phone. No account or sync to his Claude account.
- Visible progress whenever something is loading.
- Only text inside a book is selectable; app interface text is not. In books, the phone's own selection menu is
  suppressed; Tooz's **Define** gives access to the phone's lookup.

## Reading modes

- **Pages** (page by page), **Scroll** (one long column, with auto-scroll), **Speed** (one word at a time). Only the
  settings for the current mode show. Reading settings apply to every book (global, not per book).
- Firm rule: navigating anywhere (chapter, scroll-and-tap, bookmark, scrubber) lands **paused** and never auto-plays.
  Reading only starts when he presses play.
- Keeping place on rotation or any layout change: anchor on the top-left word, show the page containing it, keep that
  anchor until a page is turned.
- Auto-scroll: a tap pauses it; further taps only show/hide controls; only the play button resumes. Auto-scroll has
  its own footer button in Scroll, with its options under ⋯.
- Speed reader: word-start emphasis, adaptive pacing; hyphenated words stay up longer; en/em dashes attach to the
  word before with a comma-length pause. Speed options are under a gear on the Speed controls.
- **Scroll "previously read" tear** (built Nov 16): whenever he leaves the reader in Scroll mode (any time at all,
  even a few seconds in another app) or closes it, the text is shown torn apart just before the first line that was
  on screen: the last line read ends the top page, ragged torn edges, then the page continues (mid-paragraph if
  needed). The gap says "Previously read" with up-arrows on each side and is centred on screen on return. The tear
  stays while he reads on and moves on the next exit; if it's still on screen at exit it stays put. Scroll only.

## Look and settings

- Aa panel: mode, text size, theme, 4 quick fonts, plus folded "More text options" / "Word display", and
  "Pages" / "Scrolling". The **Book's font** tile shows only when a book has its own font.
- Fonts include dyslexia-friendly Lexend and OpenDyslexic. Paragraph styles: Indented, Spaced, Spaced and indented.
- **Light** settings (dim, warmth, night theme) are app-wide, so they live in app Settings, not Aa.
- App Settings holds only app-wide items: Style (at the top), Reading (idle limit, what the bottom line shows, reset), Light, Backup and
  restore, Storage, Library, Adding books, Help (first-run tour, tutorial book, version, What’s new), Erase.
- Bottom bars (tab bar and in-book bar) are tall enough and fill the home-indicator area.
- Reader top bar: Back, Contents and Aa. Search and this book’s notes live at the top of the Contents sheet. The bars hide while he reads (on a page turn or scroll) and come back on a tap in the middle of the page. Hiding them does not change the page layout; thin reserved strips at the top and bottom keep the running title and page label off the text.
- The OpenDyslexic title must not overflow the font picker.

## Styles

- Three app-wide **Styles** (built Nov 18) sit on top of the page colours, which are unchanged. Each sets the look, the
  touch feedback and the motion of the app's chrome:
  - **Quiet** (default; existing installs land here): looks exactly like v36 (Bricolage Grotesque 800 headings, 14 px
    spacing, v36 hairlines, corners and shadows; Quiet sets its shape variables to `initial` so every rule falls back to
    v36's value). Sheets, the read-aloud pill, the selection bar and tour cards fade in (about 200 ms, no movement); a
    pressed button dims. Suggests the Paper page colour.
  - **Paper**: warm off-white surfaces with a faint CSS paper grain, soft shadows on cards and sheets. Sheets settle in
    from the bottom (about 320 ms, a slight drag); sliding page turns get a soft edge shadow; pressed buttons sink 1 px
    and lose their shadow. Tag text is a deeper brown (#633813) so it keeps 4.5:1 on its tan chip. Suggests Sepia.
  - **Lively**: big rounded corners (cards about 20 px, pill buttons), a rounded sans-serif interface, black/white/grey
    with one coral accent (#FF5A4E, #FF7A6E on dark pages) for the active or primary thing only. Taps squish and spring
    back; sheets, the pill, the selection bar and tour cards spring in (about 300 ms). Suggests White.
    Coral #FF5A4E is only for fills, rings and icons. Coral text is #D63A2E on light pages only on white cards
    (`--accent-text-card`, 4.5:1 or better); on the grey page and in sheets accent text is ink; #FF7A6E on dark pages.
    Coral controls on the page (scrubber, active speaker and bookmark, the pill's Play fill with a white glyph) use
    #D63A2E on light pages so they keep 3:1 on Paper and Sepia; the word-selection highlight and tour pulse ring are coral too; selected labels (active tab, chips, toggles) are ink with a
    coral icon or ring. On the shelf only Continue is a coral fill; Add to library is an ink outline. The selection bar
    is solid from the first moment of its spring.
- Every Style: the toast, the back-to-place pill, the selection More menu and the update banner enter with the Style's
  pop (opacity only under Reduce Motion). The update banner is the Style's accent (Quiet keeps v36's blue).
- Every Style: a closing sheet is closed at once (focus and taps move on) and only fades out on screen for about
  120 ms. A tour spotlight shows the spotlit control at full colour.
- Picker: Settings → Style, three live preview tiles (Quiet "Calm & still", Paper "Tactile & warm", Lively "Bouncy &
  bright"). A tap applies the Style at once with a short crossfade, plays the Style's motion on the tile and marks it selected.
  When the Style actually changes, it sets the Style's suggested page colour only if the reader is on White, Paper or
  Sepia and night-auto is off; re-tapping the Style already in use changes nothing. On Gray, Dark, Black, the system
  "Auto" colour or with night-auto on, the page colour stays and the Style shows its dark variant on dark pages.
  "Auto" (Match phone) stays Auto but shows the Style's day page by day (STYLES[k].day: Paper → Sepia, Lively and
  Quiet → White, as in v36) and Dark at night; the Phone swatch previews it. The tiles always preview each Style's suggested colour. The tiles are a radio group:
  one tab stop, and Left/Up and Right/Down move to, select and focus the previous/next Style, wrapping. "Reset reading options" keeps the Style.
- Firm rules: a Style never changes the reading text's font, size or layout, the reader bars or the pill's size, so
  switching never repaginates or moves your place. It never changes what a gesture does. The **Page turn** reading
  option (Slide / Fade / None) still decides how pages turn; the Style only sets the slide's timing and shadow. With
  Reduce Motion on, every Style uses short fades only, and a sliding page turn becomes a fade.

## The Guide

- **The Guide** (built Nov 18, prototype; Mick's idea): the Style's accent colour is one persistent living blob that
  always sits where he should look or tap next, and is never absent. One fixed overlay above every view
  (`#guide`, aria-hidden, pointer-events none): purely visual, it never takes a tap, focus or VoiceOver.
  - Library: it rests as the fill of **Continue** on the most recent book (no Continue card: Add to library; other
    tabs: a small mark under the active tab).
  - Tap Continue: the fill gathers into a blob, the reader opens, and it flies (stretching along its path, a tail
    catching up) to its spot, grows into that spot's exact shape and hands off to the real fill. While it flies, the
    buttons it left or is heading for show no fill of their own, so there is only ever one accent blob.
  - Reader: with read aloud open it is the pill's **Play** fill; with the bars showing it is the progress mark on the
    scrubber; while reading (bars hidden) it is a short progress mark in the bottom reserved strip. It never covers
    the text and never moves while he reads (page turns don't move it; the bars hiding or showing only cross-fades it).
  - Back: it flies back to Continue. First-run tour: it moves to each step's target; where a step has several
    (Contents icon and its two rows; the word, a colour and More) it goes to the main one first, splits into at most
    three blobs, and merges back into one before moving on.
  - Motion is per Style, from CSS variables only (`--guide-dur`, `--guide-ease`, `--guide-stretch`,
    `--guide-squish`, `--guide-tail`): Quiet a calm glide with little stretch (about 350 ms); Paper weighted, with drag
    and no overshoot; Lively springy, full stretch and a squish on arrival. Reduce Motion: it fades out at the old
    spot and in at the new one. Taps during a flight work; it retargets mid-flight. Resize and rotation re-snap it.
  - Firm rules: it never repaginates or moves his place, and it is drawn with transform and opacity only.
  - For later screens: `guideTo(targets, {main})` (up to three targets: an element or `{el, kind}`, kind `fill`,
    `mark`, `thumb` or `strip`); `guideScreen()` picks the current screen's targets; `guideTour()` for tour steps.

## Library

- One "Add to library" button. Input: paste text, open files (EPUB and PDF), iPhone share sheet. The file picker
  offers files only, no photo library or camera. Purchased/DRM Apple Books can't be imported, and that's fine.
- Edit title and author; tags instead of categories. Tag suggestions: the book's own subject labels first, then form
  (poetry, sermons, letters…) and topic keywords; "Your other tags" and the Settings tag list start collapsed.
- Sort (Recently read, Title A–Z, Author A–Z) and Filter (status/title/author/tag sections; multi-select; OR within a
  section, AND across; other sections narrow to matches). Search suggests titles/authors/tags. Active filters show as
  colour-coded pills grouped by type, only while a filter is on; tap a pill to remove it, or Clear all when two or more are on. "Continue reading" shows only with no filters. Filters clear when the app
  closes; sort is remembered.
- Starter shelf of public-domain books (Christian classics, literary classics, the Bible), tagged "Christian Classics"
  or "Literary Classics" plus one or two more tags each.
- Finished = reaching 100%. A book at 98%+ that isn't marked finished prompts "Have you finished this book?" on
  returning to the library; after "No", it stays quiet until he reads more. Archiving asks "Did you finish it?"
  unless at 100%.
- Archive keeps chosen progress/bookmarks/highlights/notes, DNF or finished status, optional 1–5 star rating and
  review, finish date. Re-adding an archived book restores its saved data.

## Notes, highlights, bookmarks

- Highlights (four colours) with notes; copy with citation; quote image cards; export per book. Each book has one Notes stream of highlights, bookmarks and looked-up words (one-line moments, in book order, searchable); colour dots and type labels so colour is never the only signal; tap a moment to jump there (paused), swipe or use the remove button to delete it with Undo, or More on a highlight to recolour or edit the note. The Notes tab searches across books and groups the same stream by title. The selection bar shows the four colours and More; Define, Note, Copy and Share are in the More menu, kept off the selected text.
- A short first-run tour (about 40 seconds) shows the shelf, a page turn, notes, Speed and listen; Skip is always available. It moves on by itself about every 6 seconds (paused while the pointer or focus is on the card, off with Reduce Motion, never past the last card); by hand only Next moves it on, so a stray tap on the dimmed page does nothing. It never writes to the library or notes. Replay it from Settings → Help. The tutorial book is still there as a longer guide; leaving it asks whether to keep it in the library or tuck it in Settings.
- Notes stream (book and library): **swipe left to delete** any moment, with Undo. A 44px remove button is also there for keyboard and pointer use.
- A highlight must be able to stop right before a dash (dash-joined words are separate words).

## Reading time and stats

- Idle limit (3/5/10 min, default 5) with partial credit; pages capped at about 2× normal time; touches, highlights,
  lookups and notes count as activity; the clock pauses on app switch/lock/close; "Still reading?" after 10 min
  untouched in auto-scroll/Speed; the last page counts on close.
- Daily reading goal; year-in-books stats with a yearly goal; tap the bottom line to switch what it shows (time left
  in chapter / book, location).

## Backup

- Dated safety-net copies are fine. Backups include reading settings and app settings (restore offers to apply them).

## Read aloud

- The speaker button opens a small floating pill with play/pause and a speed chip, **without playing**, instead of
  replacing the footer. Tap a word to choose where to start, then play; tap a word while playing to jump. Swipe the
  pill to skip a sentence; touch and hold the body of the pill (not Play or the speed chip), or use the Voice
  control, for voice choice and downloads. A second tap on the speaker, or the close button on the pill, puts it
  away. The pill stays when switching between Pages and Scroll, and stays on screen if the reader bars hide. Speed mode has no pill. In
  Pages and Scroll the text clip shrinks so the pill and the “Back to where you were” chip do not cover the last
  lines; your place is kept when the pill opens or closes, including after listening has moved to a later page.
  The first-time hint sits in that reserved strip and does not change the page count. The spoken sentence is softly
  highlighted around the current word (about two dozen words, so a long sentence does not wash the whole page). In
  Scroll, the spoken word stays in the middle of the screen. If the natural voice is not downloaded yet, Tooz starts
  with the iPhone voice and offers the better one without blocking.
- Two voice types: **Natural** (Piper, runs on the phone, each voice downloads once, about 60 MB; default Lessac)
  and **iPhone** (the system voices, de-duplicated). Settings → Storage has "Remove all downloaded voices".
- Goal: the most natural-sounding voice for free, usable by anyone with the link, without leaving the phone on for
  hours. Rejected: Kokoro (too slow on his iPhone, ~2× real time even with WebGPU), Supertonic (too slow),
  Kokoro on Modal (needs a credit card), anything needing a private GitHub setup for other users.
- What it says:
  - Scripture references in full: "Isaiah chapter 26 verse 8"; ranges "Philippians chapter 3 verses 7 through 8";
    book abbreviations expanded (Isa. → Isaiah); never says "colon"; never breaks a reference across sentences.
  - Initialisms letter by letter (NIV, NASB, KJV, NKJV, ESV, LSB, CIA, FBI, NSA…); acronyms said as words (NASA,
    FEMA, PETA…).
  - Footnote markers and footnotes are skipped.
- Pauses: a short pause before "(" and after ")"; en and em dashes pause like a comma; semicolons like a period; an
  ellipsis in any form (..., . . ., …) is one pause; longer pauses before/after headings and between paragraphs.
  Live reading has no added pause between sentences (the clip switch is the pause); he found 350 ms and 180 ms too
  long. Long sentences are split at a comma, semicolon, colon or dash, never mid-phrase. Speed is applied when the
  voice makes the speech (not by speeding up playback). He declined reducing Piper's natural variation.
- **Listen offline** (built Nov 13): download a book's audio with the chosen natural voice (made on the phone while
  Tooz is open; screen kept awake; resumes where it left off). Saved audio plays with the screen locked, with
  lock-screen controls, and highlights words. "Save as audio files" exports one MP3 per chapter through the share
  menu, to play in other apps even with Tooz closed. True "app closed" playback is only possible via those files.
