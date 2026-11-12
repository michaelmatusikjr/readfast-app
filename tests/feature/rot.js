const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1200);
  await pg.evaluate(async()=>{ S.mode='pages'; saveSettings(); await openDoc('shelf-orthodoxy'); });
  await sleep(1500);
  for(let k=0;k<12;k++){ await pg.evaluate(()=>pgTurn(1)); await sleep(250); }
  const top=async()=>pg.evaluate(()=>{ const vr=$('#pgClip').getBoundingClientRect(); let best=null; for(const w of document.querySelectorAll('#pgFlow w')){ const r=w.getBoundingClientRect(); if(r.left>=vr.left-1 && r.right<=vr.right+1 && r.top>=vr.top-1 && r.bottom<=vr.bottom+1){ if(!best || r.top<best.t-2 || (Math.abs(r.top-best.t)<=2 && r.left<best.l)) best={t:r.top,l:r.left,i:idxOf(w),txt:w.textContent}; } } return [best&&best.i, best&&best.txt.trim(), R.pos, R.words[R.pos], P.page]; });
  const vis=async(i)=>pg.evaluate(i=>{ const w=wordEl(i); const vr=$('#pgClip').getBoundingClientRect(); const r=w.getBoundingClientRect(); return r.left>=vr.left-1 && r.right<=vr.right+1; }, i);
  let t0=await top(); console.log('portrait top', t0);
  for(let k=0;k<3;k++){
    await pg.setViewportSize({width:844,height:390}); await sleep(900); const a=await top(); console.log('landscape', a, 'anchor visible', await vis(t0[0]));
    await pg.setViewportSize({width:390,height:780}); await sleep(900); const c=await top(); console.log('portrait', c, 'anchor visible', await vis(t0[0]));
  }
  console.log(errs); await b.close();
})();
