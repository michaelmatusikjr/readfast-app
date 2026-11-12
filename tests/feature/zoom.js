const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\./,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(500);
  console.log('viewport', await pg.evaluate(()=>[document.querySelector('meta[name=viewport]').content, getComputedStyle(document.body).touchAction]));
  await pg.setInputFiles('#fileIn', __dirname+'/rich.epub'); await pg.waitForFunction(()=>LIB.some(m=>m.title==='Rich Test Book'),null,{timeout:20000});
  await pg.evaluate(()=>{ S.mode='scroll'; S.autoScroll=false; saveSettings(); }); await pg.evaluate(()=>openDoc(LIB.find(m=>m.title==='Rich Test Book').id)); await sleep(700);
  await pg.evaluate(()=>goTo(R.imgList[0].i-5,false)); await sleep(700);
  const box=await pg.evaluate(()=>{ const r=document.querySelector('#scFlow figure img').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  await pg.touchscreen.tap(box.x,box.y); await sleep(600);
  console.log('overlay open', await pg.evaluate(()=>!!$('#imgOverlay')));
  await pg.touchscreen.tap(195,390); await sleep(120); await pg.touchscreen.tap(195,390); await sleep(500);
  console.log('after double tap', await pg.evaluate(()=>[!!$('#imgOverlay'), $('#imgOverlay img').style.transform]));
  await pg.touchscreen.tap(100,600); await sleep(600);
  console.log('single tap while zoomed keeps open', await pg.evaluate(()=>!!$('#imgOverlay')));
  await pg.touchscreen.tap(195,390); await sleep(120); await pg.touchscreen.tap(195,390); await sleep(500);
  console.log('double tap again', await pg.evaluate(()=>$('#imgOverlay img').style.transform));
  await pg.touchscreen.tap(100,600); await sleep(700);
  console.log('single tap at 1x closes', await pg.evaluate(()=>!$('#imgOverlay')));
  await pg.touchscreen.tap(box.x,box.y); await sleep(600); await pg.tap('#imgClose'); await sleep(300);
  console.log('X closes', await pg.evaluate(()=>!$('#imgOverlay')), errs);
  // rapid button taps still register
  await pg.evaluate(()=>switchMode('speed')); await sleep(600); const w0=await pg.evaluate(()=>S.wpm);
  for(let k=0;k<4;k++){ await pg.tap('#wpmUp'); await sleep(90); }
  console.log('4 quick taps on +', w0,'->', await pg.evaluate(()=>S.wpm));
  await b.close();
})();
