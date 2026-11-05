// SPIKE: shared helpers for the reader renderer benchmark harness.
import { execFileSync, spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const ADB =
  process.env.ADB ??
  join(process.env.ANDROID_HOME ?? join(homedir(), 'Library/Android/sdk'), 'platform-tools/adb')

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export const makeAdb = serial => {
  if (!serial) throw new Error('--serial is required (the harness never guesses a device)')
  const once = (args, options = {}) =>
    execFileSync(ADB, ['-s', serial, ...args], {
      encoding: options.binary ? 'buffer' : 'utf8',
      maxBuffer: 1 << 28,
      timeout: options.timeout ?? 120000,
      input: options.input,
    })
  // Wi-Fi adb (the Tecno phone) drops now and then: on exit 255 / offline, reconnect and retry the call.
  const run = (args, options = {}) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return once(args, options)
      } catch (error) {
        if (!serial.includes(':') || attempt >= 20 || !(([255, null].includes(error.status)) || /offline|not found|closed|no devices|unauthorized/i.test(String(error.stderr ?? '') + String(error.message)))) throw error
        try { execFileSync(ADB, ['connect', serial], { timeout: 10000 }) } catch {}
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
      }
    }
  }
  return {
    serial,
    shell: (command, options) => run(['shell', command], options),
    run,
    screencap: () => run(['exec-out', 'screencap', '-p'], { binary: true }),
    logcatClear: () => run(['logcat', '-c']),
    logcat: () => run(['logcat', '-d', '-v', 'brief', 'ReactNativeJS:V', '*:S']),
  }
}

export const median = values => {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// READER_BENCH {"renderer":..,"fixture":..,"event":{..}} or {"command":{..}} lines from logcat
export const parseBenchLines = logcat => {
  const records = []
  for (const line of logcat.split('\n')) {
    const marker = line.indexOf('READER_BENCH ')
    if (marker === -1) continue
    const json = line.slice(marker + 'READER_BENCH '.length).trim()
    try {
      records.push(JSON.parse(json))
    } catch {
      // a wrapped or truncated line
    }
  }
  return records
}

export const waitFor = async (adb, predicate, { timeoutMs = 60000, intervalMs = 400 } = {}) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const records = parseBenchLines(adb.logcat())
    const found = predicate(records)
    if (found) return found
    await sleep(intervalMs)
  }
  return undefined
}

export const events = records => records.filter(record => record.event).map(record => record.event)

export const findEvent = (records, type, after = 0) =>
  events(records).find(event => event.type === type && event.t >= after)

// `dumpsys meminfo` "Total PSS by process" in KB, split into the app and the WebView processes.
export const readMemory = (adb, pkg) => {
  const text = adb.shell('dumpsys meminfo')
  const section = text.split('Total PSS by process:')[1]?.split(/\n\s*\n/)[0] ?? ''
  const processes = []
  for (const line of section.split('\n')) {
    const match = /^\s*([\d,]+)K:\s+(\S+)\s+\(pid (\d+)/.exec(line)
    if (match)
      processes.push({
        kb: Number(match[1].replace(/,/g, '')),
        name: match[2],
        pid: Number(match[3]),
      })
  }
  const isWebView = name => /webview|sandboxed_process|privileged_process|chromium/i.test(name)
  const appProcs = processes.filter(
    p => (p.name === pkg || p.name.startsWith(`${pkg}:`)) && !isWebView(p.name)
  )
  const webviewProcs = processes.filter(p => isWebView(p.name))
  const sum = list => list.reduce((total, p) => total + p.kb, 0)
  return {
    appPssKb: sum(appProcs),
    webviewPssKb: sum(webviewProcs),
    totalPssKb: sum(appProcs) + sum(webviewProcs),
    processes: [...appProcs, ...webviewProcs],
  }
}

// `dumpsys gfxinfo <pkg>` summary since the last reset.
export const readGfx = (adb, pkg) => {
  const text = adb.shell(`dumpsys gfxinfo ${pkg}`)
  const number = regex => {
    const match = regex.exec(text)
    return match ? Number(match[1]) : null
  }
  const total = number(/Total frames rendered:\s*(\d+)/)
  const janky = number(/Janky frames:\s*(\d+)/)
  return {
    totalFrames: total,
    jankyFrames: janky,
    jankPercent: total ? (100 * janky) / total : null,
    p50: number(/50th percentile:\s*(\d+)ms/),
    p90: number(/90th percentile:\s*(\d+)ms/),
    p95: number(/95th percentile:\s*(\d+)ms/),
    p99: number(/99th percentile:\s*(\d+)ms/),
  }
}

// Centre of a view found by resource-id or content-desc through uiautomator, or undefined.
export const findViewCenter = (adb, name) => {
  try {
    adb.shell('uiautomator dump /sdcard/rb-ui.xml', { timeout: 30000 })
    const xml = adb.shell('cat /sdcard/rb-ui.xml')
    const nodes = xml.match(/<node [^>]*>/g) ?? []
    for (const node of nodes) {
      if (!node.includes(`"${name}"`)) continue
      const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node)
      if (bounds) {
        const [, x1, y1, x2, y2] = bounds.map(Number)
        return { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) }
      }
    }
  } catch {
    // uiautomator can fail while an animation keeps the screen busy
  }
  return undefined
}

export const sizeOf = path => {
  const result = spawnSync('stat', ['-f', '%z', path], { encoding: 'utf8' })
  return result.status === 0 ? Number(result.stdout.trim()) : null
}

// Runs the flings as ONE device-side shell script (same commands and 0.8 s spacing as before), detached
// from the adb link, then polls for a done marker. On the Tecno phone the Wi-Fi adb link dropped
// while it was busy flinging, so a host-side wait on the call killed the run.
export const runFlings = async (adb, flings) => {
  const script = flings.map(c => `${c}; sleep 0.8`).join('\n') + '\necho done > /data/local/tmp/rb-fling.done\n'
  const quiet = fn => { try { return fn() } catch { return undefined } }
  const connect = () => quiet(() => execFileSync(ADB, ['connect', adb.serial], { timeout: 10000 }))
  const start = () => adb.run(['shell', 'rm -f /data/local/tmp/rb-fling.done; cat > /data/local/tmp/rb-fling.sh'], { input: script })
  for (let a = 0; a < 15; a += 1) {
    try { start(); adb.shell('nohup sh /data/local/tmp/rb-fling.sh >/dev/null 2>&1 &'); break } catch { connect(); await sleep(2000) }
  }
  const deadline = Date.now() + 120000
  while (Date.now() < deadline) {
    await sleep(3000)
    const out = quiet(() => adb.shell('cat /data/local/tmp/rb-fling.done 2>/dev/null', { timeout: 8000 }))
    if (out === undefined) { connect(); continue }
    if (out.includes('done')) return
  }
  throw new Error('flings did not finish')
}
