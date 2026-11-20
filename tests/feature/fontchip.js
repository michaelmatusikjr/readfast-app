const __E=require('../env');
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(__E.launch());
  for(const w of [320,390]){
  const ctx=await b.newContext({viewport:{width:w,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  const pg=await ctx.newPage(); await pg.goto(__E.URL); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); await openDoc(LIB.find(m=>m.kind==='sample').id); S.mode='pages'; openPanel(); }); await sleep(500);
  await pg.evaluate(async()=>{ await document.fonts.load('16px OpenDyslexic'); const c=document.querySelector('.fontgrid [data-v="opendyslexic"]'); c.scrollIntoView({block:'center'}); }); await sleep(500);
  const r=await pg.evaluate(()=>[...document.querySelectorAll('.fontgrid .chip')].map(c=>[c.dataset.v, c.scrollWidth<=c.clientWidth+1]));
  console.log(w, JSON.stringify(r.filter(x=>!x[1])), 'overflowing');
  const el=await pg.$('.fontgrid'); await el.screenshot({path:__E.SCRATCH+'fontgrid_'+w+'.png'});
  await ctx.close(); }
  await b.close();
})();
