# skia-rerun-john1-parallel

renderer skia, device emulator-5580, 5 runs, 2026-11-04T23:59:53.529Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| john1-parallel | 1449 / 306 | 15.7 | 36 / 81 | 289 + 4 | 279 + 4 | 9 | n/a | 673 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
