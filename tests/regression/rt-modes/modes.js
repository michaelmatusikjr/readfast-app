// mode switching drift, auto-scroll + focus chrome, speed-mode taps, keyboard
const H=require('./h.js');
const SH=__dirname+'/shots/';
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{settings:{mode:'pages',focus:true,autoScroll:true,scrollWpm:300,asRamp:false,asPauses:false}});
  const big=await H.importBook(pg,H.FILES+'epub_large.epub');
  await pg.evaluate((id)=>openDoc(id),big); await H.sleep(1500);
  const log=(...a)=>console.log(...a);
  log('opened', await pg.evaluate(()=>[R.meta.title,R.n,R.SEC.length,R.mode]));
  // 1. mode-switch drift: jump to mid-paragraph word, cycle modes
  await pg.evaluate(()=>goTo(81234,true)); await H.sleep(500);
  const seq=[];
  for(let c=0;c<6;c++){ for(const m of ['scroll','pages','speed','pages']){ await pg.evaluate((m)=>switchMode(m),m); await H.sleep(500); seq.push(m[0]+':'+await pg.evaluate(()=>R.pos)); } }
  log('drift', seq.join(' '));
  // 2. scroll: R.pos after entering vs word at top
  await pg.evaluate(()=>switchMode('scroll')); await H.sleep(800);
  log('scroll entry', await pg.evaluate(()=>[R.pos, scPos(), scFlow.children.length, [...scFlow.children].map(s=>s._k).join(',')]));
  // 3. auto-scroll accuracy: words passing the reading line per minute
  const acc=await pg.evaluate(async()=>{ asStart(); await new Promise(r=>setTimeout(r,1500)); const y=asLineY(); const a=wordAtY(y), t=performance.now(); await new Promise(r=>setTimeout(r,20000)); const b2=wordAtY(asLineY()), t2=performance.now(); asStop(); return {wpmSet:S.scrollWpm, wpmMeasured:Math.round((b2-a)/((t2-t)/60000)), pxps:SC.pxps.toFixed(1), secs:[...scFlow.children].map(s=>s._k).join(',')}; });
  log('autoscroll accuracy', JSON.stringify(acc));
  // 4. auto-scroll + focus: tap to start, tap to pause, can chrome come back?
  await pg.evaluate(()=>{ setChrome(true); }); await H.sleep(200);
  await pg.touchscreen.tap(195,400); await H.sleep(800);
  log('after tap1 (start)', await pg.evaluate(()=>({auto:SC.auto, chrome:R.chrome})));
  await pg.touchscreen.tap(195,400); await H.sleep(500);
  log('after tap2 (pause)', await pg.evaluate(()=>({auto:SC.auto, chrome:R.chrome})));
  await pg.screenshot({path:SH+'as_paused_focus.png'});
  await pg.touchscreen.tap(195,400); await H.sleep(500);
  log('after tap3', await pg.evaluate(()=>({auto:SC.auto, chrome:R.chrome})));
  await pg.touchscreen.tap(195,400); await H.sleep(500);
  log('after tap4', await pg.evaluate(()=>({auto:SC.auto, chrome:R.chrome})));
  // tap top area/bottom area
  await pg.touchscreen.tap(195,30); await H.sleep(400);
  log('after tap top bar area', await pg.evaluate(()=>({auto:SC.auto, chrome:R.chrome, sheet:!$('#sheet').hidden})));
  await pg.touchscreen.tap(195,740); await H.sleep(400);
  log('after tap bottom bar area', await pg.evaluate(()=>({auto:SC.auto, chrome:R.chrome})));
  await pg.evaluate(()=>{ if(SC.auto) asStop(); setChrome(true); });
  // 5. Speed mode: tapping the stage while playing
  await pg.evaluate(()=>switchMode('speed')); await H.sleep(800);
  log('speed enter ms', await pg.evaluate(async()=>{ await switchMode('pages'); const t=performance.now(); await switchMode('speed'); return Math.round(performance.now()-t)+'ms, spans='+document.querySelectorAll('#scrollText .w').length; }));
  await pg.evaluate(()=>play()); await H.sleep(1500);
  const p0=await pg.evaluate(()=>[R.playing,R.pos]);
  await pg.touchscreen.tap(195,250); await H.sleep(300);
  const p1=await pg.evaluate(()=>[R.playing,R.pos]);
  await H.sleep(700);
  log('speed stage tap while playing', p0, '->', p1, '-> 700ms later', await pg.evaluate(()=>[R.playing,R.pos]));
  await pg.evaluate(()=>pause());
  // keyboard: focus stage then space
  await pg.evaluate(()=>$('#stage').focus());
  await pg.keyboard.press(' '); await H.sleep(500);
  log('space on focused stage -> playing?', await pg.evaluate(()=>R.playing));
  await pg.evaluate(()=>pause());
  log('errs', pg.errs);
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
