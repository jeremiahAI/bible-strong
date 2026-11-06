// attaches to every WebView target on :9286, re-polls, appends exceptions/console errors to after2/exceptions-live.jsonl
import { appendFileSync } from 'node:fs'
const out = process.argv[2]
const seen = new Set()
const att = async t => {
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  const tag = (t.url || '').split('/').pop().slice(0, 40)
  ws.onmessage = m => { const d = JSON.parse(m.data)
    if (d.method === 'Runtime.exceptionThrown') { const e = d.params.exceptionDetails
      appendFileSync(out, JSON.stringify({ t: new Date().toISOString(), target: tag, kind: 'exception', text: e.text, description: e.exception?.description ?? e.exception?.value, line: e.lineNumber, col: e.columnNumber, url: (e.url||'').split('/').pop(), stack: e.stackTrace?.callFrames?.slice(0, 6).map(f => `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}:${f.columnNumber}`) }) + '\n') }
    else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') appendFileSync(out, JSON.stringify({ t: new Date().toISOString(), target: tag, kind: 'console.error', text: d.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400) }) + '\n') }
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }))
  ws.onclose = () => seen.delete(t.id)
}
for (;;) { try { const l = await (await fetch('http://localhost:9286/json')).json()
  for (const t of l) if (t.webSocketDebuggerUrl && !seen.has(t.id)) { seen.add(t.id); att(t).catch(() => seen.delete(t.id)) } } catch {}
  await new Promise(r => setTimeout(r, 2000)) }
