#!/usr/bin/env node
// SPIKE: WebView baseline on the REAL reader (normal navigation). The DOM probe in
// BibleDOM/spikeBench.ts keeps its events on window.__rbEvents; this reads them over devtools
// (the bench build enables WebView debugging). Opens whatever chapter the app last showed.
//   node scripts/reader-bench/realreader.mjs --serial emulator-5580 --label real-psalm119 [--runs 5]
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { makeAdb, median, readGfx, readMemory, runFlings, sleep } from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const { values: a } = parseArgs({ options: { serial: { type: 'string' }, label: { type: 'string' }, runs: { type: 'string', default: '5' }, pkg: { type: 'string', default: 'com.smontlouis.biblestrong' }, port: { type: 'string', default: '9333' }, 'tap-x': { type: 'string', default: '500' }, 'tap-y': { type: 'string', default: '1100' }, video: { type: 'boolean', default: false } } })
const adb = makeAdb(a.serial); const runs = Number(a.runs)
const out = resolve(here, '../../output/reader-bench', a.label); mkdirSync(out, { recursive: true })
const log = m => console.log(`[real-reader] ${m}`)

const forward = () => {
  const p = /webview_devtools_remote_\d+/.exec(adb.shell('cat /proc/net/unix'))?.[0]
  if (!p) return false
  adb.run(['forward', `tcp:${a.port}`, `localabstract:${p}`]); return true
}
const evalPage = async expr => {
  const list = await (await fetch(`http://localhost:${a.port}/json`)).json()
  const ws = new WebSocket(list[0].webSocketDebuggerUrl)
  await new Promise(r => (ws.onopen = r))
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }))
  return await new Promise(res => { ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) { ws.close(); res(d.result?.result?.value) } } })
}
const pageEvents = async () => { if (!forward()) return []; return JSON.parse((await evalPage('JSON.stringify(window.__rbEvents||[])')) ?? '[]') }
const t0Of = out => Number(/T0=(\d+)/.exec(out)?.[1])
const coldStart = async () => {
  adb.shell(`am force-stop ${a.pkg}`); await sleep(1500)
  const t0 = t0Of(adb.shell(`t0=$(date +%s%3N); echo T0=$t0; am start -W -n ${a.pkg}/.MainActivity >/dev/null 2>&1`))
  await sleep(9000)
  return t0
}

const res = { label: a.label, serial: a.serial, runs }
const first = [], dom = []
for (let i = 0; i < runs; i += 1) {
  const t0 = await coldStart()
  const ev = await pageEvents()
  const f = ev.find(e => e.type === 'firstTextPainted'), d = ev.find(e => e.type === 'domTextPresent')
  first.push(f ? f.t - t0 : null); dom.push(d ? d.t - t0 : null)
  log(`cold ${i}: firstTextPainted ${first.at(-1)} ms, domTextPresent ${dom.at(-1)} ms`)
  if (i === runs - 1) writeFileSync(join(out, 'cold-last.png'), adb.screencap())
}
res.firstTextCold = { values: first, median: median(first.filter(v => v !== null)) }
res.domTextPresentCold = { values: dom, median: median(dom.filter(v => v !== null)) }

// Session: a cold start for everything else
await coldStart(); await sleep(3000)
res.memoryAfterLoad = readMemory(adb, a.pkg)
writeFileSync(join(out, 'top.png'), adb.screencap())
adb.shell(`dumpsys gfxinfo ${a.pkg} reset`)
if (a.video) { adb.shell('rm -f /sdcard/rb-real.mp4; (screenrecord --time-limit 18 /sdcard/rb-real.mp4 >/dev/null 2>&1 &)'); await sleep(800) }
const flings = []
for (let i = 0; i < 10; i += 1) flings.push(i < 5 ? 'input swipe 540 1900 540 500 160' : 'input swipe 540 500 540 1900 160')
await runFlings(adb, flings)
await sleep(800)
res.scroll = readGfx(adb, a.pkg)
res.memoryAfterScroll = readMemory(adb, a.pkg)
writeFileSync(join(out, 'scrolled.png'), adb.screencap())
if (a.video) { await sleep(6000); writeFileSync(join(out, 'scroll.mp4'), adb.run(['exec-out', 'cat', '/sdcard/rb-real.mp4'], { binary: true })) }
// taps last: a tap selects a verse and opens the annotate sheet, which would block scrolling
const taps = []
for (let i = 0; i < (process.env.RB_TAPS ? runs : 0); i += 1) { // off by default: wordTap never fires in the real reader (NOT MEASURED)
  const before = (await pageEvents()).filter(e => e.type === 'wordTap').length
  const t = Number(/T=(\d+)/.exec(adb.shell(`t=$(date +%s%3N); input tap ${a['tap-x']} ${a['tap-y']}; echo T=$t`))?.[1])
  await sleep(1200)
  const taplist = (await pageEvents()).filter(e => e.type === 'wordTap')
  const hit = taplist.length > before ? taplist.at(-1) : null
  taps.push(hit ? hit.t - t : null); adb.shell('input keyevent KEYCODE_BACK'); await sleep(900) // BACK clears the verse selection so the next run starts clean
}
res.tapLatency = { values: taps, median: median(taps.filter(v => v !== null)) }

writeFileSync(join(out, 'results.json'), JSON.stringify(res, null, 2))
log(`first text ${res.firstTextCold.median}, dom ${res.domTextPresentCold.median}, tap ${res.tapLatency.median}, jank ${res.scroll.jankPercent?.toFixed(1)}% p99 ${res.scroll.p99}`)
