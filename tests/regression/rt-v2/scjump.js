const H=require('../rt-modes/h.js'); const SH=__dirname+'/shots/';
(async()=>{
  const b=await H.launch();
  for(const focus of [true,false]){
  const pg=await H.page(b,{settings:{mode:'scroll',focus,autoScroll:false}});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  await pg.evaluate((id)=>openDoc(id),id); await H.sleep(1200);
  const tgt=await pg.evaluate(()=>R.SEC[5][0]+333);
  await pg.evaluate((t)=>goTo(t,true),tgt); await H.sleep(600);
  const r=await pg.evaluate((t)=>{ const w=wordEl(t).getBoundingClientRect(); const top=document.querySelector('#rTop').getBoundingClientRect(); return {chrome:R.chrome, wordTop:w.top, wordBottom:w.bottom, barBottom:top.bottom, covered:w.bottom<=top.bottom+2, pos:R.pos}; },tgt);
  console.log('focus',focus,JSON.stringify(r));
  await pg.screenshot({path:SH+'scjump_focus'+focus+'.png'});
  await pg.context().close();
  }
  await b.close();
})();
