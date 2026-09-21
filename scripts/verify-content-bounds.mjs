import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const dir='output/content-bounds';await fs.mkdir(dir,{recursive:true});
const inputBytes=await fs.readFile(process.argv[2]);await fs.writeFile(`${dir}/input.pdf`,inputBytes);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1150},acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function trace(name){await page.locator('.review-advanced > summary').click();const event=page.waitForEvent('download');await page.getByRole('button',{name:'분석 기록 저장',exact:true}).click();const d=await event;await d.saveAs(`${dir}/${name}.json`);await page.locator('.review-advanced > summary').click();return JSON.parse(await fs.readFile(`${dir}/${name}.json`,'utf8'));}
async function sourcePng(index){await page.waitForFunction(()=>{const img=document.querySelector('.source-stage > img');return img?.getAttribute('src')?.startsWith('blob:')&&img.complete&&img.naturalWidth>0;});}
try{
await page.goto('http://localhost:3028/login');await page.getByRole('button',{name:'데모로 시작하기'}).click();await page.waitForURL('**/questions');await page.goto('http://localhost:3028/questions/new');await page.locator('input[type=file]').first().setInputFiles({name:path.basename(process.argv[2]),mimeType:'application/pdf',buffer:inputBytes});
await page.locator('.document-review').waitFor({timeout:240000});const before=await trace('before');
assert.equal(before.sha256,createHash('sha256').update(inputBytes).digest('hex'));
const selected=[1,2,4,13,17].map(number=>before.pieces.find(p=>p.number===number&&p.sectionId==='main'));
selected.push(before.pieces.find(p=>p.number===4&&p.sectionId==='essay'));
assert.ok(selected.every(Boolean),'Required audited cases must be detected');const actions=[],screen=[];
for(const p of selected){
 await page.locator(`.piece-card[data-piece-id="${p.id}"] .piece-name`).click();const pg=before.pages.find(pg=>pg.id===p.fragments[0].pageId);await sourcePng(pg.index);
 if(p.sectionId==='main'&&p.number===1)await page.locator('.source-stage').screenshot({path:`${dir}/screen-before.png`});
 const apply=page.getByRole('button',{name:'본문 끝 제안 적용',exact:true});if(await apply.count()){await apply.click();actions.push({id:p.id,action:'apply_proposal'});}else actions.push({id:p.id,action:'retain_original',reason:p.fragments[0].content?.reason});
 const box=page.locator(`.region-overlay[data-piece-id="${p.id}"]`).first();screen.push({id:p.id,style:await box.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height}))});
 if(p.sectionId==='main'&&p.number===1)await page.locator('.source-stage').screenshot({path:`${dir}/screen-after.png`});
}
const after=await trace('after');
const keep=new Set(selected.map(p=>p.id));for(const p of after.pieces.filter(p=>!keep.has(p.id)))await page.locator(`.piece-card[data-piece-id="${p.id}"]`).getByRole('button',{name:`${p.name} 분리 결과에서 제외`,exact:true}).click();
for(const p of selected){await page.locator(`.piece-card[data-piece-id="${p.id}"] .piece-name`).click();await page.locator(`.piece-card[data-piece-id="${p.id}"]`).getByRole('checkbox',{name:'영역 확인',exact:true}).check();}
await page.getByRole('checkbox',{name:'각 항목 확인 후, 제외한 영역에 필요한 내용이 없는지 전체 원본을 확인했어요.',exact:true}).check();await page.getByRole('button',{name:`${selected.length}개를 등록 목록에 추가`}).click();await page.getByRole('button',{name:`문제 ${selected.length}개 저장`,exact:true}).click();await page.waitForURL('**/questions');
const stored=await page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('teachway',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const all=store=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const questions=await all('questions'),assets=await all('assets');const output=[];
 const decode=async blob=>{const img=new Image(),url=URL.createObjectURL(blob);img.src=url;await img.decode();return {img,url};};
 for(const q of questions){for(const f of q.fragments??[]){const a=assets.find(a=>a.id===f.assetId),source=assets.find(a=>a.id===f.pageAssetId),s=await decode(source.blob),saved=await decode(a.blob);const c=document.createElement('canvas');c.width=a.width;c.height=a.height;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(s.img,f.rect.x*source.width,f.rect.y*source.height,f.rect.w*source.width,f.rect.h*source.height,0,0,c.width,c.height);const expected=ctx.getImageData(0,0,c.width,c.height).data;ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(saved.img,0,0);const actual=ctx.getImageData(0,0,c.width,c.height).data;let mismatches=0;for(let i=0;i<actual.length;i++)if(expected[i]!==actual[i])mismatches++;const data=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(a.blob);});output.push({questionId:q.id,name:q.name,fragment:f,width:a.width,height:a.height,pixelChannelMismatches:mismatches,png:data,sourcePng:await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.readAsDataURL(source.blob);})});URL.revokeObjectURL(s.url);URL.revokeObjectURL(saved.url);}}
 db.close();return output;
});
for(const row of stored){await fs.writeFile(`${dir}/source-${row.fragment.pageIndex+1}.png`,Buffer.from(row.sourcePng.split(',')[1],'base64'));delete row.sourcePng;await fs.writeFile(`${dir}/saved-${row.questionId}.png`,Buffer.from(row.png.split(',')[1],'base64'));delete row.png;const p=after.pieces.find(p=>p.id===row.questionId),r=p.fragments[0].rect;assert.deepEqual(row.fragment.rect,r);assert.equal(row.pixelChannelMismatches,0);const style=screen.find(x=>x.id===row.questionId).style;for(const [key,prop] of [['x','left'],['y','top'],['w','width'],['h','height']])assert.ok(Math.abs(parseFloat(style[prop])/100-r[key])<1e-6);}
assert.deepEqual(errors,[]);await fs.writeFile(`${dir}/verification.json`,JSON.stringify({actions,screen,stored,errors},null,2));console.log(JSON.stringify({saved:stored.map(r=>({name:r.name,width:r.width,height:r.height,mismatches:r.pixelChannelMismatches})),actions,errors},null,2));
}catch(e){await page.screenshot({path:`${dir}/failure.png`,fullPage:true}).catch(()=>{});console.error((await page.locator('body').innerText()).slice(-3500));throw e;}finally{await browser.close();}
