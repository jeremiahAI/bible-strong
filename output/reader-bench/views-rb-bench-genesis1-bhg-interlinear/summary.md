# views-rb-bench-genesis1-bhg-interlinear

renderer views, device emulator-5580, 5 runs, 2026-11-04T23:29:13.520Z, APK 101.9 MB

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| genesis1-bhg-interlinear | 1070 / 55 | 2.6 | 27 / 57 | 254 + 4 | 258 + 4 | 11 | n/a | 49 |

Times are medians. Tap latency includes the constant start-up of `input tap`.
