const H=require('../rt-modes/h.js');
(async()=>{ const b=await H.launch(); const SPD='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
 for(const zones of ['edges','anywhere']){ const pg=await H.page(b,{settings:{mode:'pages',focus:true,tapZones:zones}});
  const st=()=>pg.evaluate(()=>[P.k,P.page,P.pages,R.pos,R.chrome,!!$('#imgOverlay'),!$('#toast').hidden&&$('#toastMsg').textContent]);
  const tap=async(x,y)=>{ await pg.touchscreen.tap(x,y); await H.sleep(500); };
  const id=await H.importBook(pg,SPD+'rt-modes/assets/pic.epub'); await pg.evaluate(id=>openDoc(id),id); await H.sleep(1200);
  console.log(zones,'pic open',await st()); await tap(350,400); console.log(' tap right edge on cover (bars showing)',await st()); await tap(350,400); console.log(' tap again',await st()); await tap(350,400); console.log(' tap again',await st()); await tap(350,400); console.log(' tap again',await st());
  await pg.evaluate(()=>{ const o=$('#imgOverlay'); o&&o.remove(); }); await tap(382,400); console.log(' tap in right margin x=382',await st());
  await pg.evaluate(()=>goTo(R.n-1,true)); await H.sleep(600); console.log(' at end',await st());
  for(let k=0;k<4;k++){ await tap(382,400); console.log('  fwd',await st()); }
  await tap(8,400); console.log('  back',await st()); await tap(195, zones==='edges'?400:40); console.log('  show bars',await st()); await tap(8,400); console.log('  back with bars',await st());
  await pg.evaluate(()=>setChrome(true)); await pg.keyboard.press('ArrowRight'); await H.sleep(400); console.log('  key right (bars on)',await st()); await pg.keyboard.press('ArrowRight'); await H.sleep(400); console.log('  key right',await st()); await pg.keyboard.press('ArrowLeft'); await H.sleep(400); console.log('  key left',await st());
  await pg.context().close(); }
 await b.close(); })();
