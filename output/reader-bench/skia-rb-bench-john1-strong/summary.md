# skia-rb-bench-john1-strong

renderer skia, device emulator-5580, 5 runs, 2026-11-04T23:37:02.947Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| john1-strong | 1290 / 160 | 16.1 | 53 / 81 | 293 + 4 | 297 + 4 | 8 | 32 | 717 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
