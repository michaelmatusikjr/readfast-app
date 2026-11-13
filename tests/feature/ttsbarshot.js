const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const w of [320,393]){
  const ctx=await b.newContext({viewport:{width:w,height:800}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  const pg=await ctx.newPage(); await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); S.mode='pages'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); setChrome(true); $('#rTts').click(); const ws=[...pgView.querySelectorAll('w')].filter(x=>x.getBoundingClientRect().width>0); }); await sleep(600); await pg.screenshot({path:S+'ttsbar_hint_'+w+'.png', clip:{x:0,y:500,width:w,height:300}}); await pg.evaluate(()=>{ const ws=[...pgView.querySelectorAll('w')].filter(x=>x.getBoundingClientRect().width>0); ttsPickMark(idxOf(ws[20])); }); await sleep(300);
  const ov=await pg.evaluate(()=>{ const b=$('#ttsBar').getBoundingClientRect(); return [b.width, b.right<=innerWidth, $('#ttsSpeed').getBoundingClientRect().width]; });
  console.log(w, JSON.stringify(ov));
  await pg.screenshot({path:S+'ttsbar_'+w+'.png', clip:{x:0,y:520,width:w,height:280}});
  await ctx.close(); }
  await b.close();
})();
