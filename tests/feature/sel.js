const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(600);
  await pg.evaluate(()=>{ S.mode='pages'; S.focus=true; S.tapZones='edges'; saveSettings(); });
  await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(600);
  // select words 3..6 programmatically
  await pg.evaluate(()=>{ const ws=document.querySelectorAll('#pgFlow w'); const r=document.createRange(); r.setStart(ws[3].firstChild,0); r.setEnd(ws[6].firstChild, ws[6].firstChild.length-1); const s=getSelection(); s.removeAllRanges(); s.addRange(r); });
  await sleep(500);
  console.log('selbar shown', await pg.evaluate(()=>[!$('#selBar').hidden, JSON.stringify(SEL)]));
  await pg.click('#selBar [data-hl="3"]'); await sleep(200);
  console.log('after hl', await pg.evaluate(()=>[R.meta.highlights.map(h=>[h.s,h.e,h.c]), document.querySelectorAll('#pgFlow w.hl3').length, $('#selBar').hidden]));
  // tap on highlighted word -> menu
  const box=await pg.evaluate(()=>{ const r=document.querySelector('#pgFlow w.hl3').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  await pg.touchscreen.tap(box.x, box.y); await sleep(300);
  console.log('tap highlight ->', await pg.evaluate(()=>$('#sheet').hidden?'no sheet':$('#sheet h2').textContent));
  await pg.evaluate(()=>closeSheet());
  // tap right edge -> next page / section
  const before=await pg.evaluate(()=>[P.k,P.page,R.pos]);
  await pg.touchscreen.tap(370, 400); await sleep(500);
  console.log('tap right edge', before,'->', await pg.evaluate(()=>[P.k,P.page,R.pos, R.chrome]));
  await pg.touchscreen.tap(195, 400); await sleep(300);
  console.log('tap middle chrome ->', await pg.evaluate(()=>R.chrome));
  await pg.touchscreen.tap(15, 400); await sleep(500);
  console.log('tap left edge ->', await pg.evaluate(()=>[P.k,P.page,R.pos]));
  // bookmark toggle
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rMark'); await sleep(200);
  console.log('bookmark', await pg.evaluate(()=>[R.meta.bookmarks.length, $('#rMark').classList.contains('on')]));
  await pg.click('#rMark'); await sleep(200);
  console.log('unbookmark', await pg.evaluate(()=>[R.meta.bookmarks.length, $('#rMark').classList.contains('on')]));
  // scrub jump + back pill
  await pg.evaluate(()=>{ const s=$('#rScrub'); s.value=String(R.n-5); s.dispatchEvent(new Event('change')); }); await sleep(600);
  console.log('scrub jump', await pg.evaluate(()=>[R.pos, !$('#backPill').hidden]));
  await pg.click('#backGo'); await sleep(600);
  console.log('back', await pg.evaluate(()=>[R.pos]));
  // relayout on size change
  await pg.evaluate(()=>{ S.size=26; applyLook(); relayoutSoon(); }); await sleep(800);
  console.log('bigger text', await pg.evaluate(()=>[P.pages, R.pos]));
  // reload persistence
  await pg.evaluate(()=>closeReader()); await pg.reload(); await sleep(800);
  console.log('after reload', await pg.evaluate(()=>[S.mode, S.size, LIB[0].pos, (LIB[0].highlights||[]).length]));
  console.log('errors', errs); await b.close();
})();
