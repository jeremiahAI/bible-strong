# skia-tecno

renderer skia, device 100.92.219.76:5555, 5 runs, 2026-11-05T01:44:57.534Z

| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |
|---|---|---|---|---|---|---|---|---|
| psalm119 | 3641 / 172 | 11.1 | 28 / 85 | 515 + 3 | 616 + 3 | 35 | n/a | n/a |
| john1-strong | 3681 / 153 | 0.8 | 12 / 24 | 542 + 3 | 686 + 3 | 33 | n/a | n/a |
| genesis1-bhg-interlinear | 4065 / 193 | 1.0 | 12 / 22 | 586 + 3 | 740 + 3 | 34 | n/a | n/a |
| john1-parallel | 3716 / 213 | 1.6 | 14 / 24 | 524 + 3 | 685 + 3 | 35 | n/a | n/a |
| romans8-annotated | 3616 / 171 | 1.9 | 17 / 32 | 578 + 3 | 657 + 3 | n/a | n/a | n/a |

Times are medians. Tap latency includes the constant start-up of `input tap`.
