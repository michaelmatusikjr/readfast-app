// touch swipe page turn via CDP; footnote tap; image tap overlay; search flash in pages
const H=require('./h.js');
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{settings:{mode:'pages',focus:false,turn:'slide'}});
  const id=await H.importBook(pg,H.RICH);
  await pg.evaluate((id)=>openDoc(id),id); await H.sleep(700);
  const cdp=await pg.context().newCDPSession(pg);
  const swipe=async(x0,x1,y=400)=>{ await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y}]}); for(let k=1;k<=6;k++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+(x1-x0)*k/6,y}]}); await H.sleep(16);} await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await H.sleep(450); };
  const s0=await pg.evaluate(()=>[P.k,P.page]); await swipe(300,100); const s1=await pg.evaluate(()=>[P.k,P.page]); await swipe(100,300); const s2=await pg.evaluate(()=>[P.k,P.page]);
  console.log('swipe left/right', s0,s1,s2);
  // footnote tap
  await pg.evaluate(()=>goTo(0)); await H.sleep(300);
  const fn=await pg.evaluate(()=>{ const w=document.querySelector('#pgFlow w.n'); const r=w.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; });
  await pg.touchscreen.tap(fn.x,fn.y); await H.sleep(300);
  console.log('footnote marker size', Math.round(fn.w),'x',Math.round(fn.h), 'tap ->', await pg.evaluate(()=>$('#sheet').hidden?'none':$('#sheet h2').textContent));
  await pg.evaluate(()=>closeSheet());
  // image tap
  await pg.evaluate(()=>{ const f=document.querySelector('#pgFlow figure'); }); 
  const img=await pg.evaluate(async()=>{ const i=R.imgList[0].i; await goTo(i); const f=document.querySelector('#pgFlow figure img'); const r=f.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,page:P.page,figPage:pgPageOfEl(f)}; });
  await pg.touchscreen.tap(img.x,img.y); await H.sleep(300);
  console.log('image tap', img, !!(await pg.$('#imgOverlay')));
  await pg.touchscreen.tap(img.x,img.y); await H.sleep(300);
  console.log('image overlay closed', !(await pg.$('#imgOverlay')));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
