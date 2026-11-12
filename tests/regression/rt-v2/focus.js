const H=require('../rt-modes/h.js'); const SH=__dirname+'/shots/';
(async()=>{
  const b=await H.launch();
  for(const [w,h] of [[390,780],[844,390]]){
   for(const mode of ['pages','scroll']){
    const pg=await H.page(b,{w,h,settings:{mode,focus:true,autoScroll:mode==='scroll'}});
    const id=await H.importBook(pg,H.FILES+'epub_large.epub');
    await pg.evaluate((id)=>openDoc(id),id); await H.sleep(1200);
    await pg.evaluate(()=>goTo(R.SEC[3][0]+50)); await H.sleep(500);
    const tag=`${mode}_${w}x${h}`;
    await pg.screenshot({path:SH+tag+'_chromeOn.png'});
    const geo=await pg.evaluate(()=>{ const r=s=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.top),Math.round(b.bottom),Math.round(b.left),Math.round(b.right)]}; return {rTop:r('#rTop'),rFoot:r('#rFoot'),pgFlow:r('#pgFlow'),scView:r('#scrollView'),runHead:r('#runHead'),runFoot:r('#runFoot'),reader:r('#v-reader'),asBar:r('#asBar'),overlay:document.querySelector('#v-reader').className}; });
    console.log(tag,'chromeOn',JSON.stringify(geo));
    // hide chrome
    await pg.evaluate(()=>setChrome(false)); 
    if(mode==='scroll'){ await pg.evaluate(()=>{ scView.scrollTop+=300; }); await H.sleep(400); }
    await H.sleep(300);
    await pg.screenshot({path:SH+tag+'_chromeOff.png'});
    // first visible text line vs runHead
    const ov=await pg.evaluate(()=>{ const rh=document.querySelector('#runHead').getBoundingClientRect(), rf=document.querySelector('#runFoot').getBoundingClientRect();
      const host=R.mode==='pages'?pgFlow:scFlow; const ws=[...host.querySelectorAll('w')].filter(w=>{const r=w.getBoundingClientRect(); return r.width>0 && r.right>0 && r.left<innerWidth && r.bottom>0 && r.top<innerHeight;});
      const hitH=ws.filter(w=>{const r=w.getBoundingClientRect(); return r.bottom>rh.top && r.top<rh.bottom && r.left<rh.right-56 && r.right>rh.left+56;}).length;
      const hitF=ws.filter(w=>{const r=w.getBoundingClientRect(); return r.bottom>rf.top && r.top<rf.bottom && r.left<rf.right-56 && r.right>rf.left+56;}).length;
      return {hitH,hitF,rh:[rh.top,rh.bottom],rf:[rf.top,rf.bottom],runHeadText:document.querySelector('#runHead').textContent}; });
    console.log(tag,'chromeOff overlap words with running head/foot',JSON.stringify(ov));
    // toggle focus off via afterSet and check place
    const before=await pg.evaluate(()=>R.pos);
    await pg.evaluate(()=>{ S.focus=false; afterSet('focus'); }); await H.sleep(600);
    const after=await pg.evaluate(()=>[R.pos, document.querySelector('#v-reader').className, R.mode==='pages'?[pgFirstWord(P.page),P.rangeEnd]:scPos()]);
    console.log(tag,'focus off: pos',before,'->',JSON.stringify(after));
    await pg.screenshot({path:SH+tag+'_focusOff.png'});
    await pg.evaluate(()=>{ S.focus=true; afterSet('focus'); }); await H.sleep(600);
    console.log(tag,'focus on again: pos',await pg.evaluate(()=>[R.pos, R.mode==='pages'?[pgFirstWord(P.page),P.rangeEnd]:scPos()]));
    console.log('errs',pg.errs);
    await pg.context().close();
   }
  }
  await b.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
