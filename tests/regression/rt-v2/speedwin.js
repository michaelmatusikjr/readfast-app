const H=require('../rt-modes/h.js'); const SH=__dirname+'/shots/';
const align=()=>{ const c=document.querySelector('#scrollText .cur'); const l=document.querySelector('#scrollLine'); if(!c) return {cur:null}; const cr=c.getBoundingClientRect(), lr=l.getBoundingClientRect(); return {curI:+c.dataset.i, pos:R.pos, off:Math.round(lr.top-cr.top), curH:Math.round(cr.height), winA:R.winA, winB:R.winB}; };
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{settings:{mode:'speed',wpm:1000,ramp:false,multi:false}});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  await pg.evaluate((id)=>openDoc(id),id); await H.sleep(800);
  await pg.evaluate(()=>goTo(5000)); await H.sleep(500);
  console.log('after goTo', JSON.stringify(await pg.evaluate(align)));
  // play across the edge
  await pg.evaluate(()=>{ goTo(R.winB-50); }); await H.sleep(500);
  console.log('near edge', JSON.stringify(await pg.evaluate(align)));
  await pg.evaluate(()=>play()); 
  const seen=[]; for(let i=0;i<20;i++){ await H.sleep(150); seen.push(await pg.evaluate(align)); }
  await pg.evaluate(()=>pause()); await H.sleep(500);
  console.log('playing across edge: winA set', [...new Set(seen.map(s=>s.winA))], 'maxoff', Math.max(...seen.map(s=>Math.abs(s.off))), 'curMismatch', seen.filter(s=>s.curI!==s.pos).length, 'final', JSON.stringify(await pg.evaluate(align)));
  // tap a word in the background near window edge (manually drag then click)
  const r=await pg.evaluate(()=>{ const sp=[...document.querySelectorAll('#scrollText .w')]; const t=sp[sp.length-5]; return null; });
  // scrub change
  await pg.evaluate(()=>{ el.scrub.value=100000; el.scrub.dispatchEvent(new Event('change')); }); await H.sleep(500);
  console.log('scrub', JSON.stringify(await pg.evaluate(align)));
  // end of book
  await pg.evaluate(()=>goTo(R.n-3)); await H.sleep(500);
  console.log('end', JSON.stringify(await pg.evaluate(align)));
  await pg.evaluate(()=>goTo(0)); await H.sleep(500);
  console.log('start', JSON.stringify(await pg.evaluate(align)));
  // back word / back sentence across window start edge
  await pg.evaluate(()=>goTo(3000)); await H.sleep(300);
  const wa=await pg.evaluate(()=>R.winA);
  for(let i=0;i<10;i++) await pg.evaluate(()=>$('#bSent').click());
  await H.sleep(500);
  console.log('back sentences', wa, JSON.stringify(await pg.evaluate(align)));
  // drag background
  const box=await pg.evaluate(()=>{ const r=$('#scrollBg').getBoundingClientRect(); return [r.left+r.width/2, r.top+40]; });
  await pg.mouse.move(box[0],box[1]+200); await pg.mouse.down(); for(let i=1;i<=20;i++){ await pg.mouse.move(box[0],box[1]+200-i*60); await H.sleep(16); } await pg.mouse.up(); await H.sleep(300);
  await pg.screenshot({path:SH+'speed_drag.png'});
  const vis=await pg.evaluate(()=>{ const sp=[...document.querySelectorAll('#scrollText .w')].filter(s=>{const r=s.getBoundingClientRect(); return r.bottom>0&&r.top<innerHeight;}); return [sp.length, sp.length?+sp[0].dataset.i:null, sp.length?+sp[sp.length-1].dataset.i:null, R.pos]; });
  console.log('after drag up 1200px visible words', vis);
  console.log('errs',pg.errs);
  await pg.context().close();
  // short book
  const pg2=await H.page(b,{settings:{mode:'speed'}});
  await pg2.evaluate(async()=>{ const t=fromPlainText('Hi there. Short.'); }).catch(e=>console.log('x',e.message));
  await pg2.context().close();
  // images
  const pg3=await H.page(b,{settings:{mode:'speed',wpm:1000,ramp:false}});
  const id3=await H.importBook(pg3,H.FILES+'epub_imgheavy.epub');
  await pg3.evaluate((id)=>openDoc(id),id3); await H.sleep(800);
  const imgs=await pg3.evaluate(()=>R.imgList.map(a=>a.i).slice(0,30));
  console.log('img positions', imgs.join(','), 'n', await pg3.evaluate(()=>R.n));
  const target=imgs.find(i=>i>900)||imgs[imgs.length-1];
  await pg3.evaluate((t)=>goTo(t),target); await H.sleep(80);
  const a0=await pg3.evaluate(align); await H.sleep(1200);
  const a1=await pg3.evaluate(align);
  console.log('goTo word after image: immediately',JSON.stringify(a0),'after 1.2s',JSON.stringify(a1));
  await pg3.screenshot({path:SH+'speed_img.png'});
  console.log('errs',pg3.errs);
  await b.close();
})();
