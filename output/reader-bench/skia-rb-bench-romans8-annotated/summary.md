# skia-rb-bench-romans8-annotated

renderer skia, device emulator-5580, 5 runs, 2026-11-04T23:52:32.952Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| romans8-annotated | 1203 / 158 | 23.5 | 57 / 69 | 304 + 4 | 309 + 4 | 9 | 58 | 1666 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
