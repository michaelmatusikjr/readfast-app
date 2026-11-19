const __E=require('../env');
const { chromium } = require('playwright');
const EP=(__E.SCRATCH+'redteam-epub/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(__E.launch());
  for(const focus of [false,true]){
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(__E.URL); await sleep(1200);
  await pg.evaluate(async(f)=>{ S.mode='scroll'; S.focus=f; S.autoScroll=true; saveSettings(); await openDoc('shelf-orthodoxy'); },focus);
  await sleep(1500);
  // user scrolls (touch drag)
  await pg.evaluate(()=>{ const v=$('#scrollView'); v.dispatchEvent(new TouchEvent('touchstart',{bubbles:true})); for(let k=0;k<5;k++){ v.dispatchEvent(new TouchEvent('touchmove',{bubbles:true})); v.scrollTop+=400; } v.dispatchEvent(new TouchEvent('touchend',{bubbles:true})); });
  await sleep(3200);
  // tap to hide controls
  const tap=async()=>{ const r=await pg.evaluate(()=>{ const b=$('#scrollView').getBoundingClientRect(); return [b.left+b.width/2, b.top+b.height/2]; }); await pg.touchscreen.tap(r[0],r[1]); await sleep(400); };
  await tap();
  const st=async()=>pg.evaluate(()=>{ const v=$('#scrollView').getBoundingClientRect(); let top=null; for(const w of document.querySelectorAll('#scFlow w')){ const r=w.getBoundingClientRect(); if(r.top>=v.top-1 && r.bottom<=v.bottom){ top=idxOf(w); break; } } return {chrome:R.chrome, anchor:R.anchor, pos:R.pos, top, winY:window.scrollY, topBar:Math.round($('#rTop').getBoundingClientRect().top)}; });
  const s0=await st(); console.log('focus',focus,'start',s0);
  for(let k=0;k<2;k++){
    await pg.setViewportSize({width:844,height:390}); await sleep(1200); console.log(' landscape', await st());
    await pg.setViewportSize({width:390,height:780}); await sleep(1200); console.log(' portrait', await st());
  }
  console.log(errs); await ctx.close();
  }
  await b.close();
})();
