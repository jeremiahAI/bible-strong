# views-rb-bench-romans8-annotated

renderer views, device emulator-5580, 5 runs, 2026-11-04T23:34:09.965Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| romans8-annotated | 1232 / 51 | 4.4 | 23 / 27 | 254 + 4 | 257 + 4 | 7 | 51 | 50 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
