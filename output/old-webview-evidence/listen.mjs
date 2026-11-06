// attach to the Bible WebView, list exceptions replayed for the current document (and any new ones for --wait s)
const list = await (await fetch('http://localhost:9286/json')).json()
const ws = new WebSocket(list[0].webSocketDebuggerUrl)
await new Promise(r => (ws.onopen = r))
const ex = [], logs = []
ws.onmessage = m => { const d = JSON.parse(m.data)
  if (d.method === 'Runtime.exceptionThrown') { const e = d.params.exceptionDetails; ex.push({ text: e.text, description: e.exception?.description ?? e.exception?.value, url: e.url, line: e.lineNumber, col: e.columnNumber, stack: e.stackTrace?.callFrames?.slice(0,6).map(f => `${f.functionName||'(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}:${f.columnNumber}`) }) }
  else if (d.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(d.params.type)) logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' ').slice(0,400)) }
ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }))
ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }))
await new Promise(r => setTimeout(r, Number(process.argv[2] ?? 3) * 1000))
console.log(JSON.stringify({ ex, logs }, null, 1)); process.exit(0)
