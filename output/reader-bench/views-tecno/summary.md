# views-tecno

renderer views, device 100.92.219.76:5555, 5 runs, 2026-11-05T01:36:30.309Z

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| psalm119 | 3081 / 167 | 0.2 | 13 / 16 | 338 + 3 | 346 + 3 | n/a | n/a | n/a |
| john1-strong | 3081 / 142 | 0.3 | 9 / 13 | 336 + 3 | 348 + 3 | n/a | n/a | n/a |
| genesis1-bhg-interlinear | 3007 / 106 | 0.1 | 5 / 10 | 334 + 3 | 342 + 3 | 32 | n/a | n/a |
| john1-parallel | 3037 / 156 | 0.0 | 5 / 10 | 336 + 3 | 339 + 3 | 32 | n/a | n/a |
| romans8-annotated | 3048 / 134 | 0.1 | 6 / 11 | 336 + 3 | 346 + 3 | 32 | n/a | n/a |

Times are medians. Tap latency includes the constant start-up of `input tap`.
