### First text, cold start (ms): median (min-max, n)

| fixture | views | skia |
|---|---|---|
| psalm119 | 935 (901-962, n=5) | 1330 (1147-1460, n=5) |
| john1-strong | 940 (923-1007, n=5) | 1221 (1136-1386, n=5) |
| genesis1-bhg-interlinear | 1070 (986-1280, n=5) | 1324 (1204-1384, n=5) |
| john1-parallel | 977 (914-1173, n=5) | 1449 (1430-1738, n=5) |
| romans8-annotated | 984 (907-1003, n=5) | 1203 (1076-1761, n=5) |

### First text, warm (ms): median (min-max, n)

| fixture | views | skia |
|---|---|---|
| psalm119 | 59 (53-72, n=5) | 168 (148-267, n=5) |
| john1-strong | 52 (44-66, n=5) | 149 (99-178, n=5) |
| genesis1-bhg-interlinear | 55 (44-73, n=5) | 182 (125-217, n=5) |
| john1-parallel | 56 (50-103, n=5) | 306 (99-340, n=5) |
| romans8-annotated | 55 (48-122, n=5) | 158 (134-197, n=5) |

### Tap latency (ms, includes `input tap` start-up)

| fixture | views | skia |
|---|---|---|
| psalm119 | 10 (9-11, n=5) | 10 (8-12, n=5) |
| john1-strong | 8 (8-9, n=5) | 9 (7-10, n=5) |
| genesis1-bhg-interlinear | 11 (10-13, n=5) | 10 (9-10, n=5) |
| john1-parallel | 8 (8-18, n=5) | 9 (9-13, n=5) |
| romans8-annotated | 9 (7-9, n=5) | 9 (8-10, n=5) |

### Highlight repaint (ms)

| fixture | views | skia |
|---|---|---|
| psalm119 | 53 (50-83, n=5) | 66 (49-115, n=5) |
| john1-strong | 50 (48-52, n=5) | 41 (32-65, n=5) |
| genesis1-bhg-interlinear | n/a | n/a |
| john1-parallel | n/a | n/a |
| romans8-annotated | 50 (49-68, n=5) | 58 (48-115, n=5) |

### Scroll-to-verse (ms)

| fixture | views | skia |
|---|---|---|
| psalm119 | 50 (49-58, n=5) | 564 (547-583, n=5) |
| john1-strong | 49 (47-53, n=5) | 716 (715-748, n=5) |
| genesis1-bhg-interlinear | 49 (48-64, n=5) | 316 (298-466, n=5) |
| john1-parallel | 50 (49-52, n=5) | 673 (398-699, n=5) |
| romans8-annotated | 50 (49-55, n=5) | 1666 (1633-1700, n=5) |

### Scroll, 10 flings: jank % / p50/p90/p95/p99 ms (gfxinfo, 1 pass; frame count in brackets)

| fixture | views | skia |
|---|---|---|
| psalm119 | 1.9% / 17/20/23/29 (583 fr) | 2.9% / 26/29/36/53 (613 fr) |
| john1-strong | 2.6% / 17/17/17/19 (386 fr) | 12.3% / 26/48/53/61 (504 fr) |
| genesis1-bhg-interlinear | 2.6% / 17/27/31/57 (575 fr) | 8.0% / 17/32/42/65 (572 fr) |
| john1-parallel | 1.4% / 16/17/18/19 (578 fr) | 15.7% / 17/36/48/81 (498 fr) |
| romans8-annotated | 4.9% / 17/17/18/19 (225 fr) | 23.5% / 28/57/61/69 (446 fr) |

### PSS, MB, app process (after load / after scroll)

| fixture | views | skia |
|---|---|---|
| psalm119 | 290 / 290 | 298 / 310 |
| john1-strong | 274 / 280 | 303 / 308 |
| genesis1-bhg-interlinear | 254 / 258 | 324 / 343 |
| john1-parallel | 260 / 204 | 289 / 279 |
| romans8-annotated | 265 / 270 | 304 / 309 |
