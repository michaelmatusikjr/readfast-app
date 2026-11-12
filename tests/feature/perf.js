const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(600);
  await pg.setInputFiles('#fileIn', EP+'files/epub_large.epub');
  await pg.waitForFunction(()=>LIB.some(m=>m.title==='Big Book'),null,{timeout:60000}); await sleep(500);
  for(const m of ['pages','scroll','speed']){
    const r=await pg.evaluate(async(m)=>{ S.mode=m; const t0=performance.now(); await openDoc(LIB.find(x=>x.title==='Big Book').id); const t1=performance.now();
      let turn=0; if(m==='pages'){ const a=performance.now(); for(let k=0;k<10;k++) await pgTurn(1); turn=(performance.now()-a)/10; }
      if(m==='scroll'){ const a=performance.now(); for(let k=0;k<10;k++){ scView.scrollTop+=600; await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); } turn=(performance.now()-a)/10; }
      const res={m, open:Math.round(t1-t0), perStep:Math.round(turn), secs:R.SEC.length, pos:R.pos, dom:document.querySelectorAll('w').length}; closeReader(); return res; }, m);
    console.log(JSON.stringify(r));
  }
  // jump to the middle via goTo in pages
  console.log(await pg.evaluate(async()=>{ S.mode='pages'; await openDoc(LIB.find(x=>x.title==='Big Book').id); const a=performance.now(); await goTo(Math.floor(R.n/2),true); return 'jump ms '+Math.round(performance.now()-a)+' pos '+R.pos+' page '+P.page+'/'+P.pages; }));
  console.log('errors', errs); await b.close();
})();
