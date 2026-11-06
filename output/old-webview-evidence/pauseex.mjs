const list = await (await fetch('http://localhost:9286/json')).json()
const ws = new WebSocket(list[0].webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r))
let id = 0; const out = []
const send = (method, params={}) => ws.send(JSON.stringify({ id: ++id, method, params }))
ws.onmessage = m => { const d = JSON.parse(m.data)
  if (d.method === 'Debugger.paused') { out.push({ reason: d.params.reason, ex: d.params.data?.description ?? d.params.data?.value, frames: d.params.callFrames.slice(0,5).map(f => `${f.functionName||'(anon)'} ${(f.url||'').split('/').pop()}:${f.location.lineNumber}:${f.location.columnNumber}`) }); send('Debugger.resume') } }
send('Debugger.enable'); send('Debugger.setPauseOnExceptions', { state: 'all' })
await new Promise(r => setTimeout(r, Number(process.argv[2] ?? 15) * 1000))
console.log(JSON.stringify(out, null, 1)); process.exit(0)
