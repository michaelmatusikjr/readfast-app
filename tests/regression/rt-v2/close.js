const H=require('../rt-modes/h.js');
(async()=>{
  const b=await H.launch(); const pg=await H.page(b,{settings:{mode:'pages',focus:true,turn:'fade'}});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  const run=async(name,fn)=>{ pg.errs.length=0; const r=await pg.evaluate(fn,id).catch(e=>'THROW '+e.message); await H.sleep(800); console.log(name.padEnd(28), JSON.stringify(r), pg.errs.filter(e=>!/ERR_FAILED/.test(e))); };
  await run('pages fade turn+close', async(id)=>{ await openDoc(id); const p=pgTurn(1); closeReader(); await p; return [R.meta, R.mode]; });
  await run('goTo then close', async(id)=>{ await openDoc(id); const p=goTo(50000,true); closeReader(); await p; return [R.meta,R.mode]; });
  await run('scroll autoscroll close', async(id)=>{ S.mode='scroll'; S.autoScroll=true; await openDoc(id); asStart(); await new Promise(r=>setTimeout(r,500)); closeReader(); await new Promise(r=>setTimeout(r,300)); return [SC.auto, R.meta]; });
  await run('speed play close', async(id)=>{ S.mode='speed'; await openDoc(id); play(); await new Promise(r=>setTimeout(r,300)); closeReader(); return [R.playing]; });
  await run('after close: setWpm/resize/night', async()=>{ setWpm(420); window.dispatchEvent(new Event('resize')); S.nightAuto=true; applyLook(); document.fonts.dispatchEvent(new Event('loadingdone')); await new Promise(r=>setTimeout(r,400)); S.nightAuto=false; return 'ok'; });
  await run('open during openDoc race', async(id)=>{ S.mode='pages'; const p=openDoc(id); closeReader(); await p; return [!!R.meta, R.mode, $('#v-reader').hidden]; });
  await run('delete open book in lib', async(id)=>{ return LIB.length; });
  await b.close();
})();
