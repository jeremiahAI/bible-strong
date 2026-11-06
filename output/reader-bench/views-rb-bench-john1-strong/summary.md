# views-rb-bench-john1-strong

renderer views, device emulator-5580, 5 runs, 2026-11-04T23:26:26.008Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| john1-strong | 1045 / 60 | 3.1 | 24 / 44 | 235 + 4 | 224 + 4 | 8 | 49 | 51 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
