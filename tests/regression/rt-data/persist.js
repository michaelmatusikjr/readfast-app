// Persistence / integrity tests on the NEW version (persistent profile so reloads keep data).
const { chromium } = require('/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-r2/node_modules/playwright-core');
const fs=require('fs');
const SP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const D=SP+'rt-data/', EP=SP+'redteam-epub/';
const LIBS={'jszip.min.js':EP+'node_modules/jszip/dist/jszip.min.js','pdf.min.js':EP+'node_modules/pdfjs-dist/build/pdf.min.js','pdf.worker.min.js':EP+'node_modules/pdfjs-dist/build/pdf.worker.min.js'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(...a.map(x=>typeof x==='string'?x:JSON.stringify(x)));
(async()=>{
  const prof=D+'profile-persist'; fs.rmSync(prof,{recursive:true,force:true});
  const ctx=await chromium.launchPersistentContext(prof,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', viewport:{width:390,height:844}, serviceWorkers:'block'});
  await ctx.route(/cdnjs/,r=>{ const k=Object.keys(LIBS).find(k=>r.request().url().endsWith('/'+k)); return k?r.fulfill({path:LIBS[k],contentType:'application/javascript'}):r.abort(); });
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await ctx.route(/localhost:8761\/(index\.html)?$/,r=>r.fulfill({path:D+'new.html',contentType:'text/html'}));
  const pg=ctx.pages()[0]; const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8761/'); await sleep(700);
  await pg.setInputFiles('#fileIn', SP+'tooz/t/rich.epub'); await pg.waitForFunction(()=>LIB.some(m=>m.title==='Rich Test Book'),null,{timeout:20000});
  const id=await pg.evaluate(()=>LIB.find(m=>m.title==='Rich Test Book').id);

  // (a) scroll-mode reopen drift
  const drift=await pg.evaluate(async(id)=>{ const out=[]; S.mode='pages'; await openDoc(id); await goTo(900); out.push(R.pos); closeReader();
    S.mode='scroll'; for(let k=0;k<6;k++){ await openDoc(id); await new Promise(r=>setTimeout(r,300)); out.push(R.pos); closeReader(); } return out; }, id);
  log('(a) pos after each reopen in Scroll mode', drift);
  const drift2=await pg.evaluate(async(id)=>{ const out=[]; S.mode='pages'; await openDoc(id); await goTo(900); out.push(R.pos);
    for(let k=0;k<4;k++){ await switchMode('scroll'); await new Promise(r=>setTimeout(r,300)); out.push('S'+R.pos); await switchMode('pages'); await new Promise(r=>setTimeout(r,200)); out.push('P'+R.pos); } closeReader(); return out; }, id);
  log('(a2) Pages<->Scroll switching', drift2);

  // (b) speed mode shows note refs / subscripts as separate flashes
  log('(b) speed chunks', await pg.evaluate(async(id)=>{ S.mode='speed'; S.multi=false; await openDoc(id); const i=R.words.findIndex((w,k)=>w==='H'&&R.words[k+1]==='2'); const seq=[]; for(let k=i;k<i+4;k++){ showChunk(k); seq.push($('#word').textContent); } const j=R.words.indexOf('bell'); showChunk(j); const a=$('#word').textContent; showChunk(j+1); const b2=$('#word').textContent; closeReader(); S.mode='pages'; return {h2o:seq, noteref:[a,b2]}; }, id));

  // (c) search
  log('(c) search', await pg.evaluate(async(id)=>{ await openDoc(id); const res={}; openSearch(); for(const q of ['H2O','water is H2O','1st rule','“A quoted passage','"A quoted passage','A quoted passage,” she']){ $('#srchIn').value=q; runSearch(); res[q]=$('#srchMeta').textContent; } closeSheet(); closeReader(); return res; }, id));

  // (d) highlight merge: adjacent different colours
  log('(d) highlights', await pg.evaluate(async(id)=>{ await openDoc(id); R.meta.highlights=[]; addHighlight(10,14,1,'yellow note'); addHighlight(15,19,3); const a=R.meta.highlights.map(h=>[h.s,h.e,h.c,h.note]); closeReader(); return a; }, id));

  // (e) "Start over" from Library is undone by the closed reader's pagehide/visibility save
  await pg.evaluate(async(id)=>{ await openDoc(id); await goTo(1500); closeReader(); docOptions(id); sheetActs.restart(); }, id);
  log('(e) after Start over, LIB pos', await pg.evaluate((id)=>LIB.find(m=>m.id===id).pos, id));
  await pg.evaluate(()=>{ Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(300); await pg.reload(); await sleep(800);
  log('(e) after app backgrounded + relaunch, pos', await pg.evaluate((id)=>LIB.find(m=>m.id===id).pos, id));

  // (f) deleted book comes back
  await pg.evaluate(async(id)=>{ await openDoc(id); closeReader(); docOptions(id); await sheetActs.del(); }, id);
  log('(f) after delete, in LIB?', await pg.evaluate((id)=>LIB.some(m=>m.id===id), id));
  await pg.evaluate(()=>{ window.dispatchEvent(new Event('pagehide')); });
  await sleep(300); await pg.reload(); await sleep(800);
  log('(f) after relaunch, in LIB?', await pg.evaluate((id)=>{ const m=LIB.find(m=>m.id===id); return m?[m.title,m.pos]:false; }, id));
  log('(f) opening it', await pg.evaluate(async(id)=>{ const ok=await openDoc(id); return [ok, $('#toastMsg').textContent]; }, id));
  log('errs', errs);
  await ctx.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
