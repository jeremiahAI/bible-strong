# Reader renderer comparison: WebView vs Kotlin Views vs RN Skia (Android spike)

Generated 2026-11-05 by the spike session. Branch `spike/reader-bench` (merged `spike/reader-poc-views` and `spike/reader-poc-skia`).
All paths below are relative to `output/reader-bench/` in `/Users/Jeremiah/Code/bible-strong-wt/reader-bench` (git-ignored).

## Read this first

- **Device**: AVD `rb-bench` = `emulator-5580`, Android 16, arm64, `-gpu swiftshader_indirect`, headless. **GPU numbers are not representative**: swiftshader is a CPU rasteriser, so every frame time (jank, p50..p99) is inflated in a way a real phone's GPU would not show. Use them to rank renderers on the same emulator, not as phone numbers.
- **WebView**: com.google.android.webview 156.0.8078.47.
- **Build**: one release APK, `EXPO_PUBLIC_READER_BENCH=1`, arm64-v8a only. Views and Skia were measured on the first build (`app-release-bench.apk`, 106,899,652 bytes). The WebView baseline was measured on a later build of the same tree with extra `// SPIKE` probe code in the DOM (`app-release-bench-webview-probe.apk`). The native renderer code is identical in both builds; only the DOM probe differs.
- **Host load** (1-min load average, `uptime`): the machine was shared with other sessions (load peaked above 100 earlier, one of my emulator runs died when the host was saturated and I restarted it). Timed passes were gated to start below 12 and sampled every 15-20 s. The first Views/Skia pass had several fixtures above 12 during the run (max 13-85), so those were **re-run** on a quiet host; **every number in the tables below comes from a run whose sampled load stayed at or below 11.5** (most 3-8). Load windows are listed in "Load" below. The discarded first pass is kept under `aborted-ungated/` and the first-pass `views-rb-bench-*`/`skia-rb-bench-*` dirs.
- **Runs**: 5 per cell (cold/warm/tap/highlight/scroll-to-verse). Scroll smoothness and PSS are **one pass of 10 flings per fixture** (spread across fixtures is the only spread available). Spread is shown as (min-max).
- **Same gesture**: 5 `input swipe 540 1900 540 500 160` down then 5 back, 0.8 s apart, for all three renderers.

## 1. First text (cold and warm)

Cold = `am force-stop`, then `am start` and the first-text event minus the device clock at launch (full app boot included). Warm = app running, deep link again with a new run id (remounts the reader).
Views/Skia: the native renderers' own `firstTextPainted` events (first frame with text drawn). WebView real reader: the DOM probe `firstTextPainted` in `BibleDOM/spikeBench.ts` (DOM text laid out, block ancestors fully opaque, two animation frames later), read from `window.__rbEvents` over WebView devtools. `domTextPresent` is the earlier moment the DOM first has text (~0.3-0.4 s before the probe fires).

#### First text, cold start (ms): median (min-max, n)

| fixture | views | skia |
|---|---|---|
| psalm119 | 935 (901-962, n=5) | 1330 (1147-1460, n=5) |
| john1-strong | 940 (923-1007, n=5) | 1221 (1136-1386, n=5) |
| genesis1-bhg-interlinear | 1070 (986-1280, n=5) | 1324 (1204-1384, n=5) |
| john1-parallel | 977 (914-1173, n=5) | 1449 (1430-1738, n=5) |
| romans8-annotated | 984 (907-1003, n=5) | 1203 (1076-1761, n=5) |


**WebView real reader, cold (ms), median (min-max, n=5)**

| chapter | firstTextPainted | domTextPresent |
|---|---|---|
| Psalms 119 (KJV) | 3036 (2900-3163) | 2672 (2541-2782) |
| John 1 (KJV) | 2984 (2552-3208) | 2711 (2376-3108) |

Not like for like, in three ways: (1) the WebView rows are the real reader opened from the restored tab (app boot, store hydration, header, tabs, devotional image cards, annotations), the other two are a thin bench route; (2) the text differs: the real reader shows KJV with headings (ALEPH/BETH) and images, the psalm119 fixture is French, john1-strong is KJV with Strong numbers (screens in `verify2/`, `real-psalm119-webview/cold-last.png`, `real-john1-webview/cold-last.png`); (3) the probes have slightly different definitions of "painted". Screenshots show text on screen in every WebView run set (`cold-last.png` of each).

