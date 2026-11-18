const __E=require('../env');
const { chromium } = require('playwright');
const S=__E.SCRATCH;
const P=S+'pip/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', hasTouch:true, isMobile:true});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const hf=[]; const cors={'access-control-allow-origin':'*'};
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/onnxruntime-web\/1\.18\.0\/(.*)/, r=>{ const f=r.request().url().split('/').pop(); r.fulfill({path:__E.NM+'onnxruntime-web/dist/'+f, headers:Object.assign({'content-type':f.endsWith('.wasm')?'application/wasm':'application/javascript'},cors)}); });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@diffusionstudio\/piper-wasm@1\.0\.0\/build\/(.*)/, r=>{ const f=r.request().url().split('/').pop(); r.fulfill({path:__E.NM+'@diffusionstudio/piper-wasm/build/'+f, headers:Object.assign({'content-type':f.endsWith('.wasm')?'application/wasm':'application/octet-stream'},cors)}); });
  await ctx.route(/huggingface\.co/, r=>{ const u=r.request().url(); hf.push(u.replace(/^.*resolve\/main\//,'')); const big=u.endsWith('.onnx'); const body=fs.readFileSync(__E.FEAT+'fake-piper/'+(big?'model.onnx':'model.json'));
    r.fulfill({body, headers:Object.assign({'content-length':String(body.length)},cors)}); });
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip/, r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',headers:cors}));
  await ctx.addInitScript(()=>{ try{ if(!localStorage.getItem('rf.kokGone')){ localStorage.setItem('rf.kokReady.webgpu','true'); } }catch(e){} });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{ if(m.type()==='error' && !/ERR_TUNNEL|ERR_FAILED|ERR_CONNECTION/.test(m.text())) errs.push('console '+m.text()); });
  await pg.goto('http://localhost:8750/'); await sleep(300);
  await pg.evaluate(async()=>{ const c=await caches.open('kokoro-voices'); await c.put('https://x/af_heart.bin', new Response('x')); localStorage.setItem('rf.kokReady.webgpu','true'); localStorage.removeItem('rf.kokGone'); });
  await pg.reload(); await sleep(1800);
  ok('kokoro leftovers cleared', await pg.evaluate(async()=>!(await caches.keys()).includes('kokoro-voices') && localStorage.getItem('rf.kokReady.webgpu')==null && LS.get('kokGone',false)));
  ok('whats new present', await pg.evaluate(()=>WHATSNEW.length>=1));
  await pg.evaluate(async()=>{ closeSheet(); S.mode='scroll'; S.autoScroll=true; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(1000);
  ok('scroll: auto-scroll bar shown first', await pg.evaluate(()=>!$('#asBar').hidden && $('#ttsBar').hidden));
  await pg.evaluate(()=>$('#rTts').click()); await sleep(300);
  ok('speaker opens floating pill without playing', await pg.evaluate(()=>{
    const b=$('#ttsBar'), foot=$('#rFoot');
    const st=getComputedStyle(b);
    return $('#asBar').hidden && !b.hidden && !TTS.on && TTS.mode && !foot.contains(b) && st.position==='absolute' && b.getBoundingClientRect().width>40 && b.getBoundingClientRect().width<360 && !$('#ttsPlay').classList.contains('sr-only') && $('#ttsVoice').classList.contains('sr-only') && $('#ttsPrev').classList.contains('sr-only');
  }));
  // tap a word to pick
  const pick=await pg.evaluate(()=>{ const ws=[...scFlow.querySelectorAll('w')].filter(w=>{const r=w.getBoundingClientRect(); return r.top>300&&r.top<500&&r.width>0;}); const w=ws[2]; readerTap({target:w, clientX:0, clientY:0}); return idxOf(w); });
  await sleep(200);
  ok('tap word picks start', await pg.evaluate(p=>TTS.pick===p && !!document.querySelector('w.ttspick') && !TTS.on, pick), pick);
  // natural voice is not downloaded yet: play must start on the phone voice without blocking
  await pg.evaluate(()=>$('#ttsPlay').click()); await sleep(800);
  const fb=await pg.evaluate(()=>[TTS.on, TTS.nat, TTS.cur, ($('#ttsNatChip').hidden?'' : ($('#ttsNatChip').textContent||'')), $('#ttsPlay').getAttribute('aria-label'), ($('#toast').hidden || !/more natural voice/i.test($('#toastMsg').textContent||''))]);
  ok('play without download uses the phone voice and offers the better one', fb[0] && fb[1]===false && fb[2]>=pick && fb[4]==='Pause' && /Better voice available/.test(fb[3]) && fb[5], [pick,fb]);
  await pg.evaluate(()=>$('#ttsPlay').click()); await sleep(300);
  ok('pause after phone-voice start', await pg.evaluate(()=>!TTS.on && TTS.mode));
  ok('natural voice still not forced-downloaded', await pg.evaluate(async()=>!(await natDownloaded())));
  // now download (fake piper in this test) and continue on the natural path
  ok('download natural voice', await pg.evaluate(async()=>!!(await natEnsure())));
  await pg.evaluate(()=>{ if(TTS.pick==null && pick!=null) ttsPickMark(pick); $('#ttsPlay').click(); }); await sleep(2500);
  const r1=await pg.evaluate(()=>[TTS.on, TTS.nat, TTS.cur, $('#ttsPlay').getAttribute('aria-label'), !document.querySelector('w.ttspick')]);
  ok('play starts at picked word on the natural voice', r1[0] && r1[1] && r1[2]>=pick && r1[2]<pick+40 && r1[3]==='Pause' && r1[4], [pick,r1]);
  // jump by tapping word while playing
  const jump=await pg.evaluate(()=>{ const ws=[...scFlow.querySelectorAll('w')].filter(w=>{const r=w.getBoundingClientRect(); return r.top>550&&r.width>0;}); const w=ws[5]||ws[0]; readerTap({target:w, clientX:0, clientY:0}); return idxOf(w); });
  await sleep(1500);
  ok('tap word while playing jumps there', await pg.evaluate(j=>TTS.on && TTS.cur>=j && TTS.cur<j+40, jump), [jump, await pg.evaluate(()=>TTS.cur)]);
  // speed live
  await pg.evaluate(()=>$('#ttsSpeed').click()); await sleep(200);
  ok('speed chip cycles to the next rate', await pg.evaluate(()=>Math.abs(S.ttsRate-1.25)<1e-9 && $('#ttsLabel').textContent==='1.25×'), await pg.evaluate(()=>[S.ttsRate, $('#ttsLabel').textContent]));
  await pg.evaluate(()=>ttsSetRate(1));
  // next sentence: swipe left on the pill (hidden next button remains for assistive use)
  const c0=await pg.evaluate(()=>TTS.cur);
  await pg.evaluate(()=>{
    const el=$('#ttsLabel'); const r=el.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
    const bar=$('#ttsBar');
    bar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:21,clientX:x,clientY:y}));
    bar.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:21,clientX:x-80,clientY:y}));
    bar.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:21,clientX:x-80,clientY:y}));
  });
  await sleep(1200);
  const c1=await pg.evaluate(()=>[TTS.cur, isSentEnd(sentStartOf(TTS.cur)-1)]);
  ok('next sentence by swipe', c1[0]>c0, [c0,c1]);
  // pause keeps place
  await pg.evaluate(()=>$('#ttsPlay').click()); await sleep(300);
  const pz=await pg.evaluate(()=>[TTS.on, TTS.pick, !$('#ttsBar').hidden, $('#ttsPlay').getAttribute('aria-label')]);
  ok('pause keeps controls and place', !pz[0] && pz[1]>=c1[0] && pz[2] && pz[3]==='Play', pz);
  await pg.evaluate(()=>{
    const el=$('#ttsLabel'); const r=el.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
    const bar=$('#ttsBar');
    bar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:22,clientX:x,clientY:y}));
    bar.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:22,clientX:x+80,clientY:y}));
    bar.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:22,clientX:x+80,clientY:y}));
  }); await sleep(300);
  ok('previous sentence by swipe while paused moves the start', await pg.evaluate(p=>TTS.pick<p, pz[1]));
  // long-press opens the voice sheet
  await pg.evaluate(async()=>{
    const el=$('#ttsLabel'); const r=el.getBoundingClientRect(); const x=r.left+4, y=r.top+r.height/2;
    const bar=$('#ttsBar');
    bar.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:23,clientX:x,clientY:y}));
    await new Promise(res=>setTimeout(res, 650));
    bar.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:23,clientX:x,clientY:y}));
  });
  await sleep(400);
  ok('long-press opens voice sheet', await pg.evaluate(()=>!$('#sheet').hidden && /Voice/.test($('#sheet').innerText||'')));
  await pg.evaluate(()=>closeSheet()); await sleep(200);
  // close
  await pg.evaluate(()=>$('#rTts').click()); await sleep(300);
  ok('speaker again closes controls, auto-scroll bar back', await pg.evaluate(()=>$('#ttsBar').hidden && !$('#asBar').hidden && !TTS.mode && !document.querySelector('w.ttspick')));
  // auto-scroll start closes audio mode
  await pg.evaluate(()=>$('#rTts').click()); await sleep(200); await pg.evaluate(()=>asStart()); await sleep(200);
  ok('starting auto-scroll closes audio controls', await pg.evaluate(()=>!TTS.mode && $('#ttsBar').hidden && SC.auto)); await pg.evaluate(()=>asStop(true));
  // pages mode: tap word picks rather than turning page
  await pg.evaluate(async()=>{ await switchMode('pages'); }); await sleep(800);
  await pg.evaluate(()=>$('#rTts').click()); await sleep(200);
  const pp=await pg.evaluate(()=>{ const pg0=P.page; const ws=[...pgView.querySelectorAll('w')].filter(w=>{const r=w.getBoundingClientRect(); return r.left>innerWidth*0.75&&r.width>0&&r.top>200;}); const w=ws[0]; readerTap({target:w, clientX:w.getBoundingClientRect().left+2, clientY:w.getBoundingClientRect().top+2}); return [pg0, P.page, TTS.pick===idxOf(w)]; });
  ok('pages: tapping a word at the edge picks it (no page turn)', pp[0]===pp[1] && pp[2], pp);
  await pg.evaluate(()=>closeReader()); await sleep(800); await pg.evaluate(()=>closeSheet());
  ok('closing the book closes controls', await pg.evaluate(()=>!TTS.mode && !TTS.on));
  // remove all voices
  ok('a voice is downloaded', await pg.evaluate(()=>pipDownloaded('en_US-lessac-medium')));
  await pg.evaluate(()=>showView('settings')); await sleep(600);
  await pg.evaluate(()=>$('#rmVoices').click()); await sleep(700);
  await pg.evaluate(()=>document.querySelector('#sheet [data-act="yes"]').click()); await sleep(1200);
  ok('remove all voices', await pg.evaluate(async()=>!(await pipDownloaded('en_US-lessac-medium')) && /Removed 1 voice/.test(document.body.innerText)), await pg.evaluate(()=>document.body.innerText.match(/Removed[^\n]*|No downloaded[^\n]*/)?.[0]));
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
