const list = await (await fetch('http://localhost:9286/json')).json()
const ws = new WebSocket(list[0].webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r))
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) { console.log(JSON.stringify(d.result?.result?.value ?? d.result, null, 1).slice(0, 3000)); process.exit(0) } }
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: process.argv[2], returnByValue: true } }))
