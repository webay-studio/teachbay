import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1100}});const errors=[],diagnosticNoise=[];page.on('console',m=>{if(/Estimating resolution|Detected .*diacritics/.test(m.text()))diagnosticNoise.push(m.text());});page.on('pageerror',e=>errors.push(e.message));
try{await page.goto('http://localhost:3027/login');await page.getByRole('button',{name:'데모로 시작하기'}).click();await page.waitForURL('**/questions');await page.goto('http://localhost:3027/questions/new');
await page.locator('input[type=file]').first().setInputFiles(process.argv[2]);
await page.locator('.document-review').waitFor({timeout:240000});
const names=await page.locator('.piece-name').allTextContents();const tags=await page.locator('.piece-tags').allTextContents();
await fs.mkdir('output/registration-v2',{recursive:true});await fs.writeFile('output/registration-v2/real-browser.json',JSON.stringify({names,tags,errors,diagnosticNoise},null,2));await page.screenshot({path:'output/registration-v2/real-browser.png',fullPage:true});
console.log(JSON.stringify({names,errors,diagnosticNoise},null,2));
if(errors.length||diagnosticNoise.length)throw new Error('Browser errors or uncaptured diagnostics');
}finally{await browser.close();}
