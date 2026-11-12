const H=require('../rt-modes/h.js');
(async()=>{ const b=await H.launch();
for(const [w,h] of [[390,780],[844,390]]){
  const pg=await H.page(b,{w,h});
  const id=await H.importBook(pg,H.RICH);
  await pg.evaluate(id=>openDoc(id),id); await H.sleep(900);
  for(const mode of ['pages','scroll']){
    await pg.evaluate(m=>switchMode(m),mode); await H.sleep(700);
    for(const as of (mode==='scroll'?[false,true]:[false])){
      await pg.evaluate(a=>{S.autoScroll=a; asUI();},as); await H.sleep(200);
      await pg.evaluate(()=>goTo(300,true)); await H.sleep(600);
      const r=await pg.evaluate(()=>{ const q=s=>document.querySelector(s).getBoundingClientRect(); const top=q('#rTop'), foot=q('#rFoot');
        const host=R.mode==='pages'?pgFlow:scFlow; const view=(R.mode==='pages'?pgView:scView).getBoundingClientRect();
        let minT=1e9,maxB=-1e9,cov=0; for(const x of host.querySelectorAll('w')){ for(const r of x.getClientRects()){ if(r.right<view.left+1||r.left>view.right-1||r.bottom<view.top||r.top>view.bottom) continue; minT=Math.min(minT,r.top); maxB=Math.max(maxB,r.bottom); if(r.top<top.bottom-1||r.bottom>foot.top+1) cov++; } }
        const pw=wordEl(R.pos); return {mode:R.mode, chrome:R.chrome, overlay:$('#v-reader').classList.contains('overlay'), topB:top.bottom, footT:foot.top, footH:foot.height, viewT:view.top, viewB:view.bottom, minT, maxB, coveredRects:cov, posTop:pw&&pw.getBoundingClientRect().top, runHead:q('#runHead').top, runFoot:q('#runFoot').bottom}; });
      console.log(w+'x'+h, 'as='+as, JSON.stringify(r));
      await pg.screenshot({path:`geo_${w}_${mode}_${as}.png`});
    }
  }
  console.log('errs',pg.errs); await pg.context().close();
}
await b.close(); })();
