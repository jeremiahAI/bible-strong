// SPIKE: max/median 1-min load from the sampler log between the BEFORE/AFTER lines of a gated log
import fs from 'fs'
const [gl,sl,fixtureSel]=process.argv.slice(2)
const t=s=>{const [h,m,x]=s.split(':').map(Number);return h*3600+m*60+x}
const samples=fs.readFileSync(sl,'utf8').trim().split('\n').map(l=>{const [ts,a]=l.split(' ');return [t(ts),Number(a.replace(',',''))]}).filter(x=>!isNaN(x[1]))
const lines=fs.readFileSync(gl,'utf8').trim().split('\n').filter(l=>/BEFORE|AFTER/.test(l))
const w={}
for(const l of lines){const [ts,r,f,k]=l.split(' ');w[f]??={};w[f][k]=t(ts)}
for(const [f,{BEFORE:b,AFTER:a}] of Object.entries(w)){const s=samples.filter(x=>x[0]>=b&&x[0]<=a).map(x=>x[1]);s.sort((x,y)=>x-y);console.log(f,'n='+s.length,'min',s[0],'median',s[s.length>>1],'max',s[s.length-1])}
