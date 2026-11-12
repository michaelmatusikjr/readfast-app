const H=require('../rt-modes/h.js');
(async()=>{ const b=await H.launch();
 for(const [w,h] of [[844,390],[667,375],[932,430]]){ const pg=await H.page(b,{w,h,settings:{mode:'speed'}});
  const id=await H.importBook(pg,H.RICH); await pg.evaluate(id=>openDoc(id),id); await H.sleep(1200); await pg.evaluate(()=>goTo(60,true)); await H.sleep(400);
  const m=()=>pg.evaluate(()=>{ const q=s=>{ const r=document.querySelector(s).getBoundingClientRect(); return [Math.round(r.top),Math.round(r.bottom)]; }; return {vh:innerHeight, body:q('#rBody'), view:q('#speedView'), stage:q('#stage'), reticle:q('#stage .reticle'), word:q('#word'), context:q('#context'), tools:q('#pauseTools'), scrub:q('.scrub'), controls:q('.controls'), play:q('#playBtn'), speed:q('#speedView .speed'), scrollH:$('#speedView').scrollHeight, clientH:$('#speedView').clientHeight}; });
  console.log(w+'x'+h,'paused',JSON.stringify(await m())); await pg.screenshot({path:`spl_${w}_paused.png`});
  await pg.evaluate(()=>play()); await H.sleep(700); console.log(w+'x'+h,'playing',JSON.stringify(await m())); await pg.screenshot({path:`spl_${w}_playing.png`});
  await pg.context().close(); }
 await b.close(); })();
