# skia-rb-bench-john1-parallel

renderer skia, device emulator-5580, 5 runs, 2026-11-04T23:43:45.946Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| john1-parallel | 1439 / 452 | 15.9 | 46 / 69 | 296 + 4 | 286 + 4 | 8 | n/a | 433 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
