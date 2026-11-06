# views-rb-bench-john1-parallel

renderer views, device emulator-5580, 5 runs, 2026-11-04T23:32:00.893Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| john1-parallel | 982 / 59 | 2.4 | 28 / 44 | 258 + 4 | 259 + 4 | 10 | n/a | 49 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
