// Importer tests: parse EPUB cases with NEW and OLD versions, compare words, dump blocks/flags.
const { chromium } = require('/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-r2/node_modules/playwright-core');
const fs=require('fs');
const SP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const D=SP+'rt-data/', EP=SP+'redteam-epub/';
const LIBS={'jszip.min.js':EP+'node_modules/jszip/dist/jszip.min.js','pdf.min.js':EP+'node_modules/pdfjs-dist/build/pdf.min.js','pdf.worker.min.js':EP+'node_modules/pdfjs-dist/build/pdf.worker.min.js'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(...a.map(x=>typeof x==='string'?x:JSON.stringify(x)));
async function open(b, file){
  const ctx=await b.newContext({viewport:{width:390,height:844}, serviceWorkers:'block'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>{ const k=Object.keys(LIBS).find(k=>r.request().url().endsWith('/'+k)); return k?r.fulfill({path:LIBS[k],contentType:'application/javascript'}):r.abort(); });
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await ctx.route(/localhost:8761\/(index\.html)?$/,r=>r.fulfill({path:file,contentType:'text/html'}));
  const pg=await ctx.newPage(); pg.errs=[]; pg.on('pageerror',e=>pg.errs.push(e.message));
  await pg.goto('http://localhost:8761/'); await sleep(600); return pg;
}
const parse=(pg,path)=>pg.evaluate(async(b64)=>{ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); return await parseEpub(a.buffer,'x.epub'); }, fs.readFileSync(path).toString('base64'));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const NEW=await open(b, D+'new.html'), OLD=await open(b, D+'old.html');
  const files=[...fs.readdirSync(D+'cases').map(f=>D+'cases/'+f), SP+'tooz/t/rich.epub', ...['epub2_ncx.epub','epub3_nested.epub','epub_large.epub','epub_paths.epub','epub_badxml.epub','UPPER.EPUB'].map(f=>EP+'files/'+f)];
  for(const f of files){
    let n,o; try{ n=await parse(NEW,f); }catch(e){ n={err:e.message}; } try{ o=await parse(OLD,f); }catch(e){ o={err:e.message}; }
    log(f.split('/').pop(), 'NEW words', n.words&&n.words.length, 'OLD words', o.words&&o.words.length, n.err||'', o.err||'');
  }
  // Detailed dump of inline.epub
  const d=await NEW.evaluate(async(b64)=>{ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); const r=await parseEpub(a.buffer,'x.epub');
    const W=r.words, F=r.wf;
    const blocks=r.blocks.map(bl=>{ let t=''; for(let k=bl.s;k<bl.e;k++){ const f=F[k]; t+=(k>bl.s&&!(f&128)?' ':'')+W[k]+(f&127?'{'+(f&127)+'}':''); } return bl.t+(bl.q?'+q':'')+': '+t; });
    return {blocks, notes:r.notes.map(([a,t])=>[W[a], a, t, W.slice(t,t+5).join(' ')]), breaks:r.breaks, chapters:r.chapters};
  }, fs.readFileSync(D+'cases/inline.epub').toString('base64'));
  d.blocks.forEach(x=>log(x)); log('notes', d.notes); log('breaks', d.breaks);
  // extract helpers
  log('rtl', await NEW.evaluate(async(b64)=>{ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); const r=await parseEpub(a.buffer,'x.epub'); return {lang:r.lang, words:r.words}; }, fs.readFileSync(D+'cases/rtl.epub').toString('base64')));
  log('latin1', await NEW.evaluate(async(b64)=>{ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); const r=await parseEpub(a.buffer,'x.epub'); return r.words; }, fs.readFileSync(D+'cases/latin1.epub').toString('base64')));
  log('cover', await NEW.evaluate(async(b64)=>{ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); const r=await parseEpub(a.buffer,'x.epub'); return {at:r.images&&r.images.at, secs:r.secs, ch:r.chapters, n:r.words.length}; }, fs.readFileSync(D+'cases/cover.epub').toString('base64')));
  log('fonts', await NEW.evaluate(async(b64)=>{ const bin=atob(b64); const a=new Uint8Array(bin.length); for(let k=0;k<bin.length;k++) a[k]=bin.charCodeAt(k); const r=await parseEpub(a.buffer,'x.epub'); return r.font&&{family:r.font.family, faces:r.font.faces.map(f=>[f.w,f.st,f.blob.size])}; }, fs.readFileSync(D+'cases/fonts.epub').toString('base64')));
  log('errs', NEW.errs, OLD.errs);
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
