# views-rb-bench-psalm119

renderer views, device emulator-5580, 5 runs, 2026-11-04T23:25:06.877Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| psalm119 | 1032 / 66 | 3.8 | 29 / 38 | 249 + 4 | 186 + 4 | 10 | 52 | 51 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
