const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  let fetched=0;
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/kokoro-js/, r=>{ fetched++; r.fulfill({path:S+'tooz/t/fakekokoro.mjs', contentType:'application/javascript', headers:{'access-control-allow-origin':'*'}}); });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{ if(m.type()==='error' && !/ERR_TUNNEL|ERR_FAILED/.test(m.text())) errs.push('console: '+m.text()); });
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); S.mode='pages'; S.ttsEngine='premium'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(800);
  ok('default engine natural', await pg.evaluate(()=>S.ttsEngine==='premium' && S.kokVoice==='af_heart'));
  await pg.evaluate(()=>openPanel()); await sleep(600);
  const p1=await pg.evaluate(()=>[!!$('#o_kvoice'), $('#o_kvoice').options.length, $('#kokState').textContent]);
  ok('panel natural voices', p1[0] && p1[1]===16 && /Not downloaded/.test(p1[2]), p1);
  await pg.evaluate(()=>closeSheet()); await sleep(500);
  // play: download sheet, then reading with word marks
  await pg.evaluate(()=>$('#rTts').click()); await sleep(250);
  const dl=await pg.evaluate(()=>[!$('#sheet').hidden && $('#sheet').textContent.includes('Getting the natural voice ready'), ($('#kokTxt')||{}).textContent]);
  ok('download progress sheet', dl[0], dl);
  await sleep(1500);
  const r1=await pg.evaluate(()=>[TTS.on, KOK.ready, TTS.cur, $('#sheet').hidden, !!document.querySelector('w.tts')]);
  ok('ready and reading', r1[0] && r1[1] && r1[2]>=0 && r1[3] && r1[4], r1);
  const c0=await pg.evaluate(()=>TTS.cur); await sleep(2500);
  const c1=await pg.evaluate(()=>[TTS.cur, KOK.audio && !KOK.audio.paused, TTS.kq.length]);
  ok('words advance while audio plays', c1[0]>c0+5 && c1[1], [c0,c1]);
  // jump while reading
  await pg.evaluate(()=>goTo(200,true)); await sleep(1200);
  ok('jump stops reading (lands paused)', await pg.evaluate(()=>!TTS.on && KOK.audio.paused && !document.querySelector('w.tts') && TTS.kq.length===0));
  // second start: no download sheet
  await pg.evaluate(()=>$('#rTts').click()); await sleep(600);
  ok('second start instant, from the jump point', await pg.evaluate(()=>TTS.on && $('#sheet').hidden && TTS.cur>=200), await pg.evaluate(()=>TTS.cur));
  await pg.evaluate(()=>$('#rTts').click()); await sleep(200);
  // panel: downloaded + preview speed + voice change
  await pg.evaluate(()=>openPanel()); await sleep(600);
  ok('state downloaded', await pg.evaluate(()=>/Downloaded/.test($('#kokState').textContent)));
  await pg.selectOption('#o_kvoice','bm_george'); await sleep(200);
  ok('voice saved', await pg.evaluate(()=>S.kokVoice==='bm_george'));
  await pg.evaluate(()=>document.querySelector('[data-act="vprev"]').click()); await sleep(800);
  const sp=await pg.evaluate(()=>$('#kokSpeed').textContent); ok('preview speed report', /Made [\d.]+ seconds of speech/.test(sp), sp);
  // switch to iPhone engine
  await pg.evaluate(()=>document.querySelector('[data-set="ttsEngine"] [data-v="system"]').click()); await sleep(500);
  ok('iphone engine panel', await pg.evaluate(()=>S.ttsEngine==='system' && !!$('#o_voice') && !$('#o_kvoice') && !/Enhanced and Premium/.test($('#sheet').textContent)));
  ok('dedupe', await pg.evaluate(()=>{ const fake=[{name:'Samantha',voiceURI:'a',lang:'en-US',localService:true},{name:'Samantha',voiceURI:'b',lang:'en-GB',localService:true},{name:'Daniel',voiceURI:'c',lang:'en-GB',localService:true}]; const o=ttsVoices; window.ttsVoices=()=>fake; TTS.voices=fake; const r=systemVoices('en'); return r.length; })===2);
  await pg.evaluate(()=>document.querySelector('[data-set="ttsEngine"] [data-v="premium"]').click()); await sleep(500);
  await pg.evaluate(()=>document.querySelector('[data-act="kokdel"]').click()); await sleep(600);
  ok('remove download', await pg.evaluate(()=>/Not downloaded/.test($('#kokState').textContent) && !KOK.ready && !LS.get('kokReady',false)));
  ok('engine fetched once per worker', fetched>=1, fetched);
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
