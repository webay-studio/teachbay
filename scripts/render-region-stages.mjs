import fs from 'node:fs/promises';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const [input,renderPrefix,page='1']=process.argv.slice(2), index=Number(page)-1;
const d=JSON.parse(await fs.readFile(input,'utf8')),p=d.pages[index];
const img=await loadImage(`${renderPrefix}-${page}.png`),out=path.join(path.dirname(input),`${path.basename(input, ".json")}-stages-${page}`);await fs.mkdir(out,{recursive:true});
const stages={
 raw:p.observations.map(o=>({id:o.id,rect:o.rect,text:o.text,source:o.source,passId:o.passId,state:o.state})),
 blocks:d.blocks.filter(b=>b.pageIndex===index),
 final:[...d.questions,...(d.sharedSets??[])].flatMap(q=>q.parts.filter(p=>p.pageIndex===index).map(p=>({id:p.id,questionId:q.id,label:q.sourceLabel??`공통 지문 ${q.sourceRange?.join("–")}`,role:p.role,rect:{x:p.bbox.x,y:p.bbox.y,w:p.bbox.width,h:p.bbox.height}})))
};
for(const [stage,items]of Object.entries(stages)){
 const c=createCanvas(img.width,img.height),ctx=c.getContext('2d');ctx.drawImage(img,0,0);ctx.strokeStyle=stage==='final'?'#de123f':'#009b78';ctx.lineWidth=stage==='final'?2:1;ctx.font='bold 18px sans-serif';ctx.fillStyle='#de123f';
 for(const o of items){const r=o.rect;ctx.strokeRect(r.x*c.width,r.y*c.height,r.w*c.width,r.h*c.height);if(o.label)ctx.fillText(o.label,r.x*c.width,r.y*c.height+16);}
 await fs.writeFile(path.join(out,`${stage}.png`),c.toBuffer('image/png'));
 await fs.writeFile(path.join(out,`${stage}.json`),JSON.stringify({stage,pageIndex:index,coordinateSystem:'normalized rendered page, top-left, rotation applied',analysisPixels:[p.width,p.height],artifactPixels:[c.width,c.height],sourceToAnalysis:p.sourceToAnalysis,items},null,2));
}
console.log(out);
