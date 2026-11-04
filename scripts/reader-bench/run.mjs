#!/usr/bin/env node
// SPIKE: adb measurement harness for the reader renderer benchmark. See README.md.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import {
  events,
  findEvent,
  findViewCenter,
  makeAdb,
  median,
  parseBenchLines,
  readGfx,
  readMemory,
  sizeOf,
  sleep,
  waitFor,
} from './lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ALL_FIXTURES = [
  'psalm119',
  'john1-strong',
  'genesis1-bhg-interlinear',
  'john1-parallel',
  'romans8-annotated',
]

const { values: args } = parseArgs({
  options: {
    serial: { type: 'string' },
    renderer: { type: 'string', default: 'webview' },
    fixture: { type: 'string', default: 'all' },
    runs: { type: 'string', default: '5' },
    label: { type: 'string' },
    pkg: { type: 'string', default: 'com.smontlouis.biblestrong' },
    scheme: { type: 'string', default: 'biblestrong' },
    apk: { type: 'string' },
    out: { type: 'string', default: resolve(here, '../../output/reader-bench') },
    'tap-x': { type: 'string', default: '300' },
    'tap-y': { type: 'string', default: '1100' },
    video: { type: 'boolean', default: false },
  },
})

const adb = makeAdb(args.serial)
const runs = Number(args.runs)
const renderer = args.renderer
const label = args.label ?? `${renderer}-${args.serial}`
const outDir = join(args.out, label)
mkdirSync(join(outDir, 'screens', renderer), { recursive: true })
const fixtures = args.fixture === 'all' ? ALL_FIXTURES : args.fixture.split(',')
const tap = { x: Number(args['tap-x']), y: Number(args['tap-y']) }
const log = message => console.log(`[reader-bench] ${message}`)

const url = (fixture, run) =>
  `${args.scheme}://reader-bench?renderer=${renderer}&fixture=${fixture}&run=${run}`

// One shell: read the device clock, then start the deep link, so t0 and the app share a clock.
const launch = (fixture, run) => {
  const out = adb.shell(
    `t0=$(date +%s%3N); echo T0=$t0; am start -W -a android.intent.action.VIEW -d '${url(fixture, run)}' ${args.pkg} 2>&1`
  )
  const t0 = Number(/T0=(\d+)/.exec(out)?.[1])
  const totalTime = Number(/TotalTime:\s*(\d+)/.exec(out)?.[1])
  return { t0, amTotalTimeMs: Number.isFinite(totalTime) ? totalTime : null }
}

const timeToFirstText = async (fixture, run, { cold }) => {
  if (cold) {
    adb.shell(`am force-stop ${args.pkg}`)
    await sleep(1500)
  }
  adb.logcatClear()
  const { t0, amTotalTimeMs } = launch(fixture, run)
  const found = await waitFor(adb, records => findEvent(records, 'firstTextPainted', t0), {
    timeoutMs: 90000,
  })
  return { ms: found ? found.t - t0 : null, amTotalTimeMs }
}

const issueAndWait = async (testID, type, center, extra = {}) => {
  adb.logcatClear()
  adb.shell(`input tap ${center.x} ${center.y}`)
  const record = await waitFor(
    adb,
    records => {
      const command = records.find(r => r.command)?.command
      const event = command && events(records).find(e => e.type === type && e.t >= command.issuedAt)
      return event ? { command, event } : undefined
    },
    { timeoutMs: 20000, ...extra }
  )
  return record ? record.event.t - record.command.issuedAt : null
}

const stats = values => ({ values, median: median(values) })
const metrics = {}

