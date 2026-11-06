# views-rerun-john1-parallel

renderer views, device emulator-5580, 5 runs, 2026-11-04T23:57:03.080Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| john1-parallel | 977 / 56 | 1.4 | 17 / 19 | 260 + 4 | 204 + 4 | 8 | n/a | 50 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
