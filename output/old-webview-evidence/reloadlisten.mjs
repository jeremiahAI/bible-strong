const list = await (await fetch('http://localhost:9286/json')).json()
const ws = new WebSocket(list[0].webSocketDebuggerUrl)
await new Promise(r => (ws.onopen = r))
let id = 0; const ex = [], logs = []
const send = (method, params={}) => ws.send(JSON.stringify({ id: ++id, method, params }))
ws.onmessage = m => { const d = JSON.parse(m.data)
  if (d.method === 'Runtime.exceptionThrown') { const e = d.params.exceptionDetails; ex.push({ t: Date.now(), description: e.exception?.description ?? e.exception?.value, url: (e.url||'').split('/').pop(), line: e.lineNumber, col: e.columnNumber, stack: e.stackTrace?.callFrames?.slice(0,6).map(f => `${f.functionName||'(anon)'} ${(f.url||'').split('/').pop()}:${f.lineNumber}:${f.columnNumber}`) }) }
  else if (d.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(d.params.type)) logs.push({ t: Date.now(), msg: d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ').slice(0,600) })
  else if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') logs.push({ t: Date.now(), msg: 'log: ' + d.params.entry.text + ' ' + (d.params.entry.url ?? '') }) }
send('Runtime.enable'); send('Log.enable'); send('Page.enable')
await new Promise(r => setTimeout(r, 1500)); ex.length = 0; logs.length = 0
const t0 = Date.now(); send('Page.reload', { ignoreCache: true })
await new Promise(r => setTimeout(r, Number(process.argv[2] ?? 40) * 1000))
console.log(JSON.stringify({ t0, ex, logs }, null, 1)); process.exit(0)
