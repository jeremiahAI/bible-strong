# Reader PoC handoff (2026-11-04, after a Mac restart)

Goal: compare WebView (today), Kotlin Views + StaticLayout, and RN Skia on Android, with evidence.
User rules: Android first, parity before shipping, evidence before and after, OTA freedom is a hard
requirement, no push or PR without approval, commits carry no attribution, never commit
`.yarn/install-state.gz`, no `git add -A`. /tmp is wiped on restart, so keep evidence here.

## Branches (worktrees in ~/Code/bible-strong-wt/)
- `spike/reader-bench` at 3aaaa8d02: fixtures, harness, bench route.
- `spike/reader-poc-views` at a2dff47b8: verified on emulator, debug only.
- `spike/reader-poc-skia` at d175cfe8a: verified on emulator, debug only.

## Findings
- White screen cause, proven on Android 10 / WebView 91: `insertRule('@layer rnw {}')` throws because
  Chromium < 99 has no `@layer`, so React never mounts. Source is
  `uniwind/.../components/web/createOrderedCSSStyleSheet` (found by grep; not yet checked against
  what the DOM bundle resolves). A shim rewriting that one rule to `@media all {}` rendered Genesis 1.
  Other errors logged in that run are unexplained. Patch awaits the user's go-ahead.
- Bench route is blank on WebView 156 although the DOM has text; the real reader renders fine there.
  Six fix attempts failed, including publishing through SharedBibleDOM. Baseline therefore measures
  the real reader. `firstTextPainted` proves DOM paint only, so pair it with screenshots.
- Fixture font is `Avenir`, the app default, so sans text in prototype screenshots is expected.
- Timed runs need host load below about 12 and one emulator. Earlier load reached 106.

## Next
1. Merge both PoCs into bench, one release APK, run all renderers on rb-bench, write comparison.
2. Re-capture the Android 10 reproduction here: the screenshots in /tmp were lost.
3. User decides on the `@layer` patch and later on the renderer.

## Update 2026-11-05
Steps 1 and 2 above are done. Comparison: COMPARISON.md (emulator, Tecno KL7, Android 10, review notes). `spike/reader-bench` is at 7eac06c3b, unpushed. App left installed on the Tecno; rb-api29 shut down. S25 not connected.
Waiting on the user: renderer choice (recommended Views), `@layer` patch go-ahead (recommended yes), maintainer's reported Android/WebView versions.
After a choice: brainstorm/spec, with OTA contract test and parity matrix first. Known separate bug: blurHash with `${` breaks injectedObject.
