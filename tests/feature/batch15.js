const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:393,height:852}, deviceScaleFactor:2, serviceWorkers:'block', hasTouch:true, isMobile:true});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); S.mode='pages'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(900);
  // Aa
  await pg.evaluate(()=>openPanel()); await sleep(700);
  const aa=await pg.evaluate(()=>({ folds:[...document.querySelectorAll('#sheet details.aadet summary')].map(x=>x.textContent), open:document.querySelectorAll('#sheet details[open]').length, quickFonts:document.querySelectorAll('#sheet .fontrow button').length, size:!!document.querySelector('#sheet [data-step="size"]'), themes:!!document.querySelector('#sheet .themes'), h:document.querySelector('#sheet .sheet-body').scrollHeight }));
  ok('Aa quick: size, theme, 4 fonts; folded: text, pages', aa.size&&aa.themes&&aa.quickFonts===4&&aa.open===0&&JSON.stringify(aa.folds)===JSON.stringify(['More text options','Pages']), aa);
  await pg.screenshot({path:S+'aa_closed.png'});
  // size stepper
  const s0=await pg.evaluate(()=>S.size); await pg.evaluate(()=>document.querySelector('#sheet [data-step="size"][data-d="1"]').click()); await sleep(200);
  ok('text size +', await pg.evaluate(v=>S.size===v+1,s0)); await pg.evaluate(()=>document.querySelector('#sheet [data-step="size"][data-d="-1"]').click());
  // quick font
  await pg.evaluate(()=>document.querySelectorAll('#sheet .fontrow button')[1].click()); await sleep(300);
  const f1=await pg.evaluate(()=>S.font); ok('quick font changes font', f1!=='literata', f1);
  await pg.evaluate(()=>{ S.font='literata'; saveSettings(); applyLook(); refreshPanel(); }); await sleep(300);
  await pg.evaluate(()=>closeSheet()); await sleep(300);

  // Scroll mode: Aa folds + auto-scroll button
  await pg.evaluate(async()=>{ await switchMode('scroll'); S.autoScroll=false; saveSettings(); asUI(); updateChrome(); }); await sleep(800);
  ok('scroll: auto-scroll button shown, bar hidden', await pg.evaluate(()=>!$('#rAs').hidden && $('#asBar').hidden));
  await pg.evaluate(()=>$('#rAs').click()); await sleep(300);
  ok('auto-scroll button opens the bar', await pg.evaluate(()=>S.autoScroll && !$('#asBar').hidden && $('#rAs').classList.contains('on')));
  await pg.screenshot({path:S+'scroll_as.png'});
  await pg.evaluate(()=>$('#asMore').click()); await sleep(600);
  ok('⋯ opens auto-scroll options', await pg.evaluate(()=>/Ease into speed/.test($('#sheet').textContent) && /Pause at pictures/.test($('#sheet').textContent)));
  await pg.evaluate(()=>{ const t=document.querySelector('#sheet input[data-set="asPauses"]'); t.checked=!t.checked; t.dispatchEvent(new Event('change',{bubbles:true})); }); await sleep(200);
  await pg.evaluate(()=>closeSheet()); await sleep(400);
  await pg.evaluate(()=>$('#rTts').click()); await sleep(300);
  ok('speaker replaces auto-scroll bar', await pg.evaluate(()=>$('#asBar').hidden && !$('#ttsBar').hidden && !$('#rAs').classList.contains('on')));
  await pg.evaluate(()=>$('#ttsVoice').click()); await sleep(700);
  const vs=await pg.evaluate(()=>({t:$('#sheet h2').textContent, natural:!!document.querySelector('#sheet [data-set="ttsEngine"]'), list:!!$('#o_pvoice'), speed:!!document.querySelector('#sheet [data-set="ttsRate"]'), state:($('#kokState')||{}).textContent}));
  ok('voice button opens Voice sheet', vs.t==='Voice' && vs.natural && vs.list && !vs.speed && /download/i.test(vs.state||''), vs);
  await pg.screenshot({path:S+'voice_sheet.png'});
  await pg.evaluate(()=>document.querySelector('#sheet [data-set="ttsEngine"] [data-v="system"]').click()); await sleep(400);
  ok('voice sheet redraws for iPhone voices', await pg.evaluate(()=>!!$('#o_voice') && !$('#o_pvoice') && !$('#sheet').hidden));
  await pg.evaluate(()=>{ document.querySelector('#sheet [data-set="ttsEngine"] [data-v="natural"]').click(); }); await sleep(300);
  await pg.evaluate(()=>{ closeSheet(); $('#rTts').click(); }); await sleep(400);
  ok('closing audio brings auto-scroll bar back', await pg.evaluate(()=>!$('#asBar').hidden));
  await pg.evaluate(()=>$('#rAs').click()); await sleep(300);
  ok('auto-scroll button again hides bar', await pg.evaluate(()=>!S.autoScroll && $('#asBar').hidden));
  await pg.evaluate(()=>openPanel()); await sleep(600);
  ok('scroll Aa: Scrolling fold', await pg.evaluate(()=>[...document.querySelectorAll('#sheet details.aadet summary')].map(x=>x.textContent).join()==='More text options,Scrolling'));
  await pg.evaluate(()=>closeSheet()); await sleep(300);
  // Speed: gear
  await pg.evaluate(async()=>{ await switchMode('speed'); }); await sleep(800);
  ok('speed: no auto-scroll button', await pg.evaluate(()=>$('#rAs').hidden));
  await pg.evaluate(()=>$('#spOpts').click()); await sleep(600);
  ok('gear opens speed options', await pg.evaluate(()=>/Speed reading options/.test($('#sheet h2').textContent) && !!document.querySelector('#sheet input[data-set="sentPause"]')));
  await pg.evaluate(()=>{ const t=document.querySelector('#sheet input[data-set="ramp"]'); t.checked=!S.ramp; t.dispatchEvent(new Event('change',{bubbles:true})); }); await sleep(300);
  ok('speed options redraw (ramp length)', await pg.evaluate(()=>!!document.querySelector('#sheet input[data-set="rampSecs"]')===!!S.ramp));
  await pg.screenshot({path:S+'speed_opts.png'});
  await pg.evaluate(()=>closeSheet()); await sleep(300);
  await pg.evaluate(()=>openPanel()); await sleep(600);
  ok('speed Aa: word size + Word display + Light', await pg.evaluate(()=>!!document.querySelector('#sheet [data-step="speedSize"]') && [...document.querySelectorAll('#sheet details.aadet summary')].map(x=>x.textContent).join()==='Word display'));
  const ws0=await pg.evaluate(()=>S.speedSize); await pg.evaluate(()=>document.querySelector('#sheet [data-step="speedSize"][data-d="2"]').click()); await sleep(200);
  ok('word size + steps by 2 within 24–72', await pg.evaluate(v=>S.speedSize===Math.min(72,v+2), ws0));
  await pg.evaluate(async()=>{ closeSheet(); await switchMode('pages'); closeReader(); }); await sleep(900); await pg.evaluate(()=>closeSheet());
  // Settings page
  await pg.evaluate(()=>showView('settings')); await sleep(700);
  const st=await pg.evaluate(()=>({h2:[...document.querySelectorAll('#settingsBody h2')].map(x=>x.textContent.trim())}));
  ok('Settings sections app-wide only', JSON.stringify(st.h2)===JSON.stringify(['Reading','Light','Backup and restore','Storage','Library','Adding books','Help','Erase all data']) && !/Page turn|Speed ramp|Natural/.test(await pg.evaluate(()=>$('#settingsBody').textContent)), st);
  await pg.evaluate(()=>{ const r=document.querySelector('#lightSet input[data-set="dim"]'); r.value='20'; r.dispatchEvent(new Event('input',{bubbles:true})); }); await sleep(200);
  await pg.evaluate(()=>{ const t=document.querySelector('#lightSet input[data-set="nightAuto"]'); t.checked=true; t.dispatchEvent(new Event('change',{bubbles:true})); }); await sleep(300);
  ok('Light on Settings: dim saves; night times appear', await pg.evaluate(()=>S.dim===20 && !!document.querySelector('#lightSet input[data-set="nightFrom"]')));
  await pg.evaluate(()=>{ S.dim=0; S.nightAuto=false; saveSettings(); applyLook(); });
  await pg.evaluate(()=>document.querySelector('#infoSeg [data-v="2"]').click()); await sleep(200);
  ok('bottom line choice', await pg.evaluate(()=>S.info===2));
  await pg.evaluate(()=>{ S.info=0; saveSettings(); });
  await pg.screenshot({path:S+'settings_top.png'});
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
