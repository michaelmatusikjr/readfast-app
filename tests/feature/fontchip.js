const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const w of [320,390]){
  const ctx=await b.newContext({viewport:{width:w,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  const pg=await ctx.newPage(); await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); await openDoc(LIB.find(m=>m.kind==='sample').id); S.mode='pages'; openPanel(); }); await sleep(500);
  await pg.evaluate(async()=>{ await document.fonts.load('16px OpenDyslexic'); const c=document.querySelector('.fontgrid [data-v="opendyslexic"]'); c.scrollIntoView({block:'center'}); }); await sleep(500);
  const r=await pg.evaluate(()=>[...document.querySelectorAll('.fontgrid .chip')].map(c=>[c.dataset.v, c.scrollWidth<=c.clientWidth+1]));
  console.log(w, JSON.stringify(r.filter(x=>!x[1])), 'overflowing');
  const el=await pg.$('.fontgrid'); await el.screenshot({path:'/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/fontgrid_'+w+'.png'});
  await ctx.close(); }
  await b.close();
})();