**Warm**

#### First text, warm (ms): median (min-max, n)

| fixture | views | skia |
|---|---|---|
| psalm119 | 59 (53-72, n=5) | 168 (148-267, n=5) |
| john1-strong | 52 (44-66, n=5) | 149 (99-178, n=5) |
| genesis1-bhg-interlinear | 55 (44-73, n=5) | 182 (125-217, n=5) |
| john1-parallel | 56 (50-103, n=5) | 306 (99-340, n=5) |
| romans8-annotated | 55 (48-122, n=5) | 158 (134-197, n=5) |


WebView real reader warm: **NOT MEASURED** (the real reader does not remount on re-launch, so the probe does not fire again; the remount path exists only through the bench route, which renders blank).

## 2. Scroll smoothness (gfxinfo, same 10-fling gesture)

#### Scroll-to-verse (ms)

| fixture | views | skia |
|---|---|---|
| psalm119 | 50 (49-58, n=5) | 564 (547-583, n=5) |
| john1-strong | 49 (47-53, n=5) | 716 (715-748, n=5) |
| genesis1-bhg-interlinear | 49 (48-64, n=5) | 316 (298-466, n=5) |
| john1-parallel | 50 (49-52, n=5) | 673 (398-699, n=5) |
| romans8-annotated | 50 (49-55, n=5) | 1666 (1633-1700, n=5) |


**WebView real reader** (same gesture, `dumpsys gfxinfo` of the app process, `reset` before the flings):

| chapter | jank % | p50 / p90 / p95 / p99 ms | frames | evidence |
|---|---|---|---|---|
| Psalms 119 (KJV) | 88.8% | 57 / 97 / 105 / 121 | 278 | `real-psalm119-webview/results.json`, `scroll.mp4` |
| John 1 (KJV) | 99.4% | 81 / 150 / 150 / 150 | 167 | `real-john1-webview/results.json`, `scroll.mp4` |

The WebView video shows the chapter scrolling (frames checked, `v.png`). The WebView is far worse than both native renderers on this emulator, but swiftshader makes WebView compositing especially expensive, so the gap is likely overstated for a real GPU. Frame counts differ (WebView renders fewer, longer frames), so jank % is not directly comparable to the native rows.

## 3. Memory (PSS from `dumpsys meminfo`, MB)

App process after load / after scroll. For WebView the separate sandboxed renderer process is included. The shared idle `webview_zygote` (4.5-5.4 MB) is present in every run and is **not** counted for any row.

#### PSS, MB, app process (after load / after scroll)

| fixture | views | skia |
|---|---|---|
| psalm119 | 290 / 290 | 298 / 310 |
| john1-strong | 274 / 280 | 303 / 308 |
| genesis1-bhg-interlinear | 254 / 258 | 324 / 343 |
| john1-parallel | 260 / 204 | 289 / 279 |
| romans8-annotated | 265 / 270 | 304 / 309 |

**WebView real reader**

| chapter | app after load / scroll | sandboxed WebView process after load / scroll | total app + sandboxed |
|---|---|---|---|
| Psalms 119 | 351 / 351 | 130 / 137 | 481 / 488 |
| John 1 | 345 / 317 | 130 / 126 | 475 / 443 |

The real-reader app process also carries the full app UI (tabs, header, more screens), whereas the bench route carries less; so the app-process part is not a renderer-only figure. The renderer-attributable difference is best seen in the sandboxed process (about 126-137 MB that the native renderers do not have) and in Views vs Skia on the same route.

## 4. Interaction

#### Tap latency (ms, includes `input tap` start-up)

| fixture | views | skia |
|---|---|---|
| psalm119 | 10 (9-11, n=5) | 10 (8-12, n=5) |
| john1-strong | 8 (8-9, n=5) | 9 (7-10, n=5) |
| genesis1-bhg-interlinear | 11 (10-13, n=5) | 10 (9-10, n=5) |
| john1-parallel | 8 (8-18, n=5) | 9 (9-13, n=5) |
| romans8-annotated | 9 (7-9, n=5) | 9 (8-10, n=5) |

#### Highlight repaint (ms)

