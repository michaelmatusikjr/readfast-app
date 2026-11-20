const __E=require('../env');
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(__E.launch());
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/fonts\.(googleapis|gstatic)|cdnjs/,r=>r.abort());
  const pg=await ctx.newPage();
  await pg.goto(__E.URL); await sleep(600);
  await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(600);
  await pg.evaluate(()=>{ addHighlight(3,6,3); window.__ev=[]; ['pointerdown','pointerup','pointercancel','click'].forEach(t=>pgView.addEventListener(t,e=>__ev.push(t+':'+(e.target.tagName||'')+':'+e.pointerType),true)); });
  const box=await pg.evaluate(()=>{ const r=document.querySelector('#pgFlow w.hl3').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  await pg.touchscreen.tap(box.x, box.y); await sleep(400);
  console.log(await pg.evaluate(()=>[__ev, hasSelection(), getSelection().toString(), $('#sheet').hidden]));
  await b.close();
})();
