# before.apk vs after2.apk on WebView 156 (TECNO KL7, Android 14) - PARTIAL

Stopped when `df` free space fell to 4.97 GiB (brief: stop under 5 GB). before.apk: all scenarios except 10 done. after2.apk: scenarios 1-6 (Greek) only; the script was also started with a bug (see Deviations), so treat the after run as incomplete.

| Scenario | before | after | pair diff % (below status bar) |
|---|---|---|---|
| 01 Genesis 1 + probe | ok | ok | 0.00 |
| 02 next, 02b John 1 | ok | ok | 0.00 / 0.00 |
| 03 scroll | ok | ok | 15.70 (different scroll position, fling not settled; not a render difference) |
| 04 select | ok | ok | 0.00 |
| 04b handle | ok | ok | 0.00 |
| 04c highlight | ok | ok | 9.08 (NOT explained by eye; after 04c not viewed) |
| 04d removed | ok | ok | 0.00 |
| 05 Strong's | ok | ok | 0.00 |
| 06 Greek | ok | ok | 0.00 |
| 06 Hebrew, 07, 08, 09 | ok (before only) | NOT RUN | - |
| 10 note, map | NOT RUN | NOT RUN | - |

Probe: identical field by field (before vs after): Chrome/156.0.8078.47, CSSLayerBlockRule = function, #root children 2, innerText 4162, Array.prototype.at native, stylesheet 0 holds one CSSLayerBlockRule named `rnw` (43 rules); sheets 1-3: 0 layers (2, 44, 2 rules); verse span computed 16px / normal / rgb(200,200,200) / sans-serif (selector grabbed a wrapper span, same for both); body background rgb(18,45,66).
Exceptions: both builds 2 x `SyntaxError: Invalid or unexpected token` (line 2, col 8314 before / 8287 after) at page load. Nothing else.
Crash check: 0 bytes of crash buffer, 0 FATAL lines, both builds (after counted over the partial run).
