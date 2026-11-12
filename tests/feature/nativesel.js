const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const touch of [true,false]){
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:touch, isMobile:touch}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); await pg.goto('http://localhost:8750/'); await sleep(1500);
  for(const mode of ['pages','scroll']){
    await pg.evaluate(async m=>{ closeSheet(); S.mode=m; saveSettings(); if($('#v-reader').hidden) await openDoc(LIB.find(x=>x.kind==='sample').id); else switchMode(m); }, mode); await sleep(900);
    const r=await pg.evaluate(async()=>{ const h=hostEl(); const ws=[...h.querySelectorAll('w')].filter(e=>e.getBoundingClientRect().width>0); const w=ws[3];
      const us=getComputedStyle(w).webkitUserSelect||getComputedStyle(w).userSelect;
      const rg=document.createRange(); rg.setStart(ws[3],0); rg.setEnd(ws[6],1); const s=getSelection(); s.removeAllRanges(); s.addRange(rg);
      await new Promise(r=>setTimeout(r,400)); return [us, getSelection().isCollapsed, !$('#selBar').hidden]; });
    console.log(touch?'phone':'desktop', mode, JSON.stringify(r));
    await pg.evaluate(()=>{ try{getSelection().removeAllRanges()}catch(e){} selHide(); });
  }
  console.log('errors', errs); await ctx.close(); }
  await b.close();
})();