for (const fixture of fixtures) {
  log(`${renderer} / ${fixture}`)
  const result = { fixture, notes: [] }
  metrics[fixture] = result

  // Time to first text: cold (process killed) then warm (app running, deep link again)
  const cold = []
  for (let i = 0; i < runs; i += 1)
    cold.push((await timeToFirstText(fixture, `cold${i}`, { cold: true })).ms)
  result.firstTextCold = stats(cold)
  const warm = []
  for (let i = 0; i < runs; i += 1)
    warm.push((await timeToFirstText(fixture, `warm${i}`, { cold: false })).ms)
  result.firstTextWarm = stats(warm)
  log(`  first text cold ${result.firstTextCold.median} ms, warm ${result.firstTextWarm.median} ms`)

  // A fresh cold start for everything else, so scrolling and taps hit a just-loaded chapter
  const session = await timeToFirstText(fixture, 'session', { cold: true })
  result.sessionFirstTextMs = session.ms
  await sleep(4000)
  result.memoryAfterLoad = readMemory(adb, args.pkg)
  const png = name => join(outDir, 'screens', renderer, `${fixture}-${name}.png`)
  writeFileSync(png('top'), adb.screencap())

  const buttons = {
    highlight: findViewCenter(adb, 'bench-highlight'),
    scroll: findViewCenter(adb, 'bench-scroll'),
    scrollTop: findViewCenter(adb, 'bench-scroll-top'),
  }
  result.buttons = buttons

  // Tap latency: device clock read in the shell that injects the tap (input-tool start-up is
  // included, and is the same for every renderer)
  const taps = []
  for (let i = 0; i < runs; i += 1) {
    adb.logcatClear()
    const out = adb.shell(`t=$(date +%s%3N); input tap ${tap.x} ${tap.y}; echo T=$t`)
    const t = Number(/T=(\d+)/.exec(out)?.[1])
    const hit = await waitFor(adb, records => findEvent(records, 'wordTap', t), { timeoutMs: 5000 })
    taps.push(hit ? hit.t - t : null)
    if (hit && i === 0) result.tappedWord = { verseKey: hit.verseKey, wordIndex: hit.wordIndex }
    await sleep(600)
  }
  result.tapLatency = stats(taps)

  // Highlight repaint
  if (buttons.highlight) {
    const highlight = []
    for (let i = 0; i < runs; i += 1) {
      highlight.push(await issueAndWait('bench-highlight', 'decorationsPainted', buttons.highlight))
      await sleep(500)
    }
    result.highlightRepaint = stats(highlight)
  } else result.notes.push('bench-highlight button not found')
  if (renderer === 'webview' && ['genesis1-bhg-interlinear', 'john1-parallel'].includes(fixture)) {
    result.notes.push(
      'highlight command targets paragraph blocks; this fixture has none, so no repaint measured'
    )
  }

  // Scroll smoothness: 10 flings, five down then five back
  adb.shell(`dumpsys gfxinfo ${args.pkg} reset`)
  let videoStarted = false
  if (args.video && fixture === 'psalm119') {
    adb.shell(
      `rm -f /sdcard/rb-scroll.mp4; (screenrecord --time-limit 18 /sdcard/rb-scroll.mp4 >/dev/null 2>&1 &)`
    )
    videoStarted = true
    await sleep(800)
  }
  const flings = []
  for (let i = 0; i < 10; i += 1) {
    flings.push(i < 5 ? 'input swipe 540 1900 540 500 160' : 'input swipe 540 500 540 1900 160')
  }
  adb.shell(flings.map(command => `${command}; sleep 0.8`).join('; '), { timeout: 120000 })
  await sleep(800)
  result.scroll = readGfx(adb, args.pkg)
  result.memoryAfterScroll = readMemory(adb, args.pkg)
  if (videoStarted) {
    await sleep(6000)
    writeFileSync(
      join(outDir, `${fixture}-scroll.mp4`),
      adb.run(['exec-out', 'cat', '/sdcard/rb-scroll.mp4'], { binary: true })
    )
  }
  log(
    `  jank ${result.scroll.jankPercent?.toFixed(1)}% p90 ${result.scroll.p90} p99 ${result.scroll.p99}`
  )

  // Scroll to a far verse and back
  if (buttons.scroll) {
    const toVerse = []
    for (let i = 0; i < runs; i += 1) {
      if (buttons.scrollTop) {
        adb.shell(`input tap ${buttons.scrollTop.x} ${buttons.scrollTop.y}`)
        await sleep(1500)
      }
      toVerse.push(await issueAndWait('bench-scroll', 'scrolledToVerse', buttons.scroll))
      await sleep(800)
    }
    result.scrollToVerse = stats(toVerse)
    writeFileSync(png('scrolled'), adb.screencap())
  } else result.notes.push('bench-scroll button not found')
  adb.shell(`am force-stop ${args.pkg}`)
}

const apkBytes = args.apk ? sizeOf(args.apk) : null
const report = {
  label,
  renderer,
  serial: args.serial,
  runs,
  apkBytes,
  date: new Date().toISOString(),
  metrics,
}
writeFileSync(join(outDir, 'results.json'), JSON.stringify(report, null, 2))

const f = (value, digits = 0) =>
  value === null || value === undefined ? 'n/a' : value.toFixed(digits)
const mb = kb => (kb === null || kb === undefined ? 'n/a' : (kb / 1024).toFixed(0))
const rows = Object.values(metrics).map(
  m =>
    `| ${m.fixture} | ${f(m.firstTextCold.median)} / ${f(m.firstTextWarm.median)} | ${f(m.scroll?.jankPercent, 1)} | ${m.scroll?.p90 ?? 'n/a'} / ${m.scroll?.p99 ?? 'n/a'} | ${mb(m.memoryAfterLoad?.appPssKb)} + ${mb(m.memoryAfterLoad?.webviewPssKb)} | ${mb(m.memoryAfterScroll?.appPssKb)} + ${mb(m.memoryAfterScroll?.webviewPssKb)} | ${f(m.tapLatency.median)} | ${f(m.highlightRepaint?.median)} | ${f(m.scrollToVerse?.median)} |`
)
writeFileSync(
  join(outDir, 'summary.md'),
  [
    `# ${label}`,
    '',
    `renderer ${renderer}, device ${args.serial}, ${runs} runs, ${report.date}${apkBytes ? `, APK ${(apkBytes / 1048576).toFixed(1)} MB` : ''}`,
    '',
    '| fixture | first text cold / warm (ms) | jank % | p90 / p99 frame (ms) | PSS app + webview after load (MB) | PSS app + webview after scroll (MB) | tap latency (ms) | highlight repaint (ms) | scroll-to-verse (ms) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    'Times are medians. Tap latency includes the constant start-up of `input tap`.',
    '',
  ].join('\n')
)
log(`wrote ${outDir}`)
