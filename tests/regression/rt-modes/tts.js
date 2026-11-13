// read aloud with stubbed speechSynthesis: boundary mapping, page following, stop, interaction with page turns/mode switch
const H=require('./h.js');
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{settings:{mode:'pages',focus:false,turn:'none',ttsEngine:'system'}});
  await pg.addInitScript(()=>{});
  // stub: emits word boundaries every 20ms, onend after the last
  await pg.evaluate(()=>{
    window.__spoken=[]; window.__cancels=0;
    const fake={ speaking:false, q:[], getVoices(){ return []; }, addEventListener(){},
      cancel(){ window.__cancels++; this.q.forEach(u=>{ clearInterval(u._t); u.onerror&&u.onerror({error:'interrupted'}); }); this.q=[]; },
      speak(u){ window.__spoken.push(u.text.slice(0,40)); this.q.push(u); const re=/\S+/g; const idx=[]; let m; while((m=re.exec(u.text))) idx.push(m.index); let k=0;
        u._t=setInterval(()=>{ if(k<idx.length){ u.onboundary&&u.onboundary({name:'word',charIndex:idx[k++]}); } else { clearInterval(u._t); this.q=this.q.filter(x=>x!==u); u.onend&&u.onend({}); } }, window.__rate||20); } };
    Object.defineProperty(window,'speechSynthesis',{value:fake,configurable:true});
    window.SpeechSynthesisUtterance=function(t){ this.text=t; };
  });
  const rich=await H.importBook(pg,H.RICH);
  await pg.evaluate((id)=>openDoc(id),rich); await H.sleep(800);
  // start, let it run across a page boundary
  const r=await pg.evaluate(async()=>{
    const log=[]; ttsStart(); const p0=P.page, k0=P.k;
    for(let t=0;t<60;t++){ await new Promise(r=>setTimeout(r,50)); const w=document.querySelector('#pgFlow w.tts'); const vis=w?pgPageOfEl(w)===P.page:null; log.push([R.pos,TTS.cur,P.k,P.page,vis]); }
    return {start:[k0,p0], bad:log.filter(l=>l[4]===false).length, nulls:log.filter(l=>l[4]===null).length, mismatch:log.filter(l=>l[0]!==l[1]).length, end:log[log.length-1], pagesSeen:[...new Set(log.map(l=>l[2]+':'+l[3]))]};
  });
  console.log('tts follow', JSON.stringify(r));
  // manual page turn while reading aloud
  const t1=await pg.evaluate(async()=>{ const a=[P.k,P.page,TTS.cur]; await pgTurn(1); await new Promise(r=>setTimeout(r,120)); return {before:a, after:[P.k,P.page,TTS.cur,TTS.on]}; });
  console.log('page turn during tts', JSON.stringify(t1));
  // jump via TOC (goTo) -> must stop
  await pg.evaluate(()=>goTo(R.SEC[2][0],true)); await H.sleep(200);
  console.log('after goTo', await pg.evaluate(()=>({on:TTS.on, cur:TTS.cur, tts:document.querySelectorAll('w.tts').length})));
  // start, then switch mode to scroll
  await pg.evaluate(()=>ttsStart()); await H.sleep(300);
  await pg.evaluate(()=>switchMode('scroll')); await H.sleep(400);
  console.log('after mode switch', await pg.evaluate(()=>({on:TTS.on, mode:R.mode})));
  // scroll mode follow
  await pg.evaluate(()=>{ window.__rate=15; ttsStart(); }); await H.sleep(4000);
  console.log('scroll follow', await pg.evaluate(()=>{ const w=document.querySelector('#scFlow w.tts'); if(!w) return 'no tts word'; const r=w.getBoundingClientRect(), v=scView.getBoundingClientRect(); return {cur:TTS.cur,pos:R.pos, top:Math.round(r.top-v.top), vh:Math.round(v.height)}; }));
  // user scrolls away while reading
  await pg.evaluate(()=>{ scView.scrollTop-=1500; }); await H.sleep(300);
  console.log('user scrolled up during tts', await pg.evaluate(()=>({on:TTS.on,cur:TTS.cur,pos:R.pos,scPos:scPos()})));
  await H.sleep(1500);
  console.log(' 1.5s later', await pg.evaluate(()=>({on:TTS.on,cur:TTS.cur,pos:R.pos,scPos:scPos()})));
  await pg.evaluate(()=>ttsStop());
  // end of book
  await pg.evaluate(()=>switchMode('pages')); await pg.evaluate(()=>goTo(R.n-5)); await pg.evaluate(()=>ttsStart()); await H.sleep(800);
  console.log('end of book', await pg.evaluate(()=>({on:TTS.on, toast:$('#toastMsg').textContent, tts:document.querySelectorAll('w.tts').length})));
  // utterance chunk boundaries: does a chunk end mid-sentence & does text include glued punctuation?
  console.log('spoken chunks', await pg.evaluate(()=>__spoken.slice(0,4)));
  // hidden page -> visibilitychange stops TTS (screen lock)
  await pg.evaluate(()=>ttsStart()); await H.sleep(100);
  await pg.evaluate(()=>{ Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
  console.log('after visibility hidden', await pg.evaluate(()=>TTS.on));
  console.log('errs',pg.errs);
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