| fixture | views | skia |
|---|---|---|
| psalm119 | 53 (50-83, n=5) | 66 (49-115, n=5) |
| john1-strong | 50 (48-52, n=5) | 41 (32-65, n=5) |
| genesis1-bhg-interlinear | n/a | n/a |
| john1-parallel | n/a | n/a |
| romans8-annotated | 50 (49-68, n=5) | 58 (48-115, n=5) |

#### Scroll-to-verse (ms)

| fixture | views | skia |
|---|---|---|
| psalm119 | 50 (49-58, n=5) | 564 (547-583, n=5) |
| john1-strong | 49 (47-53, n=5) | 716 (715-748, n=5) |
| genesis1-bhg-interlinear | 49 (48-64, n=5) | 316 (298-466, n=5) |
| john1-parallel | 50 (49-52, n=5) | 673 (398-699, n=5) |
| romans8-annotated | 50 (49-55, n=5) | 1666 (1633-1700, n=5) |


Tap latency includes the start-up of `input tap` (constant for all renderers). Highlight command works only on paragraph blocks, so the interlinear and parallel fixtures have no highlight measurement (n/a for both). Scroll-to-verse semantics may differ between prototypes (Views ~50 ms vs Skia 300-1700 ms; whether Skia animates and Views jumps was NOT VERIFIED).
WebView real reader: tap latency, highlight repaint, scroll-to-verse **NOT MEASURED** (see list at the end).

## 5. APK size

Method: `unzip -lv` of the first clean release APK (`app-release-bench.apk`, listing in `apk-listing.txt`), plus compiled-class sizes of the Views module from its Gradle build dir. **No build without the two renderers was made** (a baseline build is ~14 min; not done), so the numbers below are component sizes, not a measured A/B.

| item | bytes | note |
|---|---|---|
| whole APK (arm64-v8a, release) | 106,899,652 on disk (129,530,517 uncompressed) | includes both prototypes |
| Skia: `lib/arm64-v8a/librnskia.so` | 14,310,176 | stored uncompressed in the APK (0% deflate), so the APK grows by about this much; the only Skia native lib found |
| Skia: JS | ~49 KB TS source for `skia/` + `views/` combined | Hermes bytecode size NOT MEASURED; added dep `@shopify/react-native-skia` 2.14.0 |
| Views: Kotlin module `bible-reader-views` | 186,345 (46 `.class` files, pre-dex/R8) | jar 195,551; final dex contribution not separable in `classes*.dex` (R8-merged), so the real figure is likely lower; NOT MEASURED exactly |
| WebView renderer | 0 added | it is the existing system WebView + DOM bundle |

Caution: `app-release-bench-webview-probe.apk` is larger (110.4 MB on disk) only because incremental rebuilds left stale `assets/www.bundle/.../entry-*.js` files in it; do not use it for sizes.

## 6. Screenshot comparison (`scripts/reader-bench/diff-screens.mjs`)

Fair pair: **Views vs Skia**, same document, same device, same harness screens (`cmp/views` vs `cmp/skia`, results in `cmp/diff/diff.json` and `diff-*.png`; pixelmatch threshold 0.1, 1080x2400).

| screen | mismatch % |
|---|---|
| psalm119 top / scrolled | 9.73 / 13.17 |
| john1-strong top / scrolled | 9.29 / 10.87 |
| genesis1-bhg-interlinear top / scrolled | 7.23 / 7.90 |
| john1-parallel top / scrolled | 9.65 / 9.90 |
| romans8-annotated top / scrolled | 30.13 / 8.19 |

The 30% on romans8 top is a layout shift: Skia draws the chapter title in a larger font so everything below it moves (visible in `verify2/m-views.png` vs `verify2/m-skia.png`). Differences elsewhere are line-break and font-metric differences (Skia places Strong numbers smaller and lower, Views superscripts them), not missing text.

**Not comparable (diff not run)**: WebView vs Views/Skia. The WebView bench route is blank (known, not debugged), so there is no WebView screenshot of the same fixture; the real-reader screenshots have different chrome (header, tab bar, audio buttons), text (KJV vs the French fixture), headings, images and font, so a pixel diff would measure the app, not the renderer.

## 7. Romans 8 highlight gap check (report only)

