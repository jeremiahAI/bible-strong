#!/usr/bin/env node
// SPIKE: Android 10 / WebView 91 white-screen evidence over WebView devtools (CDP, Node's global WebSocket).
//   adb -s emulator-5586 forward tcp:9286 localabstract:webview_devtools_remote_<pid>
//   node shim.mjs probe|noshim|shim [--port 9286] [--wait 40]
// probe : read #root children / text length / typeof CSSLayerBlockRule from the live page
// noshim: Page.reload with no shim, list every Runtime.exceptionThrown / console error
// shim  : Page.addScriptToEvaluateOnNewDocument with the insertRule shim, Page.reload, wait, count hits
import { writeFileSync } from 'node:fs'
const mode = process.argv[2] ?? 'probe'
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d }
const port = arg('port', '9286'), waitS = Number(arg('wait', '40'))
const SHIM = `(() => {
  if (window.__shimInstalled) return
  window.__shimInstalled = true
  window.__shimHits = 0
  const original = CSSStyleSheet.prototype.insertRule
  CSSStyleSheet.prototype.insertRule = function (rule, index) {
    if (typeof rule === 'string' && /^\\s*@layer\\s+rnw/.test(rule)) {
      window.__shimHits += 1
      rule = '@media all {}'
    }
    return original.call(this, rule, index)
  }
})()`
const PROBE = `JSON.stringify({
  ua: navigator.userAgent.match(/Chrome\\/[\\d.]+/)?.[0],
  cssLayerBlockRule: typeof CSSLayerBlockRule,
  rootChildren: document.getElementById('root')?.children.length ?? null,
  rootText: (document.getElementById('root')?.innerText ?? '').length,
  bodyText: (document.body?.innerText ?? '').length,
  shimHits: window.__shimHits ?? null,
  href: location.href.slice(-60),
})`
const list = await (await fetch(`http://localhost:${port}/json`)).json()
const ws = new WebSocket(list[0].webSocketDebuggerUrl)
await new Promise(r => (ws.onopen = r))
let id = 0
const pending = new Map(), exceptions = [], consoleErrors = []
ws.onmessage = m => {
  const d = JSON.parse(m.data)
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); return }
  if (d.method === 'Runtime.exceptionThrown') {
    const e = d.params.exceptionDetails
    exceptions.push({ text: e.text, description: e.exception?.description ?? e.exception?.value, url: e.url, line: e.lineNumber, column: e.columnNumber, stack: e.stackTrace?.callFrames?.slice(0, 4).map(f => `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}:${f.columnNumber}`) })
  } else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) {
    consoleErrors.push({ type: d.params.type, text: d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300) })
  } else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') {
    consoleErrors.push({ type: 'log', text: `${d.params.entry.text} ${d.params.entry.url ?? ''}:${d.params.entry.lineNumber ?? ''}`.slice(0, 300) })
  }
}
const scripts = []
const origOnMessage = ws.onmessage
ws.onmessage = m => {
  const d = JSON.parse(m.data)
  if (d.method === 'Debugger.scriptFailedToParse') scripts.push({ failed: true, ...d.params })
  else if (d.method === 'Debugger.scriptParsed' && !d.params.url) scripts.push({ failed: false, ...d.params })
  origOnMessage(m)
}
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const probe = async () => JSON.parse((await send('Runtime.evaluate', { expression: PROBE, returnByValue: true })).result.result.value)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const out = { mode, at: new Date().toISOString() }
if (mode === 'probe') {
  out.state = await probe()
} else {
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')
  if (process.argv.includes('--debug')) await send('Debugger.enable')
  if (mode === 'shim') out.shimScriptId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM })).result.identifier
  await sleep(1500) // Runtime.enable replays earlier exceptions of the current document: drop them, keep only the reload's
  exceptions.length = 0; consoleErrors.length = 0; scripts.length = 0
  await send('Page.reload', { ignoreCache: true })
  await sleep(waitS * 1000)
  try { out.state = await probe() } catch (e) { out.state = String(e) }
  if (process.argv.includes('--debug')) {
    out.scripts = []
    for (const sc of scripts) {
      const src = (await send('Debugger.getScriptSource', { scriptId: sc.scriptId })).result?.scriptSource ?? ''
      const lines = src.split('\n')
      out.scripts.push({ failed: sc.failed, url: sc.url, startLine: sc.startLine, length: src.length, head: src.slice(0, 120), line8: lines[7]?.slice(0, 200), failedSource: sc.failed ? src : undefined })
    }
  }
  out.exceptions = exceptions
  out.consoleErrors = consoleErrors
}
console.log(JSON.stringify(out, null, 2))
if (arg('save')) writeFileSync(arg('save'), JSON.stringify(out, null, 2))
ws.close()
process.exit(0)
