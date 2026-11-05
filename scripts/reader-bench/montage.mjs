import {PNG} from 'pngjs'; import fs from 'fs'
const [out,...ins]=process.argv.slice(2); const s=0.5
const imgs=ins.map(f=>PNG.sync.read(fs.readFileSync(f)))
const w=Math.floor(imgs[0].width*s),h=Math.floor(imgs[0].height*s)
const o=new PNG({width:w*imgs.length,height:h})
imgs.forEach((im,k)=>{for(let y=0;y<h;y++)for(let x=0;x<w;x++){const si=((Math.floor(y/s))*im.width+Math.floor(x/s))*4,di=(y*o.width+k*w+x)*4;for(let c=0;c<4;c++)o.data[di+c]=im.data[si+c]}})
fs.writeFileSync(out,PNG.sync.write(o))
