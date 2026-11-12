const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const focus of [false,true]){
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1200);
  await pg.evaluate(async(f)=>{ S.mode='pages'; S.focus=f; saveSettings(); await openDoc('shelf-orthodoxy'); },focus);
  await sleep(1500);
  for(let k=0;k<12;k++){ await pg.evaluate(()=>pgTurn(1)); await sleep(200); }
  await pg.evaluate(()=>setChrome(false)); await sleep(700);
  const st=async()=>pg.evaluate(()=>{ const c=$('#pgClip').getBoundingClientRect(); let top=null; for(const w of document.querySelectorAll('#pgFlow w')){ const r=w.getBoundingClientRect(); if(r.left>=c.left-1&&r.right<=c.right+1&&r.top>=c.top-1&&r.bottom<=c.bottom+1){ top=idxOf(w); break; } } return {chrome:R.chrome, anchor:R.anchor, pos:R.pos, top, clipH:Math.round(c.height), rb:$('#rBody').clientHeight}; });
  const s0=await st(); console.log('focus',focus,'hidden start',s0);
  const anchorWord=s0.top;
  const vis=a=>pg.evaluate(a=>{ const w=wordEl(a); if(!w) return 'none'; const c=$('#pgClip').getBoundingClientRect(), r=w.getBoundingClientRect(); return r.left>=c.left-2&&r.right<=c.right+2&&r.top>=c.top-2&&r.bottom<=c.bottom+2; },a);
  for(let k=0;k<2;k++){
    await pg.setViewportSize({width:844,height:390}); await sleep(1100); console.log(' landscape', await st(), 'visible', await vis(anchorWord));
    await pg.setViewportSize({width:390,height:780}); await sleep(1100); console.log(' portrait', await st(), 'visible', await vis(anchorWord));
  }
  await pg.evaluate(()=>{ S.size=24; saveSettings(); relayoutSoon(); }); await sleep(900); console.log(' size24', await st(), 'visible', await vis(anchorWord));
  await pg.evaluate(()=>{ S.size=19; saveSettings(); relayoutSoon(); }); await sleep(900); console.log(' size19', await st(), 'visible', await vis(anchorWord));
  console.log(errs); await ctx.close();
  }
  await b.close();
})();
