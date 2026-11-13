const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required']});
  for(const variant of ['gpu','nogpu']){
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', hasTouch:true, isMobile:true});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; if(!navigator.gpu) Object.defineProperty(Navigator.prototype,'gpu',{value:{requestAdapter:async()=>({})},configurable:true}); });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/kokoro-js/, r=>r.fulfill({path:S+'tooz/t/'+(variant==='gpu'?'fakekokoro.mjs':'fakekokoro_nogpu.mjs'), contentType:'application/javascript', headers:{'access-control-allow-origin':'*'}}));
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); S.mode='pages'; S.ttsEngine='premium'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(800);
  await pg.evaluate(()=>{ window.__dbg=null; openPanel(); }); await sleep(600);
  const p1=await pg.evaluate(()=>[S.kokDevice, !!document.querySelector('[data-set="kokDevice"]'), $('#sheet').textContent.includes('330 MB')]);
  ok(variant+' engine choice shown, faster default', p1[0]==='webgpu' && p1[1] && p1[2], p1);
  await pg.evaluate(()=>document.querySelector('[data-act="vprev"]').click()); await sleep(variant==='gpu'?250:60);
  const sheetTxt=await pg.evaluate(()=>(($('#kokState')||{}).textContent||'')+' '+$('#sheet').textContent.slice(0,140));
  if(variant==='gpu') ok(variant+' download progress mentions 330 MB', /330 MB/.test(sheetTxt), sheetTxt.slice(0,120));
  await sleep(2000);
  if(variant==='gpu'){
    await pg.evaluate(()=>openPanel()); await sleep(700);
    await pg.evaluate(()=>{ KOK.w.addEventListener('message',e=>{ if(e.data.type==='dbg') window.__dbg=e.data; }); document.querySelector('[data-act="vprev"]').click(); }); await sleep(1200); console.log('dbgstate', await pg.evaluate(()=>[KOK.ready, !!KOK.w, $('#sheet').hidden, ($('#sheet h2')||{}).textContent, document.body.innerText.match(/couldn.t[^\n]*/i)?.[0]]));
    const r=await pg.evaluate(()=>[window.__dbg, KOK.dev, ($('#kokSpeed')||{}).textContent, LS.get('kokReady.webgpu',false)]);
    ok('gpu: loaded on webgpu fp32', r[0]&&r[0].dev==='webgpu'&&r[0].dtype==='fp32'&&r[1]==='webgpu'&&/Faster engine/.test(r[2]||'')&&r[3], r);
    await pg.evaluate(()=>document.querySelector('[data-set="kokDevice"] [data-v="wasm"]').click()); await sleep(500);
    ok('switch to standard resets engine and shows 90 MB', await pg.evaluate(()=>S.kokDevice==='wasm' && !KOK.ready && $('#sheet').textContent.includes('90 MB')));
  } else {
    const r=await pg.evaluate(()=>[S.kokDevice, document.body.innerText.match(/faster engine didn.t work[^\n]*/i)?.[0]]);
    ok('nogpu: falls back to standard with a message', r[0]==='wasm' && !!r[1], r);
    await pg.evaluate(()=>{ closeSheet(); $('#rTts').click(); }); await sleep(2500);
    ok('nogpu: standard engine plays', await pg.evaluate(()=>TTS.on && KOK.ready && KOK.dev==='wasm'));
    await pg.evaluate(()=>ttsStop());
  }
  ok(variant+' no page errors', errs.length===0, errs);
  await ctx.close(); }
  await b.close();
})();
