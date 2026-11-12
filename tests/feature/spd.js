const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const touch of [false,true]){
    const ctx=await b.newContext({viewport:touch?{width:390,height:780}:{width:1100,height:800}, deviceScaleFactor:touch?2:1, serviceWorkers:'block', hasTouch:touch, isMobile:touch}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
    await ctx.route(/fonts\.|cdnjs/,r=>r.abort());
    const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto('http://localhost:8750/'); await sleep(500);
    await pg.evaluate(()=>{ S.mode='speed'; saveSettings(); }); await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(900);
    await pg.evaluate(()=>goTo(120)); await sleep(700);
    const geo=()=>pg.evaluate(()=>{ const l=$('#scrollLine').getBoundingClientRect(), c=document.querySelector('#scrollText .cur').getBoundingClientRect(); const cs=getComputedStyle(document.querySelector('#scrollText .cur')); return {bar:[Math.round(l.top),Math.round(l.bottom)], cur:[Math.round(c.top),Math.round(c.bottom)], weight:cs.fontWeight, color:cs.color, base:getComputedStyle($('#scrollText')).color, barOp:getComputedStyle($('#scrollLine')).opacity}; });
    console.log(touch?'touch':'mouse', JSON.stringify(await geo()));
    // click a word 2 lines below the bar
    const target=await pg.evaluate(()=>{ const l=$('#scrollLine').getBoundingClientRect(); for(const s of document.querySelectorAll('#scrollText .w')){ const r=s.getBoundingClientRect(); if(r.top>l.bottom+30 && r.left>80){ return {i:+s.dataset.i,x:r.left+r.width/2,y:r.top+r.height/2}; } } });
    if(touch) await pg.touchscreen.tap(target.x,target.y); else await pg.mouse.click(target.x,target.y);
    await sleep(900);
    console.log(' click word', target.i, '->', await pg.evaluate(()=>[R.pos, R.playing]), JSON.stringify((await geo()).cur));
    // tap empty stage toggles play
    await pg.evaluate(()=>play()); await sleep(600);
    const r=await pg.evaluate(()=>{ const x=$('.reticle').getBoundingClientRect(); return {x:x.left+20,y:x.top+10}; });
    if(touch) await pg.touchscreen.tap(r.x,r.y); else await pg.mouse.click(r.x,r.y); await sleep(500);
    console.log(' tap word box while playing -> playing?', await pg.evaluate(()=>R.playing), errs);
    await pg.screenshot({path:'spd_'+(touch?'t':'m')+'.png'});
    await ctx.close();
  }
  await b.close();
})();