The fixture does **not** exclude verse number 2. `fixtures/romans8-annotated.render.json`, block `p0`: verse-1 highlight is `[0, 82)`, verse-2 highlight is `[83, 184)`. Offset 82 is the single space run between "...Jesus-Christ." and the number; offset 83 is the verseNumber run "2" (83-84). So the number is inside the second range and the only uncovered character is the space before it.
Rendered: both prototypes show a white gap at that space, then amber starting at the number's left edge and continuing through "En effet..." Pixel row sampling at the line (`verify2/r8-views.png`, `r8-skia.png`) gives the same pattern for both: amber, white gap, amber. The only visible difference is cosmetic: in Skia there is a small notch between the "2" and "En" boxes, which looks like separate rounded rects per run (inferred from the pixels, code not read); Views shows one box from the number onwards. So Skia behaves the same on the same input; the "stops before 2 and restarts after it" look is the uncovered space plus Skia's rounded per-run boxes. No fix made.

## 8. Load (host 1-min load average)

| batch | before | max during (sampler) | evidence |
|---|---|---|---|
| Views psalm119 + john1-parallel (re-run) | 7.2 | 8.2 | `load-views-rerun.log` |
| Views john1-strong + romans8 (re-run) | 5.5 | 6.4 | `load-views-rerun2.log` |
| Views genesis (first pass) | 10.2 | 11.5 | `load-views-rb-bench.log` |
| Skia john1-parallel (re-run) | 3.3 | 6.7 | `load-skia-rerun.log` |
| Skia psalm119 / john1-strong / genesis (re-run) | 5.5 | 8.0 | `load-skia-rerun2.log` |
| Skia romans8 (first pass) | 7.9 | 10.5 | `load-skia-rb-bench.log` |
| WebView Psalms 119 | 3.9 | 6.0 | `load-real-psalm119.txt`, `load-sampler-real.log` |
| WebView John 1 | 3.4 | 7.1 | `load-real-john1.txt`, `load-sampler-real.log` |

Discarded (above 12 during the run): Views first pass psalm119 (max 18.4), john1-strong (15.6), john1-parallel (58.5), romans8 (13.4); Skia first pass psalm119 (13.2), john1-strong (12.5), genesis (14.6), john1-parallel (85.2). `loadwin.mjs` computes these windows from `load-sampler.log`.

## 9. NOT MEASURED / NOT VERIFIED

