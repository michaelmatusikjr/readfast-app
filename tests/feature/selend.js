const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', hasTouch:true, isMobile:true, colorScheme:'dark'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); await pg.goto('http://localhost:8750/'); await sleep(1500);
  for(const mode of ['scroll','pages']){
  await pg.evaluate(async m=>{ closeSheet(); S.mode=m; S.font='opendyslexic'; S.lineH=1.5; S.size=20; saveSettings(); applyLook(); if($('#v-reader').hidden) await openDoc(LIB.find(x=>x.kind==='sample').id); else switchMode(m); setChrome(false); }, mode); await sleep(1200);
  // find a paragraph on screen whose last line is short
  const info=await pg.evaluate(()=>{ const h=hostEl(); const ps=[...h.querySelectorAll('p')].filter(p=>{const r=p.getBoundingClientRect(); return r.top>120 && r.bottom<760 && r.width>0 && r.left>=0;});
    for(const p of ps){ const ws=[...p.querySelectorAll('w')]; if(ws.length<12) continue; const last=ws[ws.length-1]; const lr=last.getBoundingClientRect(); const fr=ws[0].getBoundingClientRect(); if(lr.right<innerWidth*0.6 && lr.top>fr.top+5){ return {first:idxOf(ws[0]), last:idxOf(last), fx:fr.left+fr.width/2, fy:fr.top+fr.height/2, lx:lr.right, ly:lr.top+lr.height/2, lh:parseFloat(getComputedStyle(last).lineHeight)}; } } return null; });
  if(!info){ console.log(mode,'no short-last-line paragraph on screen'); continue; }
  await pg.evaluate(async(i)=>{ const w=wordEl(i.first); w.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:i.fx,clientY:i.fy,isPrimary:true})); await new Promise(r=>setTimeout(r,550)); }, info);
  const res=[];
  for(const [dx,dy] of [[60,0],[120,-info.lh*0.4],[200,info.lh*0.4]]){
    const got=await pg.evaluate(([x,y])=>{ hostEl().dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',clientX:x,clientY:y,isPrimary:true})); return TS.b; },[Math.min(385,info.lx+dx), info.ly+dy]);
    res.push(got);
  }
  ok(mode+' end of short last line', res.every(v=>v===info.last), [info.last, res]);
  await pg.evaluate(()=>hostEl().dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch'}))); await sleep(200);
  const hd=await pg.evaluate(()=>{ const B=$('#tsB'), wb=wordEl(TS.b); const r=wb.getBoundingClientRect(); const lh=parseFloat(getComputedStyle(wb).lineHeight); return [parseFloat(B.style.getPropertyValue('--stem')), lh, r.height]; });
  ok(mode+' handle stem within line', hd[0]<=hd[1], hd);
  await pg.screenshot({path:S+'selend_'+mode+'.png'});
  await pg.evaluate(()=>selClear()); await sleep(200);
  }
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
