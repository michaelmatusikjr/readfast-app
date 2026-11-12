const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  for(const [w,h] of [[390,780],[430,932],[820,1180],[1280,800],[600,900]]){
    const ctx=await b.newContext({viewport:{width:w,height:h}, serviceWorkers:'block'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
    await ctx.route(/fonts\.(googleapis|gstatic)|cdnjs/,r=>r.abort());
    const pg=await ctx.newPage(); await pg.goto('http://localhost:8750/'); await sleep(500);
    await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(700);
    for(let k=0;k<2;k++){
      console.log(w+'x'+h, 'page', k, await pg.evaluate(()=>{ let L=1e9,R=-1e9; const vw=innerWidth; for(const x of pgFlow.querySelectorAll('w')){ for(const r of x.getClientRects()){ if(r.right<=0||r.left>=vw||r.width<1) continue; L=Math.min(L,r.left); R=Math.max(R,r.right); } } return {left:Math.round(L), right:Math.round(vw-R), two:P.g.two, inner:P.g.inner}; }));
      await pg.evaluate(()=>{ setChrome(false); return pgTurn(1); }); await sleep(500);
    }
    if(w===390||w===1280) await pg.screenshot({path:'c_'+w+'.png'});
    await ctx.close();
  }
  await b.close();
})();
