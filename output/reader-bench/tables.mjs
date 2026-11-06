import fs from 'fs'
const src={views:{psalm119:'views-rerun-psalm119','john1-strong':'views-rerun2-john1-strong','genesis1-bhg-interlinear':'views-rb-bench-genesis1-bhg-interlinear','john1-parallel':'views-rerun-john1-parallel','romans8-annotated':'views-rerun2-romans8-annotated'},
skia:{psalm119:'skia-rerun2-psalm119','john1-strong':'skia-rerun2-john1-strong','genesis1-bhg-interlinear':'skia-rerun2-genesis1-bhg-interlinear','john1-parallel':'skia-rerun-john1-parallel','romans8-annotated':'skia-rb-bench-romans8-annotated'}}
const fx=Object.keys(src.views)
const get=(r,f)=>JSON.parse(fs.readFileSync(`${src[r][f]}/results.json`)).metrics[f]
const rng=s=>{const v=(s?.values??[]).filter(x=>x!==null);if(!v.length)return 'n/a';return `${s.median} (${Math.min(...v)}-${Math.max(...v)}, n=${v.length})`}
const mb=k=>k==null?'n/a':(k/1024).toFixed(0)
const out=[]
const T=(title,head,rows)=>{out.push(`### ${title}\n`,'| '+head.join(' | ')+' |','|'+head.map(()=>'---').join('|')+'|',...rows.map(r=>'| '+r.join(' | ')+' |'),'')}
for(const [title,key] of [['First text, cold start (ms): median (min-max, n)','firstTextCold'],['First text, warm (ms): median (min-max, n)','firstTextWarm'],['Tap latency (ms, includes `input tap` start-up)','tapLatency'],['Highlight repaint (ms)','highlightRepaint'],['Scroll-to-verse (ms)','scrollToVerse']])
 T(title,['fixture','views','skia'],fx.map(f=>[f,rng(get('views',f)[key]),rng(get('skia',f)[key])]))
const sc=(m)=>`${m.scroll.jankPercent.toFixed(1)}% / ${m.scroll.p50}/${m.scroll.p90}/${m.scroll.p95}/${m.scroll.p99} (${m.scroll.totalFrames} fr)`
T('Scroll, 10 flings: jank % / p50/p90/p95/p99 ms (gfxinfo, 1 pass; frame count in brackets)',['fixture','views','skia'],fx.map(f=>[f,sc(get('views',f)),sc(get('skia',f))]))
T('PSS, MB, app process (after load / after scroll)',['fixture','views','skia'],fx.map(f=>[f,...['views','skia'].map(r=>{const m=get(r,f);return `${mb(m.memoryAfterLoad.appPssKb)} / ${mb(m.memoryAfterScroll.appPssKb)}`})]))
fs.writeFileSync('tables.md',out.join('\n'))
// raw dump of every source label for the evidence list
console.log(out.join('\n'))
