const __E=require('../env');
const { chromium } = require('playwright');
const S=__E.SCRATCH;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true,isMobile:true});
  await ctx.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; try{ localStorage.setItem('rf.tourDone','1'); }catch(e){}; });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  const hide=async(h)=>pg.evaluate(h=>{ Object.defineProperty(document,'hidden',{get:()=>h,configurable:true}); Object.defineProperty(document,'visibilityState',{get:()=>h?'hidden':'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); },h);
  await pg.evaluate(async()=>{ closeSheet(); S.mode='scroll'; S.autoScroll=false; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); });
  await sleep(800);
  /* scroll down like a reader would */
  await pg.evaluate(()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; scView.scrollTop+=1300; }); await sleep(600);
  await pg.evaluate(()=>{ SC.gestureAt=performance.now(); scView.dispatchEvent(new Event('scroll')); }); await sleep(400);
  /* don't depend on where a fixed scroll lands: if the top line is a section start (a heading), read on a line or two */
  for(let i=0;i<12 && await pg.evaluate(()=>R.SEC.some(s=>s[0]===scPos()));i++){
    await pg.evaluate(()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; scView.scrollTop+=30; }); await sleep(250);
    await pg.evaluate(()=>{ SC.gestureAt=performance.now(); scView.dispatchEvent(new Event('scroll')); }); await sleep(250);
  }
  const top=await pg.evaluate(()=>{ const k=scPos(); return {k, w:R.words[k], prev:R.words[k-1]}; });
  await hide(true); await sleep(200); await hide(false); await sleep(900);
  const r=await pg.evaluate(()=>{ const t=scFlow.querySelector('.tear'); if(!t) return null; const tr=t.getBoundingClientRect(), v=scView.getBoundingClientRect();
    const after=t.nextElementSibling&&t.nextElementSibling.querySelector('w'), before=t.previousElementSibling&&[...t.previousElementSibling.querySelectorAll('w')].pop();
    return {tear:+t.dataset.tear, mid:Math.round(tr.top+tr.height/2), vmid:Math.round(v.top+v.height/2), after:after&&after.textContent, before:before&&before.textContent, h:Math.round(tr.height), label:t.textContent.trim(), pos:R.pos, ls:LS.get('tear.'+R.meta.id)}; });
  ok('tear placed before the top line in view', r && r.tear===top.k && r.after.trim()===top.w && r.ls===top.k, [top, r]);
  ok('tear centred on return', r && Math.abs(r.mid-r.vmid)<3, r);
  ok('says Previously read', r && /Previously read/i.test(r.label));
  ok('reading place unchanged', r && r.pos===top.k);
  await pg.screenshot({path:S+'tear_light.png'});
  /* leave again without scrolling: the tear is on screen, so it stays */
  await hide(true); await hide(false); await sleep(700);
  ok('quick switch without scrolling keeps the tear', await pg.evaluate(k=>+scFlow.querySelector('.tear').dataset.tear===k && scFlow.querySelectorAll('.tear').length===1, top.k));
  /* read on, leave, return: tear moves */
  await pg.evaluate(()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; scView.scrollTop+=1500; }); await sleep(500);
  await pg.evaluate(()=>{ SC.gestureAt=performance.now(); scView.dispatchEvent(new Event('scroll')); }); await sleep(400);
  const top2=await pg.evaluate(()=>scPos());
  await hide(true); await hide(false); await sleep(800);
  ok('after reading on, the tear moves', await pg.evaluate(k=>{ const t=scFlow.querySelectorAll('.tear'); return t.length===1 && +t[0].dataset.tear===k; }, top2), top2);
  /* close the book and reopen */
  await pg.evaluate(async()=>{ const id=R.meta.id; closeReader(true); await new Promise(r=>setTimeout(r,300)); await openDoc(id); }); await sleep(1000);
  const r2=await pg.evaluate(()=>{ const t=scFlow.querySelector('.tear'); if(!t) return null; const tr=t.getBoundingClientRect(), v=scView.getBoundingClientRect(); return {tear:+t.dataset.tear, d:Math.round(tr.top+tr.height/2-(v.top+v.height/2))}; });
  ok('reopening the book shows it centred', r2 && r2.tear===top2 && Math.abs(r2.d)<3, r2);
  /* a tear on the first word of a section (a heading) is shown too */
  const k0=await pg.evaluate(async()=>{ const s=R.SEC.find(s=>s[0]>scPos()+50)||R.SEC[R.SEC.length-1]; goTo(s[0]); await new Promise(r=>setTimeout(r,500)); SC.gestureAt=performance.now(); scView.dispatchEvent(new Event('scroll')); await new Promise(r=>setTimeout(r,300)); return {k:scPos(), a:s[0]}; });
  await hide(true); await sleep(200); await hide(false); await sleep(900);
  ok('a tear on a section start is shown', await pg.evaluate(k=>{ const t=scFlow.querySelectorAll('.tear'); return t.length===1 && +t[0].dataset.tear===k; }, k0.k) && k0.k===k0.a, k0);
  /* dark theme look */
  await pg.evaluate(()=>{ S.theme='dark'; saveSettings(); applyLook(); }); await sleep(300); await pg.evaluate(()=>tearCenterNow()); await sleep(200);
  await pg.screenshot({path:S+'tear_dark.png'});
  /* pages mode never shows it */
  await pg.evaluate(async()=>{ S.theme='light'; S.mode='pages'; saveSettings(); applyLook(); await setMode('pages'); }).catch(()=>{});
  await sleep(800);
  ok('pages mode has no tear', await pg.evaluate(()=>!document.querySelector('#pgFlow .tear')));
  ok('no page errors', !errs.length, errs);
  await b.close();
})();
