const H=require('../rt-modes/h.js');
(async()=>{ const b=await H.launch();
 for(const touch of [true]){ const pg=await H.page(b,{touch,settings:{mode:'scroll',autoScroll:true,focus:true},fontRoute:async ctx=>{ await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort()); await ctx.route(/localhost:8750\/$/,r=>r.fulfill({path:__dirname+'/patched.html',contentType:'text/html'})); }});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub'); await pg.evaluate(id=>openDoc(id),id); await H.sleep(1200);
  await pg.evaluate(()=>goTo(5000,true)); await H.sleep(600);
  let bad=0, N=20; const res=[];
  for(let k=0;k<N;k++){
    if(touch) await pg.touchscreen.tap(195,400); else await pg.mouse.click(195,400); await H.sleep(700+k*37);
    const a=await pg.evaluate(()=>[SC.auto,R.chrome]);
    if(touch) await pg.touchscreen.tap(195,400); else await pg.mouse.click(195,400); await H.sleep(600);
    const p=await pg.evaluate(()=>[SC.auto,R.chrome]); res.push(a.join()+'>'+p.join()); if(!p[0]&&!p[1]) bad++;
    if(p[0]){ await pg.evaluate(()=>asStop()); await H.sleep(300);} 
  }
  console.log('touch',touch,'paused-with-controls-hidden',bad,'/',N, res.join(' '));
  if(bad){ await pg.screenshot({path:'asrace.png'}); }
  await pg.context().close(); }
 await b.close(); })();
