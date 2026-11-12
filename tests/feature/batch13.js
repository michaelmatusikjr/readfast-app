const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true, acceptDownloads:true});
  await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  // first run: no what's new
  ok('no whatsnew on first run', await pg.evaluate(()=>!/What’s new/.test($('#sheet').hidden?'':$('#sheet').textContent)));
  ok('seenVer stored', await pg.evaluate(()=>LS.get('seenVer','')===APP_VERSION));
  // simulate older version -> reload shows what's new
  await pg.evaluate(()=>LS.set('seenVer','2026.11.01')); await pg.reload(); await sleep(2200);
  ok('whatsnew after update', await pg.evaluate(()=>!$('#sheet').hidden && $('#sheet').textContent.includes('What’s new')), await pg.evaluate(()=>$('#sheet').textContent.slice(0,60)));
  await pg.evaluate(()=>closeSheet());
  // settings: version, storage
  await pg.evaluate(()=>showView('settings')); await sleep(800);
  ok('version shown', await pg.evaluate(()=>$('#settingsBody').textContent.includes('Version '+APP_VERSION)));
  ok('storage summary', await pg.evaluate(()=>$('#storeUse').textContent), await pg.evaluate(()=>$('#storeUse').textContent));
  await pg.evaluate(()=>$('#storeBooks').click()); await sleep(1200);
  ok('storage sheet', await pg.evaluate(()=>/downloaded book/.test($('#sheet').textContent) && /Not listed: \d+ book/.test($('#sheet').textContent)), await pg.evaluate(()=>$('#sheet .note').textContent));
  await pg.evaluate(()=>closeSheet());
  // full-text search
  await pg.evaluate(()=>showView('library')); await sleep(500);
  await pg.fill('#libFind','page keeps'); await sleep(300);
  ok('fts pill', await pg.evaluate(()=>!!document.querySelector('[data-fts]')));
  await pg.evaluate(()=>document.querySelector('[data-fts]').click()); await sleep(1200);
  const fts=await pg.evaluate(()=>[$('#sheet .note').textContent, document.querySelectorAll('.ftrow').length, (document.querySelector('.ftrow mark')||{}).textContent]);
  ok('fts results', fts[1]>=1 && /page keeps/i.test(fts[2]||''), fts);
  await sleep(500);
  await pg.evaluate(()=>document.querySelector('.ftrow').click()); await sleep(1500);
  ok('fts opens book at match', await pg.evaluate(()=>!$('#v-reader').hidden && /keeps/i.test(R.words.slice(R.pos-3,R.pos+4).join(' '))), await pg.evaluate(()=>R.words.slice(R.pos-2,R.pos+3).join(' ')));
  // apostrophe search
  ok('apostrophe search', await pg.evaluate(async()=>{ await searchAllBooks("that's the tour"); return document.querySelectorAll('.ftrow').length; })>=1);
  await pg.evaluate(()=>closeSheet());
  // define picks the right word; citation copy
  await pg.evaluate(async()=>{ S.mode='pages'; saveSettings(); await goTo(0,true); }); await sleep(600);
  const dw=await pg.evaluate(()=>{ const k=R.words.findIndex(w=>/^tour/.test(w)); return [k,R.words[k], clean(R.words[defineIdx(k,k+1)])]; });
  ok('defineIdx first word', /^tour/.test(dw[2]), dw);
  // long press selection via synthetic pointer events
  const lp=await pg.evaluate(async()=>{
    const w=document.querySelector('#pagesView w:nth-of-type(5)')||[...document.querySelectorAll('#pagesView w')].find(x=>x.getBoundingClientRect().width>0);
    const r=w.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
    const pe=(t,X,Y)=>w.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerType:'touch',clientX:X,clientY:Y,isPrimary:true}));
    pe('pointerdown',x,y); await new Promise(r=>setTimeout(r,600));
    const on=TS.on, a=TS.a; const ws=[...document.querySelectorAll('#pagesView w')].filter(e=>e.getBoundingClientRect().width>0); const far=ws[ws.indexOf(w)+4]; const r2=far.getBoundingClientRect();
    w.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'touch',clientX:r2.left+2,clientY:r2.top+r2.height/2}));
    w.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',clientX:r2.left+2,clientY:r2.top+r2.height/2}));
    return [on, TS.on, TS.b-TS.a, !$('#selBar').hidden, document.querySelectorAll('w.tsel').length, !$('#tsA').hidden, !$('#tsB').hidden, getComputedStyle($('#pagesView')).webkitUserSelect||getComputedStyle($('#pagesView')).userSelect];
  });
  ok('long-press select + drag', lp[0]&&lp[1]&&lp[2]>=3&&lp[3]&&lp[5]&&lp[6], lp);
  const cit=await pg.evaluate(()=>citation(SEL.s));
  ok('citation', cit.includes('Welcome to Tooz'), cit);
  await pg.evaluate(()=>document.querySelector('#selBar [data-sel="share"]').click()); await sleep(900);
  ok('quote image sheet', await pg.evaluate(()=>!$('#sheet').hidden && !!document.querySelector('#sheet canvas, #sheet img')));
  await pg.evaluate(()=>closeSheet()); await sleep(300);
  // tap elsewhere clears selection
  await pg.evaluate(async()=>{ const ws=[...document.querySelectorAll('#pagesView w')].filter(e=>e.getBoundingClientRect().width>0); const w=ws[2]; const r=w.getBoundingClientRect(); w.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:r.left+3,clientY:r.top+3})); await new Promise(r=>setTimeout(r,500)); w.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:'touch',clientX:r.left+3,clientY:r.top+3})); });
  // reading-time credit rules
  const cr=await pg.evaluate(()=>{ const exp=200/usualWpm()*60000; return [creditFor(exp*5,200,false)/exp, creditFor(exp*5,200,true)/exp, creditFor(exp*0.5,200,false)/exp]; });
  ok('credit caps', Math.abs(cr[0]-2)<1e-6 && Math.abs(cr[1]-1)<1e-6 && Math.abs(cr[2]-0.5)<1e-6, cr);
  // export from book menu (download fallback)
  await pg.evaluate(()=>{ const d=R.meta; d.highlights=[{s:10,e:20,c:2,at:Date.now(),note:'A test note'}]; d.bookmarks=[{i:40,name:'Mark A',at:Date.now()}]; touch(d); });
  await pg.evaluate(()=>closeReader()); await sleep(800); await pg.evaluate(()=>closeSheet());
  const id=await pg.evaluate(()=>LIB.find(m=>m.kind==='sample').id);
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:5000}).catch(()=>null), pg.evaluate(id=>exportBook(LIB.find(m=>m.id===id),'html'),id)]);
  let html=''; if(dl){ const p=await dl.path(); html=require('fs').readFileSync(p,'utf8'); }
  ok('export html', html.includes('A test note') && html.includes('Mark A') && html.includes('<h2>'), [dl&&dl.suggestedFilename(), html.length]);
  const [dl2]=await Promise.all([pg.waitForEvent('download',{timeout:5000}).catch(()=>null), pg.evaluate(id=>exportBook(LIB.find(m=>m.id===id),'txt'),id)]);
  let txt=''; if(dl2) txt=require('fs').readFileSync(await dl2.path(),'utf8');
  ok('export txt', txt.includes('Note: A test note') && txt.includes('[Bookmark] Mark A'), txt.slice(0,300));
  // notes tab export button
  await pg.evaluate(()=>{ NOTESEG='hl'; showView('words'); }); await sleep(800);
  ok('notes export btn', await pg.evaluate(()=>!!document.querySelector('[data-exp]')));
  // archived export + year stats
  await pg.evaluate(()=>{ const now=Date.now(); ARCH.list().unshift({id:'x1',title:'Old Book',author:'A. Writer',tags:[],kind:'epub',count:1000,status:'finished',finishedAt:new Date(2025,4,3).getTime(),archivedAt:now,rating:4,review:'',kept:{progress:null,bookmarks:[],highlights:[{s:5,e:9,c:1,at:now,note:'n1',q:'quoted words',noteOnly:false}]}});
    ARCH.list().unshift({id:'x2',title:'New Book',author:'B',tags:[],kind:'epub',count:1000,status:'finished',finishedAt:Date.now()-86400000,archivedAt:now,rating:5,review:'',kept:{progress:null,bookmarks:[],highlights:[]}}); ARCH.save();
    const st=LS.get('stats',{}); for(const k of ['2026-10-01','2026-10-02','2026-10-03','2026-10-05']) st[k]={ms:600000,words:2000}; LS.set('stats',st); S.yearGoal=12; saveSettings(); });
  await pg.evaluate(()=>showView('stats')); await sleep(600);
  const ys=await pg.evaluate(()=>[$('#yearBox').textContent.replace(/\s+/g,' ').slice(0,260), document.querySelectorAll('#yearBox details.yr').length]);
  ok('year stats', /2026 in books/.test(ys[0]) && /1 \/ 12/.test(ys[0]) && /Longest streak/.test(ys[0]) && ys[1]===2, ys);
  ok('longest streak 3', await pg.evaluate(()=>longestStreak(LS.get('stats',{}), k=>(LS.get('stats',{})[k]?.words||0)>0))>=3);
  await pg.evaluate(()=>document.querySelector('[data-ygoal="24"]').click()); await sleep(300);
  ok('year goal chip', await pg.evaluate(()=>S.yearGoal===24));
  const [dl3]=await Promise.all([pg.waitForEvent('download',{timeout:5000}).catch(()=>null), pg.evaluate(()=>exportBook(ARCH.list()[1],'txt'))]);
  let t3=''; if(dl3) t3=require('fs').readFileSync(await dl3.path(),'utf8');
  ok('archived export', t3.includes('quoted words') && t3.includes('Note: n1'), t3.slice(0,200));
  // voice panel
  await pg.evaluate(async()=>{ await openDoc(LIB.find(m=>m.kind==='sample').id); S.mode='pages'; openPanel(); }); await sleep(600);
  ok('voice preview btn', await pg.evaluate(()=>!!document.querySelector('[data-act="vprev"]')));
  ok('voice tiers', await pg.evaluate(()=>[voiceTier({voiceURI:'com.apple.voice.enhanced.en-US.Ava',name:'Ava (Enhanced)'}), voiceTier({voiceURI:'com.apple.voice.compact.en-US.Samantha',name:'Samantha'}), voiceTier({voiceURI:'com.apple.speech.synthesis.voice.Bells',name:'Bells'}), voiceLabel({voiceURI:'com.apple.voice.premium.en-GB.Jamie',name:'Jamie (Premium)',lang:'en-GB'})]).then(v=>v[0]===0&&v[1]===1&&v[2]===2&&v[3]==='Jamie · Premium (GB)'));
  // idle setting
  await pg.evaluate(()=>{ closeSheet(); closeReader(); }); await sleep(600); await pg.evaluate(()=>{ closeSheet(); showView('settings'); }); await sleep(500);
  await pg.evaluate(()=>document.querySelector('#idleSeg [data-v="10"]').click());
  ok('idle setting', await pg.evaluate(()=>S.idleMins===10 && idleMs()===600000));
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
