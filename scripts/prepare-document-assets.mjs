import {mkdir,copyFile,readdir,cp} from 'node:fs/promises';
import path from 'node:path';
const out='public/document-runtime';
await mkdir(out,{recursive:true});
for(const [source,target] of [['pdfjs-dist/build/pdf.worker.min.mjs','pdf.worker.min.mjs'],['@rhwp/core/rhwp_bg.wasm','rhwp_bg.wasm'],['tesseract.js/dist/worker.min.js','ocr/worker.min.js'],['@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz','ocr/lang/kor.traineddata.gz'],['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','ocr/lang/eng.traineddata.gz']]){await mkdir(path.dirname(`${out}/${target}`),{recursive:true});await copyFile(`node_modules/${source}`,`${out}/${target}`)}
for(const name of await readdir('node_modules/tesseract.js-core'))if(name.endsWith('.wasm')||name.endsWith('.wasm.js'))await copyFile(`node_modules/tesseract.js-core/${name}`,`${out}/ocr/${name}`);
for(const dir of ['cmaps','standard_fonts','wasm'])await cp(`node_modules/pdfjs-dist/${dir}`,`${out}/pdf/${dir}`,{recursive:true});
for(const [pkg,name] of [['pdfjs-dist','pdfjs'],['@rhwp/core','rhwp'],['tesseract.js','tesseract'],['tesseract.js-core','tesseract-core']])await copyFile(`node_modules/${pkg}/${pkg==='tesseract.js'?'LICENSE.md':'LICENSE'}`,`${out}/${name}-LICENSE`);
console.log('PDF, HWP and Korean/English OCR assets are ready (served from this app).');
