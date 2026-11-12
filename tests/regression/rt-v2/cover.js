const H=require('../rt-modes/h.js'); const SH=__dirname+'/shots/';
(async()=>{
  const b=await H.launch();
  for(const [w,h,sz] of [[390,780,16],[390,780,18],[390,780,20],[390,780,22],[390,780,24],[844,390,18]]){
    const pg=await H.page(b,{w,h,settings:{mode:"pages",focus:true,size:sz}});
    const id=await H.importBook(pg,H.FILES+'epub_large.epub');
    await pg.evaluate((id)=>openDoc(id),id); await H.sleep(1200);
    await pg.evaluate(()=>goTo(R.SEC[3][0]+50, true)); await H.sleep(500);
    const r=await pg.evaluate(()=>{ const t=document.querySelector('#rTop').getBoundingClientRect(), f=document.querySelector('#rFoot').getBoundingClientRect();
      const a=pgFirstWord(P.page), e=P.rangeEnd; const hid=[];
      for(let k=a;k<e;k++){ const w=wordEl(k); if(!w) continue; const rr=w.getBoundingClientRect(); const cy=(rr.top+rr.bottom)/2; if(cy<t.bottom||cy>f.top) hid.push(k+':'+R.words[k]); }
      return {chrome:R.chrome, page:[a,e], hiddenWords:hid.length, sample:hid.slice(0,12), foot:[f.top,f.bottom], top:t.bottom}; });
    console.log(w+"x"+h+" size"+sz, JSON.stringify(r));
    // after turning page forward, the previous page's covered words: were they ever shown uncovered? (chrome hides only after turn)
    await pg.evaluate(()=>pgTurn(1)); await H.sleep(500); console.log(' after turn chrome',await pg.evaluate(()=>R.chrome));
    await pg.context().close();
  }
  await b.close();
})();
