const H=require('../rt-modes/h.js');
const TTF='/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf';
(async()=>{
  const b=await H.launch();
  for(const scen of ['scrollUser','autoscroll','speedPlay','pagesTTSlike']){
  const fontRoute=async(ctx)=>{
    await ctx.route(/fonts\.googleapis\.com/,r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Literata';font-weight:400;src:url(https://fonts.gstatic.com/lit${Math.random()}.ttf) format('truetype')}`}));
    await ctx.route(/fonts\.gstatic\.com/,async r=>{ await H.sleep(4000); r.fulfill({path:TTF,contentType:'font/ttf'}); });
  };
  const mode=scen.startsWith('scroll')||scen==='autoscroll'?'scroll':scen.startsWith('speed')?'speed':'pages';
  const pg=await H.page(b,{fontRoute,settings:{mode,focus:false,font:'original',turn:'none',autoScroll:scen==='autoscroll'}});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  const pg2=await pg.context().newPage(); pg2.errs=[]; pg2.on('pageerror',e=>pg2.errs.push(e.message)); await pg2.goto('http://localhost:8750/'); await H.sleep(300);
  await pg2.evaluate((id)=>{ window.__rl=0; for(const m of ['pages','scroll','speed']){ const f=MODES[m].relayout; MODES[m].relayout=function(){ window.__rl++; return f.apply(this,arguments); }; } return openDoc(id); },id); await H.sleep(300);
  await pg2.evaluate(()=>goTo(R.SEC[100][0]+300)); await H.sleep(200);
  const t0=Date.now(); let log=[];
  if(scen==='scrollUser'){ await pg2.mouse.move(195,400); while(Date.now()-t0<6000){ await pg2.mouse.wheel(0,120); await H.sleep(100); log.push(await pg2.evaluate(()=>[R.pos,scPos(),window.__rl])); } }
  if(scen==='autoscroll'){ await pg2.evaluate(()=>{ S.scrollWpm=600; asStart(); }); while(Date.now()-t0<6000){ await H.sleep(250); log.push(await pg2.evaluate(()=>[R.pos,scPos(),SC.auto,window.__rl])); } }
  if(scen==='speedPlay'){ await pg2.evaluate(()=>{ S.wpm=600; play(); }); while(Date.now()-t0<6000){ await H.sleep(250); log.push(await pg2.evaluate(()=>[R.pos,R.playing,window.__rl,R.winA])); } }
  if(scen==='pagesTTSlike'){ while(Date.now()-t0<6000){ await H.sleep(500); log.push(await pg2.evaluate(()=>[R.pos,pgFirstWord(P.page),P.rangeEnd,window.__rl])); } }
  // detect backwards jumps
  const back=[]; for(let i=1;i<log.length;i++){ if(log[i][0]<log[i-1][0]) back.push([log[i-1],log[i]]); }
  console.log(scen,'relayouts',log[log.length-1], 'first',log[0],'backjumps',JSON.stringify(back.slice(0,4)),'errs',pg2.errs);
  if(scen==='scrollUser'){ console.log(' tail', JSON.stringify(log.slice(-8))); }
  await pg.context().close();
  }
  await b.close();
})();
