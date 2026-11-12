const H=require('../rt-modes/h.js');
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{touch:false,settings:{mode:'scroll',focus:false,autoScroll:false}});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  await pg.evaluate((id)=>openDoc(id),id); await H.sleep(1200);
  await pg.evaluate(()=>goTo(R.SEC[5][0]+50,true)); await H.sleep(500);
  // click a word first (pointerdown sets userScrolled) then relayout via resize to reset it
  await pg.mouse.click(195,400); await H.sleep(300);
  await pg.setViewportSize({width:391,height:780}); await H.sleep(800);
  const a=await pg.evaluate(()=>[R.pos,scPos(),SC.userScrolled,document.activeElement.tagName+'#'+document.activeElement.id]);
  for(let i=0;i<5;i++){ await pg.keyboard.press('PageDown'); await H.sleep(250); }
  await H.sleep(600);
  const c=await pg.evaluate(()=>[R.pos,scPos(),SC.userScrolled, JSON.parse(localStorage.getItem('rf.pos.'+R.meta.id)).pos]);
  console.log('before',a,'after PageDown x5 [R.pos, scPos, userScrolled, savedPos]',c);
  await b.close();
})();
