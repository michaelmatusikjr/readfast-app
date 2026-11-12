const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const [w,h,touch] of [[390,780,true],[1280,800,false],[820,1180,true]]){
    const ctx=await b.newContext({viewport:{width:w,height:h}, serviceWorkers:'block', hasTouch:touch, isMobile:touch}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
    await ctx.route(/fonts\.|cdnjs/,r=>r.abort());
    const pg=await ctx.newPage(); pg.on('pageerror',e=>console.log('ERR',e.message));
    await pg.goto('http://localhost:8750/'); await sleep(500);
    for(const mode of ['pages','scroll']){
      await pg.evaluate((m)=>{ S.mode=m; S.margin='normal'; saveSettings(); }, mode); await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(900);
      const out=[];
      for(const v of ['narrow','normal','wide']){
        await pg.evaluate(()=>setChrome(true)); await pg.click('#rAa'); await sleep(500);
        const sel=`#sheet .seg[data-set="margin"] button[data-v="${v}"]`;
        await pg.evaluate((s)=>document.querySelector(s).scrollIntoView({block:'center'}), sel); await sleep(150);
        if(touch) await pg.tap(sel); else await pg.click(sel);
        await sleep(700); await pg.evaluate(()=>closeSheet()); await sleep(200);
        out.push(v+':'+await pg.evaluate(()=>{ const host=R.mode==='pages'?pgFlow:scFlow; let L=1e9,Rr=-1e9; for(const x of host.querySelectorAll('w')){ for(const r of x.getClientRects()){ if(r.right<=0||r.left>=innerWidth||r.width<1) continue; L=Math.min(L,r.left); Rr=Math.max(Rr,r.right);} } return S.margin+' L'+Math.round(L)+' R'+Math.round(innerWidth-Rr); }));
      }
      console.log(w+'x'+h, mode, out.join(' | '));
      await pg.evaluate(()=>closeReader());
    }
    await ctx.close();
  }
  await b.close();
})();
