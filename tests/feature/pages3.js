const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, deviceScaleFactor:2, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(700);
  console.log('lib', await pg.evaluate(()=>LIB.map(m=>[m.title,m.count,m.chapters.length,m.sv])));
  await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(1500);
  console.log('info', await pg.evaluate(()=>[$('#rInfo').textContent, PC.counts.join(','), R.notes.size, R.breaks.size]));
  const seen=[]; for(let k=0;k<40;k++){ await pg.evaluate(()=>{ setChrome(false); return pgTurn(1); }); await sleep(180); seen.push(await pg.evaluate(()=>bookPages().page)); }
  console.log('page numbers while turning', seen.join(' '), '| total', await pg.evaluate(()=>bookPages().total));
  await pg.evaluate(()=>goTo(0,false)); await sleep(400);
  await pg.evaluate(()=>{ S.size=26; applyLook(); relayoutSoon(); }); await sleep(1800);
  console.log('bigger text ->', await pg.evaluate(()=>$('#rInfo').textContent));
  await pg.evaluate(()=>{ S.size=19; applyLook(); relayoutSoon(); }); await sleep(1500);
  // selection bar colours
  await pg.evaluate(()=>{ const ws=document.querySelectorAll('#pgFlow w'); const r=document.createRange(); r.setStart(ws[3].firstChild,0); r.setEnd(ws[5].firstChild,2); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }); await sleep(500);
  console.log('dots', await pg.evaluate(()=>[...document.querySelectorAll('#selBar .dot')].map(d=>getComputedStyle(d).backgroundColor)));
  await pg.screenshot({path:'n_sel.png'});
  await pg.evaluate(()=>selClear()); await pg.evaluate(()=>goTo(R.meta.chapters[2].i,false)); await sleep(500); await pg.evaluate(()=>setChrome(false)); await sleep(300);
  await pg.screenshot({path:'n_page.png'});
  // old sample migration
  console.log('errs', errs);
  // big book counts
  await pg.evaluate(()=>closeReader());
  await pg.setInputFiles('#fileIn', EP+'files/epub_large.epub'); await pg.waitForFunction(()=>LIB.some(m=>m.title==='Big Book'),null,{timeout:60000}); await sleep(300);
  await pg.evaluate(()=>openDoc(LIB.find(m=>m.title==='Big Book').id)); await sleep(1000);
  for(const t of [0,3000,8000]){ await sleep(t?t-(t===8000?3000:0):0); console.log('big @'+t, await pg.evaluate(()=>[$('#rInfo').textContent, PC.counts.filter(Boolean).length+'/'+PC.counts.length])); }
  const t0=Date.now(); await pg.waitForFunction(()=>PC.counts.every(Boolean),null,{timeout:120000}); console.log('all counted after ~', Date.now()-t0+9000,'ms', await pg.evaluate(()=>$('#rInfo').textContent));
  const tt=await pg.evaluate(async()=>{ const a=performance.now(); for(let k=0;k<10;k++){ setChrome(false); await pgTurn(1); } return Math.round((performance.now()-a)/10); }); console.log('turn ms', tt);
  await ctx.close();
  const c2=await b.newContext({viewport:{width:1280,height:800}, serviceWorkers:'block'}); await c2.addInitScript(()=>{window.__toozKeepSample=true}); await c2.route(/fonts\.|cdnjs/,r=>r.abort()); const p2=await c2.newPage(); await p2.goto('http://localhost:8750/'); await sleep(500); await p2.evaluate(()=>openDoc(LIB[0].id)); await sleep(1200); await p2.evaluate(()=>setChrome(false)); await sleep(300); await p2.screenshot({path:'n_wide.png'});
  console.log('wide', await p2.evaluate(()=>{ let L=1e9,R=-1e9; for(const x of pgFlow.querySelectorAll('w')){ for(const r of x.getClientRects()){ if(r.right<=0||r.left>=innerWidth||r.width<1) continue; L=Math.min(L,r.left); R=Math.max(R,r.right);} } return [Math.round(L), Math.round(innerWidth-R), P.cols, $('#rInfo').textContent]; }));
  await b.close();
})();
