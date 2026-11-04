# reader-bench

Throwaway adb harness for the Android reader renderer spike (WebView `BibleDOM` vs Kotlin Views vs
React Native Skia). It drives the `/reader-bench` route of a release build and reads the
`READER_BENCH {json}` lines the bench screen writes to logcat (tag `ReactNativeJS`).

## Build the app

```bash
cd apps/expo
set -a; . ./.env.development; set +a
export EXPO_PUBLIC_READER_BENCH=1     # lets the route open in a release build
npx expo prebuild -p android --no-install
cd android && ./gradlew assembleRelease --max-workers=2 -PreactNativeArchitectures=arm64-v8a
adb -s <serial> install -r app/build/outputs/apk/release/app-release.apk
```

The first launch of a fresh install shows onboarding and the changelog; dismiss them once by hand
(or `adb shell pm clear` is NOT wanted between runs, it brings them back).

## Run

```bash
node scripts/reader-bench/run.mjs --serial emulator-5580 --renderer webview --fixture all \
  --runs 5 --label baseline-rb-bench --apk apps/expo/android/app/build/outputs/apk/release/app-release.apk --video
```

Options: `--serial` (required), `--renderer webview|views|skia`, `--fixture all|<id>[,<id>]`,
`--runs` (default 5), `--label`, `--pkg` (default `com.smontlouis.biblestrong`), `--apk` (for the
size), `--video` (records the Psalm 119 scroll), `--tap-x/--tap-y` (the tap position, default
300,1100).

Output goes to `output/reader-bench/<label>/` (git-ignored): `results.json`, `summary.md`,
`screens/<renderer>/<fixture>-{top,scrolled}.png`, optional `psalm119-scroll.mp4`.

## What is measured

| metric | how |
|---|---|
| first text, cold | `force-stop`, then one shell reads `date +%s%3N` and runs `am start -W -d biblestrong://reader-bench?...`; `firstTextPainted.t - t0` |
| first text, warm | same, app left running, deep link again with a new `run` (remounts the reader) |
| scroll smoothness | `dumpsys gfxinfo <pkg> reset`, 10 `input swipe` flings (5 down, 5 back), then the gfxinfo summary: frames, janky %, p50/p90/p95/p99 |
| memory | `dumpsys meminfo` "Total PSS by process": the app process and, separately, WebView processes (`webview`, `sandboxed_process`, `privileged_process`), after load and after scrolling |
| tap latency | `t=$(date +%s%3N); input tap X Y` in one shell; `wordTap.t - t`. The start-up of the `input` tool is included and equal for every renderer |
| highlight repaint | tap `bench-highlight`; `decorationsPainted.t - command.issuedAt` |
| scroll-to-verse | tap `bench-scroll` (after `bench-scroll-top`); `scrolledToVerse.t - command.issuedAt` |
| screenshots | `exec-out screencap -p`, at top and after scroll-to-verse |
| APK size | byte size of `--apk` |

All `t` values are `Date.now()` / `System.currentTimeMillis()` on the device, the clock `date` reads.

## Compare screenshots

```bash
node scripts/reader-bench/diff-screens.mjs output/reader-bench/baseline-rb-bench/screens/webview \
  output/reader-bench/<label>/screens/views output/reader-bench/<label>/diff-views
```

Writes `diff-<name>.png` per shot and `diff.json` with the mismatch percentage (pixelmatch).