- WebView on the bench fixtures (route blank, not debugged): no like-for-like WebView numbers on the five fixtures. The WebView figures are the real reader on KJV Psalms 119 / John 1 and are not equal input.
- WebView real reader: warm first-text, tap latency (the probe's `wordTap` did not fire in the real reader; cause not found), highlight repaint, scroll-to-verse.
- John 1 is the long-ish chapter case only; Genesis 1 / interlinear / parallel have no WebView counterpart.
- A baseline APK without the two prototypes (exact APK delta); Hermes bytecode size of the Skia/Views JS; Views dex size.
- GPU cost on a real device: measured later on the Tecno KL7, see "Real device" at the end (the tables above are swiftshader).
- Whether Views jumps and Skia animates in scroll-to-verse.
- Battery/thermal, memory beyond PSS after one scroll pass, RTL, accessibility, selection handles, text selection menu, OTA behaviour.
- Single scroll pass per fixture, so no spread for jank/PSS within a fixture.
- Android 10 / WebView 91: re-captured later, see the "Android 10" section at the end.

## 10. Evidence index

- Views results: `views-rerun-psalm119/`, `views-rerun-john1-parallel/`, `views-rerun2-john1-strong/`, `views-rerun2-romans8-annotated/`, `views-rb-bench-genesis1-bhg-interlinear/` (each `results.json`, `summary.md`, `screens/`, `psalm119-scroll.mp4`).
- Skia results: `skia-rerun2-psalm119/`, `skia-rerun2-john1-strong/`, `skia-rerun2-genesis1-bhg-interlinear/`, `skia-rerun-john1-parallel/`, `skia-rb-bench-romans8-annotated/`.
- WebView real reader: `real-psalm119-webview/`, `real-john1-webview/` (results.json, cold-last.png, top.png, scroll.mp4).
- Verification screenshots (each native renderer x 5 fixtures): `verify2/*.png`, montages `verify2/m-views.png`, `verify2/m-skia.png`.
- Screenshot diff: `cmp/diff/`. APK listing: `apk-listing.txt`. Build logs: `build-release.log` (first, 13 m 32 s), `build-release2..6.log` (incremental probe builds).
- Tables regenerated by `tables.mjs`. Console logging in release builds is stripped by Babel, which is why the real-reader probe reads `window.__rbEvents` over devtools instead of logcat (`scripts/reader-bench/realreader.mjs`, `cdp.mjs`).


---

# Real device: Tecno KL7 (Job 1, 2026-11-05)

Device: TECNO KL7 (Spark 30 Pro), Android 14, 1080x2436, density 480, WebView 156, physical GPU, driven over Wi-Fi adb (`100.92.219.76:5555`, Tailscale). Same release APK as the WebView baseline (`app-release-bench-webview-probe.apk`, all three renderers in one build). Nothing else changed on the phone (no settings touched, other apps left alone); screen timeout is 10 min and the screen was woken before each batch.

## Read this first (limits, honest)

- **WebView = real reader, native = bench fixtures.** The WebView rows are the full app opened from the restored tab on **KJV** Psalms 119 / John 1 (header, tab bar, audio buttons, devotional image cards, annotations). Views and Skia render the thin bench route with the five fixtures (French Psalm 119, John 1 with Strong numbers, interlinear, parallel, annotated Romans 8). Text, chrome and work differ; cold start includes the whole app for WebView. Do not read the WebView-vs-native gap as a pure renderer gap. WebView on the bench fixtures is still NOT MEASURED (bench route blank on WebView 156, see section 9).
- **Same gesture** as on the emulator (`input swipe 540 1900 540 500 160`, five down then five back) and the tap coordinates were left at the defaults: the phone is 1080 wide like the emulator, only the height differs (2436 vs 2400), so no coordinate changes were needed.
- **Highlight repaint and scroll-to-verse: NOT MEASURED on this phone.** The bench screen's HL / GO / TOP buttons sit at the bottom edge, under the phone's 3-button navigation bar (see `tecno-montage-top.png`). Taps there hit Back/Home and left the app (a first Views attempt, `run-views-tecno-attempt1-navbar-bug.log`, showed the flings running on the launcher, and was discarded). Fixing it needs an inset-aware bench layout, i.e. a new build, which was out of scope. Harness flag `--no-buttons` skips those two metrics.
- **Tap latency** is not comparable to the emulator: the phone is driven over Wi-Fi adb, so `input tap` start-up is ~32-35 ms vs ~10 ms on the emulator. Views and Skia look equal here (32 vs 34); it is an adb floor, not a renderer number. The real reader's probe `wordTap` never fires (same as on the emulator), so WebView tap latency is NOT MEASURED. Some cells are n/a because the default tap point (300,1100) landed on no word in that fixture.
- **Runs**: first text cold/warm, tap: 5 runs per cell, shown as median (min-max, n). Scroll jank/percentiles and PSS are **one pass of 10 flings per fixture** (no per-fixture spread). `dumpsys gfxinfo` frame counts differ widely (WebView 408-620 frames vs ~700-1200 native in the same gesture) because slow frames take longer; compare percentiles, not counts.
- **Skia psalm119 scroll anomaly**: the first Skia pass recorded only 63 frames for psalm119 (11.1% jank, p99 85 ms) while the screen recording was running. A re-run of psalm119 alone without `--video` (`skia-tecno-psalm119-rerun/`) gave 1238 frames, 0.2% jank, p50/p90/p95/p99 = 5/6/12/18 ms, PSS 516 / 616 MB, cold 3700 (3629-3720), warm 157 (145-183), tap 35 (34-47). The table keeps the first-pass row as recorded; **I believe the re-run is the representative one**, but the cause of the 63 frames (video recorder interaction or a lost-link hiccup) is unproven.
- **Cold start looks flat at ~3.0 s for Views** (2990-3187 across all fixtures): that is the app boot floor on this phone (Hermes, stores, Expo) plus the first frame, not the renderer; the Views-vs-Skia delta (0.6-1.1 s) is the renderer part.
- **Wi-Fi adb dropped repeatedly** (device `offline` mid-run, mostly during flings). Harness changes (committed): `lib.mjs` retries a call after `adb connect` when the link is offline, flings now run as one detached device-side script with a done-marker poll (`runFlings`), `run.mjs --no-buttons`, and `tecno-batch.sh` (batch wrapper that logs load and battery). Runs that hit a drop and were re-done are kept as `run-*-attempt1-*.log`; every number below is from a completed run with no null values except the stated n/a cells.


**First text, cold (ms): median (min-max, n)**

| fixture | views | skia |
|---|---|---|
| psalm119 | 3081 (2999-3187, n=5) | 3641 (3612-3794, n=5) |
| john1-strong | 3081 (2996-3102, n=5) | 3681 (3667-3699, n=5) |
| genesis1-bhg-interlinear | 3007 (2990-3109, n=5) | 4065 (4020-4130, n=5) |
| john1-parallel | 3037 (2992-3068, n=5) | 3716 (3675-3790, n=5) |
| romans8-annotated | 3048 (3012-3067, n=5) | 3616 (3586-3694, n=5) |

**First text, warm (ms)**

| fixture | views | skia |
|---|---|---|
| psalm119 | 167 (149-514, n=5) | 172 (154-253, n=5) |
| john1-strong | 142 (129-217, n=5) | 153 (140-195, n=5) |
| genesis1-bhg-interlinear | 106 (90-121, n=5) | 193 (181-224, n=5) |
| john1-parallel | 156 (130-483, n=5) | 213 (149-283, n=5) |
| romans8-annotated | 134 (108-490, n=5) | 171 (161-230, n=5) |

**Scroll, same 10 flings: jank % / p50 / p90 / p95 / p99 ms / frames**

| fixture | views | skia |
|---|---|---|
| psalm119 | 0.2% / 6 / 13 / 14 / 16 / 998 | 11.1% / 11 / 28 / 36 / 85 / 63 |
| john1-strong | 0.3% / 6 / 9 / 10 / 13 / 1181 | 0.8% / 5 / 12 / 14 / 24 / 1057 |
| genesis1-bhg-interlinear | 0.1% / 5 / 5 / 9 / 10 / 1091 | 1.0% / 5 / 12 / 14 / 22 / 1139 |
| john1-parallel | 0.0% / 5 / 5 / 6 / 10 / 1211 | 1.6% / 6 / 14 / 18 / 24 / 1214 |
| romans8-annotated | 0.1% / 5 / 6 / 8 / 11 / 729 | 1.9% / 6 / 17 / 23 / 32 / 689 |

**PSS MB app process after load / after scroll (+ webview procs)**

| fixture | views | skia |
|---|---|---|
| psalm119 | 338 / 346 (+3) | 515 / 616 (+3) |
| john1-strong | 336 / 348 (+3) | 542 / 686 (+3) |
| genesis1-bhg-interlinear | 334 / 342 (+3) | 586 / 740 (+3) |
| john1-parallel | 336 / 339 (+3) | 524 / 685 (+3) |
| romans8-annotated | 336 / 346 (+3) | 578 / 657 (+3) |

**Tap latency (ms, includes adb `input tap` start-up over Wi-Fi)**

| fixture | views | skia |
|---|---|---|
| psalm119 | n/a | 35 (34-48, n=5) |
| john1-strong | n/a | 33 (33-49, n=5) |
| genesis1-bhg-interlinear | 32 (31-41, n=5) | 34 (34-47, n=5) |
| john1-parallel | 32 (32-43, n=5) | 35 (34-46, n=5) |
| romans8-annotated | 32 (32-41, n=5) | n/a |

**WebView real reader (KJV, with chrome and images), cold start from the restored tab**

| chapter | firstTextPainted cold | domTextPresent cold | jank % / p50 / p90 / p95 / p99 / frames | app PSS load / scroll | sandboxed WebView PSS load / scroll |
|---|---|---|---|---|---|
| Psalms 119 | 7986 (7878-9489, n=5) | 7481 (7365-9075, n=5) | 28.1% / 36 / 42 / 46 / 48 / 620 | 466 / 504 | 167 / 185 |
| John 1 | 7616 (7373-7830, n=5) | 7236 (7127-7419, n=5) | 61.8% / 65 / 73 / 77 / 81 / 408 | 456 / 497 | 162 / 163 |


Pairs worth reading: cold first text, Views ~3.0 s, Skia ~3.6-4.1 s, WebView real reader ~7.6-8.0 s (dom text present ~7.2-7.5 s). On the emulator the same measures were 0.9-1.1 s / 1.2-1.4 s / 3.0 s: the phone is slower across the board, and Skia's gap to Views is about the same (0.6-1.1 s vs 0.3-0.5 s). Scroll on a real GPU: Views 0.0-0.3% jank (p99 10-16 ms), Skia 0.8-1.9% (p99 22-32 ms; psalm119 re-run 0.2%), real WebView 28% (Psalms 119) and 62% (John 1), p50 36 / 65 ms. So the emulator's order holds, but WebView on a real GPU is less catastrophic than swiftshader's 89-99% and still clearly janky on this phone (with images and chrome in the page, not like for like). Memory: Views ~340 MB; Skia 515-740 MB and growing after scroll (+100-150 MB); WebView app ~470-500 MB plus ~165-185 MB in the sandboxed renderer (about 630-690 MB total).

Screens: text is on screen for every renderer and fixture, by screenshot: `tecno-montage-top.png` (Views x5, then Skia x5, the same order as the fixtures), `real-psalm119-tecno/cold-last.png`, `top.png`, `scrolled.png`, `real-john1-tecno/*.png` (John 1 KJV header, first verses, image cards). Videos: `real-psalm119-tecno/scroll.mp4`, `real-john1-tecno/scroll.mp4`, `views-tecno/psalm119-scroll.mp4`, `skia-tecno/psalm119-scroll.mp4`.

## Load, battery and temperature per batch

Host 1-min load stayed low (2-6) for every batch (the Mac was quiet, though the system load later rose to ~15 after Job 1). Temperature is `dumpsys battery` in tenths of a degree C; it never passed 40 C (max 37.9 C), so no rest was needed. Source: `tecno-batches.log`.

| batch | start load1 | start | end | battery start to end |
|---|---|---|---|---|
| real Psalms 119 (final run) | 3.4 | 36.4 C, 90% | 37.6 C, 90% | 90 to 90 |
| real John 1 | 3.3 | 37.4 C, 89% | 37.9 C, 89% | 89 to 89 |
| Views, 5 fixtures | 5.5 | 35.2 C, 86% | 36.2 C, 85% | 86 to 85 |
| Skia, 5 fixtures | 3.9 | 36.2 C, 85% | 37.4 C, 84% | 85 to 84 |
| Skia psalm119 re-run | 2.2 | 37.4 C, 84% | 37.4 C, 83% | 84 to 83 |

Battery fell 92 to 83% over about 70 minutes with the screen on (charging state not checked); thermal throttling is unlikely to have skewed later runs (temperature rose only about 2 C), but CPU frequency was not read.

## Tecno evidence index

`views-tecno/`, `skia-tecno/`, `skia-tecno-psalm119-rerun/`, `real-psalm119-tecno/`, `real-john1-tecno/` (results.json, summary.md, screens, mp4), `tecno-tables.md` (regenerated tables), `tecno-montage-top.png`, `tecno-batches.log`, `run-*-tecno*.log` (including the discarded attempts).

---

# Android 10 / WebView 91 white screen, re-captured (Job 2)

AVD `rb-api29` (Android 10, `emulator-5586`, swiftshader, headless), WebView 91.0.4472.114, same APK. Evidence in `android10/`.

- `before.png`: the real Bible screen with header (Genesis 1, KJV, tabs) and an empty white body, after force-stop and launcher relaunch.
- `probe-before.json` (devtools over `adb forward tcp:9286 localabstract:webview_devtools_remote_<pid>`): `typeof CSSLayerBlockRule` = `"undefined"`, `#root` children 0, text length 0.
- **The `@layer` error is not in logcat** in this release build (no chromium console lines at all; `logcat-full.txt` has no matching line). It is only visible over CDP: `exceptions-noshim.json`, entry 3: `DOMException: Failed to execute 'insertRule' on 'CSSStyleSheet': Failed to parse the rule '@layer rnw {}'`, stack `n` -> `createSheet` -> (module init) -> `reportFatalError`, in `entry-2b64c75573683c6a6f7d7f9a65135563.js:460:368`.
- Shim (`android10/shim.mjs`, modes `probe` / `noshim` / `shim`): `Page.addScriptToEvaluateOnNewDocument` wraps `CSSStyleSheet.prototype.insertRule` and rewrites any rule starting `@layer rnw` to `@media all {}`; `Page.reload`; after 40 s: **shim hits 1, `#root` children 2, text length 4139** (`exceptions-shim.json`). `after.png` shows Genesis 1 text with the verse images and the full chrome.
- **Other errors (all three occur without the shim as well):** reload without the shim (`exceptions-noshim.json`) throws: `TypeError: Cannot read property 'style' of null` (anonymous script 7:25), `SyntaxError: Invalid or unexpected token` (reported as `<html>:2:8144`) twice, and the `@layer` DOMException. With the shim: the same TypeError and the same two SyntaxErrors, and no DOMException.
  - **TypeError**: from react-native-webview's injected before-content-loaded script (`document.documentElement.style.backgroundColor='transparent';document.body.style...`, `debug-shim.json`, script line 8). It runs before `<body>` exists, so `document.body` is null. Harmless, independent of the shim.
  - **SyntaxError**: not in the HTML (it has 89 lines); it is the injected `window.ReactNativeWebView.injectedObjectJson` script (`failed-injected-script.js`). A blurHash string in the injected props, `"LFEoiH004p~V00~WtRM_9h-n${9c"`, contains `${`, and the object is embedded in a JS template literal, so the script fails to parse. This is **not WebView 91 specific** (any engine rejects it); it only costs the injected initial-object (props still arrive through the `$$dom_event` path). A separate pre-existing app bug, not part of the white screen.
- **Which module is used**: the entry bundle in the APK matches uniwind's `createOrderedCSSStyleSheet` source (`apps/expo/node_modules/uniwind/dist/common/components/web/createOrderedCSSStyleSheet.js`) function for function: `typeof CSSLayerBlockRule` check, `insertRule("@layer rnw {}", 0)`, the `fakeSheet` that skips index 0, `getTextContent` returning ``@layer rnw { ... }`` (minified in `entry-ed943c...:516277`, name erased). Uniwind's Metro resolver (`uniwind/dist/metro/index.cjs`, lines 160-161) redirects any `react-native-web/.../createOrderedCSSStyleSheet` import to `uniwind/components/createOrderedCSSStyleSheet`, and does it for the DOM (web) bundles too: all five `entry-*.js` that the five dom HTML files reference contain the `@layer rnw {}` rule, and the Bible DOM page's entry (`65c23a...html` -> `entry-2b64c755...js`) has six `uniwind` string hits. I did not trace the import graph with a tool; this is from the resolver code plus the byte-level match. Installed uniwind: **1.12.2** (patched with `.yarn/patches/uniwind-npm-1.12.2-145fff90e1.patch`, which only touches `src/components/index.ts`, not this file).
- Emulator shut down after capture (`emu kill`); forward removed.

Patch decision stays with the user (a guard or the shim as a `injectedJavaScriptBeforeContentLoaded` change would restore Android 10 / WebView <99).

## NOT MEASURED (Tecno and Android 10 additions)

- Highlight repaint and scroll-to-verse on the Tecno (bench buttons under the nav bar; needs an inset-aware bench layout).
- WebView on the five bench fixtures, and WebView warm first-text and tap latency (unchanged gaps).
- Tap latency free of Wi-Fi adb overhead (the 32-35 ms is the adb floor); the same default tap point hit no word in psalm119/john1-strong for Views and in romans8 for Skia.
- Scroll spread within a fixture (one pass each), CPU frequency / throttling state, GPU time (`gpu percentile` rows were not read), refresh rate of the panel, power draw.
- Skia psalm119 first-pass 63-frame anomaly cause (re-run is clean, see above).
- A Tecno run of the real reader with a different WebView version, or an Android 10 run of Views/Skia (they do not use the DOM bundle, so the `@layer` issue is not expected, but it was not run).
- The harness never recorded WebView-process memory for the real reader separately from the `webview_zygote`.

## Review notes (main session, 2026-11-05)

Spot-checked against raw `results.json`: Tecno cold, warm, jank, p99, frames and PSS for all three renderers match the tables. Checked by eye: `tecno-montage-top.png`, `android10/before.png`, `android10/after.png`, `real-john1-tecno/cold-last.png`.

- **Another difference between the WebView and native runs on the Tecno:** the real reader ran in the phone's dark theme, while the native fixtures ran light. The effect on the numbers is unknown. This adds to the existing limits: real KJV chapters with chrome and images against bench fixtures.
- **Memory comparison on the Tecno, MB, after scroll:** Views 339-348 (app only). Skia 616-740 (app only). WebView 497-504 app + 163-185 sandboxed = 660-689. Skia has no chrome or images in this route and still reaches the WebView's total.
- **OTA behaviour was not tested for either prototype.** Neither was run against a newer JS bundle on an older binary.
