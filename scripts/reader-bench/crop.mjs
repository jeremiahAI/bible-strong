import {PNG} from 'pngjs'; import fs from 'fs'
const [out,x,y,w,h,...ins]=process.argv.slice(2).map((a,i)=>i>0&&i<5?+a:a)
const imgs=ins.map(f=>PNG.sync.read(fs.readFileSync(f)))
const o=new PNG({width:w*imgs.length,height:h})
imgs.forEach((im,k)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++){const si=((y+j)*im.width+x+i)*4,di=(j*o.width+k*w+i)*4;for(let c=0;c<4;c++)o.data[di+c]=im.data[si+c]}})
fs.writeFileSync(out,PNG.sync.write(o))
