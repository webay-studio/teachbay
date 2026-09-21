import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage();page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const readStore=store=>page.evaluate(store=>new Promise((resolve,reject)=>{const r=indexedDB.open('teachway',2);r.onsuccess=()=>{const db=r.result,a=db.transaction(store).objectStore(store).getAll();a.onsuccess=()=>{db.close();resolve(a.result.map(v=>({...v,blob:v.blob?{size:v.blob.size,type:v.blob.type}:undefined})))};a.onerror=()=>reject(a.error)};}),store);
try{
await page.goto('http://localhost:3027/login');
await page.getByRole('button',{name:'데모로 시작하기'}).click();await page.waitForURL('**/questions');
await page.goto('http://localhost:3027/questions/new');await page.getByRole('button',{name:'PDF · 지문/이어짐'}).click();
await page.locator('.document-review').waitFor({timeout:90000});
console.log('Candidates:',await page.locator('.piece-name').allTextContents());
// Explicitly join the sample's first question and its next-column choices.
await page.getByRole('checkbox',{name:'1번 문제 합치기 선택',exact:true}).check();
await page.getByRole('checkbox',{name:'1쪽 · 소속 확인 영역 합치기 선택',exact:true}).check();
await page.getByRole('button',{name:'선택 합치기 (2)'}).click();
// Join sample Q3 with its next-page continuation.
await page.getByRole('checkbox',{name:'3번 문제 합치기 선택',exact:true}).check();
await page.getByRole('checkbox',{name:'2쪽 · 소속 확인 영역 합치기 선택',exact:true}).check();
await page.getByRole('button',{name:'선택 합치기 (2)'}).click();
const count=await page.locator('.piece-name').count();assert.equal(count,7);
for(let i=0;i<count;i++){await page.locator('.piece-name').nth(i).click();await page.getByRole('checkbox',{name:'이 항목의 경계·순서·자료 연결 확인',exact:true}).check();}
await page.getByRole('checkbox',{name:'각 항목 확인 후, 제외한 영역에 필요한 내용이 없는지 전체 원본을 확인했어요.',exact:true}).check();
await page.getByRole('button',{name:'7개를 등록 목록에 추가'}).click();await page.getByRole('button',{name:'문제 7개 저장',exact:true}).click();await page.waitForURL('**/questions');
let questions=await readStore('questions'),documents=await readStore('documents');assert.equal(questions.length,7);assert.equal(documents.length,1);assert.equal(documents[0].blob.type,'application/pdf');
const q1=questions.find(q=>q.name==='1번 문제');assert.equal(q1.fragments.length,2);assert.equal(q1.materialIds.length,1);
await page.reload();await page.getByRole('checkbox',{name:'1번 문제 선택',exact:true}).check();await page.getByRole('checkbox',{name:'2번 문제 선택',exact:true}).check();await page.getByRole('button',{name:'시험지 만들기',exact:true}).click();await page.waitForURL('**/exams/new');
await page.locator('#print-document img').first().waitFor();assert.equal(await page.locator('.question-number').filter({hasText:'공통 자료'}).count(),1);assert.equal(await page.locator('.question-number').filter({hasText:'계속'}).count(),1);
await page.getByRole('button',{name:'저장',exact:true}).click();await page.waitForURL(url=>url.pathname.startsWith('/exams/')&&!url.pathname.endsWith('/new'));await page.locator('#print-document img').first().waitFor();
const exams=await readStore('exams');assert.equal(exams.length,1);assert.equal(exams[0].items[0].materials.length,1);const archive=page.url();
await fs.mkdir('output/registration-v2',{recursive:true});await page.screenshot({path:'output/registration-v2/exam-browser.png',fullPage:true});
await page.emulateMedia({media:'print'});await page.screenshot({path:'output/registration-v2/print-browser.png',fullPage:true});await page.emulateMedia({media:'screen'});
// Delete originals through the actual library UI; archived fragments and material survive.
await page.goto('http://localhost:3027/questions');page.on('dialog',d=>d.accept());
const menu=page.locator('.question-card').filter({hasText:'1번 문제'}).getByRole('button',{name:'1번 문제 수정 및 삭제'});
console.log('menu count',await menu.count());
assert.equal(await menu.count(),1);await menu.click();await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'공통 자료 (1–2번) 수정 및 삭제',exact:true}).click();await page.getByRole('button',{name:'삭제',exact:true}).click();
await page.goto(archive);await page.locator('#print-document img').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('#print-document img')].every(i=>i.complete&&i.naturalWidth>0));
assert.deepEqual(errors,[]);console.log('PASS: demo, document review, merged fragments, source Blob persistence, reload, shared material dedup, snapshot and print CSS rendering.');
}catch(e){console.error('URL',page.url());console.error((await page.locator('body').innerText()).slice(-4500));await page.screenshot({path:'output/registration-v2/browser-failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
