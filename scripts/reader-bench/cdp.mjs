// SPIKE: evaluate an expression in the real reader's WebView page via devtools (debug-enabled bench build)
const [expr, port = '9333'] = process.argv.slice(2)
const list = await (await fetch(`http://localhost:${port}/json`)).json()
const ws = new WebSocket(list[0].webSocketDebuggerUrl)
await new Promise(r => (ws.onopen = r))
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }))
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) { console.log(JSON.stringify(d.result?.result?.value ?? d.result ?? d.error)); process.exit(0) } }
setTimeout(() => process.exit(2), 15000)
