// image-only pages: position, relayout, reopen; tall image fits
const H=require('./h.js'); const SH=__dirname+'/shots/';
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{settings:{mode:'pages',focus:false,turn:'none'}});
  const id=await H.importBook(pg,__dirname+'/assets/pic.epub');
  await pg.evaluate((id)=>openDoc(id),id); await H.sleep(800);
  console.log('meta', await pg.evaluate(()=>({title:R.meta.title, n:R.n, secs:R.SEC, imgs:R.imgList, chapters:R.meta.chapters.map(c=>[c.t,c.i])})));
  const walk=await pg.evaluate(async()=>{ await goTo(0); const out=[]; for(let t=0;t<40;t++){ const fr=pgFlow.getBoundingClientRect(); const figs=[...pgFlow.querySelectorAll('figure')].filter(f=>{ const r=f.getBoundingClientRect(); return Math.floor((r.left-fr.left+2)/P.g.stride)===P.page; }).map(f=>f.dataset.img); out.push({k:P.k,page:P.page,of:P.pages,pos:R.pos,word:R.words[R.pos],firstWordPage:pgPageOfEl(wordEl(R.pos)),figs:figs.join(',')}); const a=[P.k,P.page]; await pgTurn(1); await new Promise(r=>setTimeout(r,30)); if(P.k===a[0]&&P.page===a[1]) break; } return out; });
  walk.forEach(w=>console.log(JSON.stringify(w)));
  // go to the plate page (image-only), then relayout and see where we land
  const plate=walk.find(w=>w.figs&&w.firstWordPage!==w.page);
  if(plate){
    await pg.evaluate(async(p)=>{ await pgShow(R.SEC[p.k][0]); pgSet(p.page,false); R.pos=pgFirstWord(P.page); }, plate);
    await pg.screenshot({path:SH+'pic_plate.png'});
    const before=await pg.evaluate(()=>[P.k,P.page,R.pos]);
    await pg.evaluate(async()=>{ await MODES.pages.relayout(); });
    console.log('image-only page', before, '-> after relayout', await pg.evaluate(()=>[P.k,P.page,R.pos]));
    await pg.evaluate(async(p)=>{ await pgShow(R.SEC[p.k][0]); pgSet(p.page,false); R.pos=pgFirstWord(P.page); }, plate);
    await pg.evaluate(()=>switchMode('scroll')); await H.sleep(500); await pg.evaluate(()=>switchMode('pages')); await H.sleep(500);
    console.log('image-only page -> scroll -> pages', await pg.evaluate(()=>[P.k,P.page,R.pos]));
    await pg.evaluate(async(p)=>{ await pgShow(R.SEC[p.k][0]); pgSet(p.page,false); R.pos=pgFirstWord(P.page); }, plate);
    console.log('bookmark range on image page', await pg.evaluate(()=>[pgFirstWord(P.page), P.rangeEnd]));
  }
  console.log('errs',pg.errs);
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
