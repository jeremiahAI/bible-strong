# Old WebView white screen: before vs after (Android 10, WebView 91, emulator-5586)

Fix: commit 61420df29 (skip `@layer rnw` when `CSSLayerBlockRule` is undefined). before.apk = master, after.apk = fix. Same scenarios, same order, same screenshot names in before/ and after/.

| # | Scenario | Screenshots | BEFORE | AFTER | AFTER2 |
|---|----------|-------------|--------|-------|---|
| 1 | First open + CDP probe + exceptions | 00-launch, 01-genesis1, probe.json, exceptions.json | FAIL: header above blank white page, #root empty, 3 exceptions (insertRule `@layer rnw {}`) | PASS: Genesis 1 renders | PASS: Genesis 1 renders (01-genesis1; fresh install, pm clear, onboarding skipped first, 00-launch) |
| 2 | Next chapter, picker | 02-next-chapter, 02b-picker-open, 02c-john1-picker | FAIL: white | PASS | PASS (02-next-chapter, 02b-picker-open, 02c-john1-picker, 02d-john1) |
| 3 | Scroll | 03-scroll | FAIL: white | PASS | PASS (03-scroll) |
| 4 | Verse tap, highlight | 04-select-verse | FAIL: white | FAIL: tap throws (`Array.prototype.at` missing on Chromium 91), no selection, no highlight; highlight colours NOT VERIFIED | PASS: tap selects verse and action sheet shows (04-select-verse); end handle dragged to extend to v15 (04b-handle-drag); yellow word highlight applied and visible (04c, 04d); red verse highlight on v14 visible (04e) and removed (04f, identical to 04d). No exception. The yellow free highlight was left in place |
| 5 | Strong's | 05-strongs, 05b-strong-mode | FAIL: white | PASS | PASS (05b-strong-mode, 05-strongs sheet for G2316) |
| 6 | Hebrew / Greek interlinear | 06-greek-interlinear, 06-hebrew-interlinear | FAIL: white | PASS (Hebrew RTL ok) | PASS (06-greek-interlinear, 06-hebrew-interlinear) |
| 7 | Parallel | 07-parallel | FAIL: white | PASS (KJV + KJV, only installed version) | PASS (07-parallel: interlinear left, KJV right) |
| 8 | Dark theme, larger font | 08-settings, 08-dark-largefont | FAIL: white | PASS (Night, 130%; settings sheet covers part of page) | PASS (08-settings, 08-dark-largefont: Night, 130%, sheet covers part of page) |
| 9 | French version | 09-french-lsg | FAIL: white | PASS (LSG, bundled) | PASS (09-french-lsg, still Night 130%) |
| 10 | Other WebView / DOM screens | 10a-lexicon-entry, 10b-home, 10f-timeline (both); before only: 10c-studies, 10d-youtube-webview, 10e-studies-list; after only: 10d-video-sheet-over-reader | Native screens fine. YouTube WebView and Studies list seen | Native screens fine. Studies editor, Note editor, Biblical map, HTMLContentDOM: NOT VERIFIED (not reached) | Note editor PASS (10g-note-editor, typed, saved; note chip shows in reader). Biblical map PASS (10h-biblical-map, place entity 10h-biblical-map-place). Studies editor NOT VERIFIED: creating a study asks to sign in (10i-studies-editor shows empty-state; I may not sign in). HTMLContentDOM NOT VERIFIED: Android uses native engine, playground is dev-only (10j-playground redirected to reader) |

## Issues still present in the after pass
1. Verse tap fails (04-select-verse). Cause: `.at(-1)` in `apps/expo/src/features/bible/BibleDOM/verseSelectionBlocks.ts:46`, called from `BibleDOMComponent.tsx:884`. `Array.prototype.at` is Chromium 92+. About 36 other `.at(` uses exist in apps/expo/src (not audited one by one).
2. Exceptions after fix (exceptions.json): `SyntaxError: Invalid or unexpected token` x2 (injectedObjectJson; blurHash `${9c` inside a template literal, also present before the fix) and `TypeError: Cannot read property 'style' of null` from an injected script (`<anonymous>:8:26`).
3. Tailwind v4 `@layer`: no `@layer` found in the DOM page style tags, so no confirmed dropped styles. Versus the reference image (reader-bench real-john1-webview/cold-last.png) shadows and corner radii look slightly different; tentative, not confirmed.

## Notes
- after/logcat-crashes.txt: 0 app crashes. The 5 FATAL EXCEPTION lines in the after pass (10:32:29, 10:40:14, 10:41:35, 10:41:52, 10:42:00) are NPEs in the `uiautomator dump` helper process (AccessibilityNodeInfoDumper), not com.smontlouis.biblestrong.
- screenrecord fails on this emulator (err=-38); flow.mp4 is built from a screencap loop (~6 fps). before 13 KB, after 562 KB.
- Not verified: highlight colours (blocked by issue 1), Studies/Note editor/Biblical map/HTMLContentDOM on the fixed build, other Bible versions (only KJV/LSG available).

## AFTER2 (after2.apk, Array.prototype.at polyfill) - folder after2/
- Same device, `install -r -d`, `pm clear` first (so onboarding and the "What's up" sheet appear once; 00-launch).
- Scenario 4 now passes in full (verse tap, selection, action sheet, handle drag, highlight, remove). The earlier verse-tap failure is fixed.
- exceptions.json (captured live over the whole run, every WebView target): 6 x SyntaxError (injected object JSON, blurHash `${9c` in a template literal, pre-existing, also thrown before the fix) and 1 x `Cannot read property 'style' of null` (anonymous native-injected script at reader re-init, also in the first after pass, origin not located). Nothing from `Array.prototype.at`, `crypto.randomUUID`, `structuredClone` or `Object.hasOwn`; in the page on Chromium 91 `[].at` is a function (polyfilled), the other three are undefined but nothing called them in the flows run.
- logcat-crashes.txt: 0 app crashes.
- flow.mp4 (2.4 min, 1.2 MB): scroll, verse tap, handle drag, highlight, remove, Strong's. Screencap loop at about 3 fps; it does not include the first open.
- Still not verified: Studies editor (needs sign-in), HTMLContentDOM (unreachable in a release build on Android), Site page WebView and YouTube WebView (not reached in this pass).
