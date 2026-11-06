# skia-rb-bench-psalm119

renderer skia, device emulator-5580, 5 runs, 2026-11-04T23:35:31.656Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| psalm119 | 1368 / 205 | 64.7 | 81 / 150 | 315 + 4 | 273 + 4 | 8 | 91 | 552 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
