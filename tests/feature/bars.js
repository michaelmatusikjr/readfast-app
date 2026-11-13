const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:393,height:852}, deviceScaleFactor:2, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500); await pg.evaluate(()=>closeSheet()); await sleep(300);
  /* simulate the iPhone home-indicator inset (34px) */
  await pg.addStyleTag({content:'#tabs{padding-bottom:34px!important} #rFoot{padding-bottom:34px!important}'});
  console.log('tabs', await pg.evaluate(()=>$('#tabs').getBoundingClientRect().height));
  await pg.screenshot({path:S+'bars_tabs.png', clip:{x:0,y:700,width:393,height:152}});
  await pg.evaluate(async()=>{ S.mode='pages'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); setChrome(true); }); await sleep(900);
  console.log('foot', await pg.evaluate(()=>$('#rFoot').getBoundingClientRect().height));
  await pg.screenshot({path:S+'bars_reader.png', clip:{x:0,y:652,width:393,height:200}});
  console.log('errors', errs);
  await b.close();
})();
