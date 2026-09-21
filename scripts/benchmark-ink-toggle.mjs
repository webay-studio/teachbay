import {build} from 'esbuild';
import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const input=process.argv[2];
if (!input) throw new Error('Usage: node scripts/benchmark-ink-toggle.mjs <PDF path>');
const compiled=await build({stdin:{contents:'export {analyzePdf} from "./lib/pdf-region-engine/analyze-pdf";',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const pdf=await fs.readFile(input);
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<title>Local benchmark</title>');return;}
 if(url.pathname==='/engine.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].contents);return;}
 if(url.pathname==='/input.pdf'){res.setHeader('Content-Type','application/pdf');res.end(pdf);return;}
 const root=path.resolve('public/document-runtime');const target=path.resolve('public','.'+decodeURIComponent(url.pathname));
 if(!target.startsWith(root+path.sep)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',target.endsWith('.js')||target.endsWith('.mjs')?'text/javascript':target.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.end(await fs.readFile(target));
}catch(e){res.writeHead(404).end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
try{for(const removeInk of [false,true,true,false,false,true]){
 const context=await browser.newContext();const page=await context.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
 const result=await page.evaluate(async(removeInk)=>{
  const {analyzePdf}=await import('/engine.js');const blob=await(await fetch('/input.pdf')).blob();const file=new File([blob],'input.pdf',{type:'application/pdf'});
  const start=performance.now();const r=await analyzePdf(file,new AbortController().signal,()=>{},{removeInk,shapeFilter:true,distributionOnly:false,ocrPolicy:'legacy',connectivity:4,maxPages:40});
  return {removeInk,totalMs:performance.now()-start,questions:r.questions.length,pages:r.pages.map(p=>({index:p.index,...p.timings})),timings:r.timings};
 },removeInk);results.push(result);console.log(JSON.stringify(result));await context.close();}
 await fs.mkdir('output/registration-v2/ink-benchmark',{recursive:true});await fs.writeFile('output/registration-v2/ink-benchmark/results.json',JSON.stringify({file:path.basename(input),coldContext:true,results},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
