const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const [w,h,tag] of [[390,780,'p'],[844,390,'l']]){
    const ctx=await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:1, serviceWorkers:'block'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
    await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
    await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
    const pg=await ctx.newPage(); pg.on('pageerror',e=>console.log('ERR',e.message));
    await pg.goto('http://localhost:8750/'); await sleep(600);
    await pg.setInputFiles('#fileIn', __dirname+'/rich.epub');
    await pg.waitForFunction(()=>LIB.some(m=>m.title==='Rich Test Book'),null,{timeout:20000}); await sleep(300);
    await pg.evaluate(()=>{ S.mode='scroll'; S.focus=true; saveSettings(); });
    await pg.evaluate(()=>openDoc(LIB.find(m=>m.title==='Rich Test Book').id)); await sleep(900);
    await pg.evaluate(()=>goTo(900,true)); await sleep(600);
    await pg.screenshot({path:`v_${tag}_scroll_on.png`});
    await pg.evaluate(()=>setChrome(false)); await sleep(350);
    await pg.screenshot({path:`v_${tag}_scroll_off.png`});
    // visible-word overlap with running head/foot, honouring the scroll view's clip
    console.log(tag,'scroll overlap', await pg.evaluate(()=>{ const v=scView.getBoundingClientRect(); const rh=$('#runHead').getBoundingClientRect(), rf=$('#runFoot').getBoundingClientRect(); let n=0; for(const x of scFlow.querySelectorAll('w')){ const r=x.getBoundingClientRect(); const top=Math.max(r.top,v.top), bot=Math.min(r.bottom,v.bottom); if(bot<=top) continue; if((top<rh.bottom&&bot>rh.top)||(top<rf.bottom&&bot>rf.top)) n++; } return {n, view:[v.top,v.bottom], rh:[rh.top,rh.bottom], rf:[rf.top,rf.bottom]}; }));
    await pg.evaluate(()=>switchMode('pages')); await sleep(700);
    await pg.screenshot({path:`v_${tag}_pages_on.png`});
    const before=await pg.evaluate(()=>[P.page,R.pos,R.chrome]);
    await pg.evaluate(()=>pgTurn(1)); await sleep(400);
    const mid=await pg.evaluate(()=>[P.page,R.pos,R.chrome]);
    await pg.screenshot({path:`v_${tag}_pages_off.png`});
    await pg.evaluate(()=>pgTurn(1)); await sleep(500);
    console.log(tag,'pages turn', before, mid, await pg.evaluate(()=>[P.page,R.pos,R.chrome]));
    await ctx.close();
  }
  await b.close();
})();
