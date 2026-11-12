const H=require('./hp.js'); const SH=__dirname+'/shots/';
const align=()=>{ const c=document.querySelector('#scrollText .cur'); const l=document.querySelector('#scrollLine'); if(!c) return {cur:null}; const cr=c.getBoundingClientRect(), lr=l.getBoundingClientRect(); const fig=[...document.querySelectorAll('#scrollText figure')].map(f=>{const r=f.getBoundingClientRect(); return [f.dataset.img,Math.round(r.top),Math.round(r.height)]}); return {curI:+c.dataset.i, pos:R.pos, off:Math.round(lr.top-cr.top), winA:R.winA, winB:R.winB, fig}; };
(async()=>{
  const b=await H.launch();
  const pg3=await H.page(b,{settings:{mode:'speed',wpm:1000,ramp:false}});
  const id3=await H.importBook(pg3,'/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/rt-modes/assets/pic.epub');
  await pg3.evaluate((id)=>openDoc(id),id3); await H.sleep(800);
  console.log('imgs', await pg3.evaluate(()=>JSON.stringify(R.imgList.map(a=>a.i))), await pg3.evaluate(()=>R.n));
  for(const t of [907, 1300, 1700, 870]){
    await pg3.evaluate((t)=>goTo(t),t); await H.sleep(60);
    const a0=await pg3.evaluate(align); await H.sleep(1500);
    const a1=await pg3.evaluate(align);
    console.log('goTo',t,'imm',JSON.stringify(a0),'\n   1.5s',JSON.stringify(a1));
    await pg3.screenshot({path:SH+'speed_img_'+t+'.png'});
  }
  console.log('errs',pg3.errs);
  await b.close();
})();
