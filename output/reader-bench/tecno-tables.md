
#### First text, cold (ms): median (min-max, n)

| fixture | views | skia |
|---|---|---|
| psalm119 | 3081 (2999-3187, n=5) | 3641 (3612-3794, n=5) |
| john1-strong | 3081 (2996-3102, n=5) | 3681 (3667-3699, n=5) |
| genesis1-bhg-interlinear | 3007 (2990-3109, n=5) | 4065 (4020-4130, n=5) |
| john1-parallel | 3037 (2992-3068, n=5) | 3716 (3675-3790, n=5) |
| romans8-annotated | 3048 (3012-3067, n=5) | 3616 (3586-3694, n=5) |

#### First text, warm (ms)

| fixture | views | skia |
|---|---|---|
| psalm119 | 167 (149-514, n=5) | 172 (154-253, n=5) |
| john1-strong | 142 (129-217, n=5) | 153 (140-195, n=5) |
| genesis1-bhg-interlinear | 106 (90-121, n=5) | 193 (181-224, n=5) |
| john1-parallel | 156 (130-483, n=5) | 213 (149-283, n=5) |
| romans8-annotated | 134 (108-490, n=5) | 171 (161-230, n=5) |

#### Scroll, same 10 flings: jank % / p50 / p90 / p95 / p99 ms / frames

| fixture | views | skia |
|---|---|---|
| psalm119 | 0.2% / 6 / 13 / 14 / 16 / 998 | 11.1% / 11 / 28 / 36 / 85 / 63 |
| john1-strong | 0.3% / 6 / 9 / 10 / 13 / 1181 | 0.8% / 5 / 12 / 14 / 24 / 1057 |
| genesis1-bhg-interlinear | 0.1% / 5 / 5 / 9 / 10 / 1091 | 1.0% / 5 / 12 / 14 / 22 / 1139 |
| john1-parallel | 0.0% / 5 / 5 / 6 / 10 / 1211 | 1.6% / 6 / 14 / 18 / 24 / 1214 |
| romans8-annotated | 0.1% / 5 / 6 / 8 / 11 / 729 | 1.9% / 6 / 17 / 23 / 32 / 689 |

#### PSS MB app process after load / after scroll (+ webview procs)

| fixture | views | skia |
|---|---|---|
| psalm119 | 338 / 346 (+3) | 515 / 616 (+3) |
| john1-strong | 336 / 348 (+3) | 542 / 686 (+3) |
| genesis1-bhg-interlinear | 334 / 342 (+3) | 586 / 740 (+3) |
| john1-parallel | 336 / 339 (+3) | 524 / 685 (+3) |
| romans8-annotated | 336 / 346 (+3) | 578 / 657 (+3) |

#### Tap latency (ms, includes adb `input tap` start-up over Wi-Fi)

| fixture | views | skia |
|---|---|---|
| psalm119 | n/a | 35 (34-48, n=5) |
| john1-strong | n/a | 33 (33-49, n=5) |
| genesis1-bhg-interlinear | 32 (31-41, n=5) | 34 (34-47, n=5) |
| john1-parallel | 32 (32-43, n=5) | 35 (34-46, n=5) |
| romans8-annotated | 32 (32-41, n=5) | n/a |

#### WebView real reader

| chapter | firstTextPainted cold | domTextPresent cold | jank % / p50 / p90 / p95 / p99 / frames | app PSS load / scroll | sandboxed WebView PSS load / scroll |
|---|---|---|---|---|---|
| Psalms 119 | 7986 (7878-9489, n=5) | 7481 (7365-9075, n=5) | 28.1% / 36 / 42 / 46 / 48 / 620 | 466 / 504 | 167 / 185 |
<!-- raw [7915,7878,9489,8636,7986] -->
| John 1 | 7616 (7373-7830, n=5) | 7236 (7127-7419, n=5) | 61.8% / 65 / 73 / 77 / 81 / 408 | 456 / 497 | 162 / 163 |
<!-- raw [7830,7373,7524,7616,7620] -->
