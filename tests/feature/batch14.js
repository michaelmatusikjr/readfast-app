const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', hasTouch:true, isMobile:true, acceptDownloads:true});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); S.mode='pages'; S.font='original'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(900);
  // 1. Aa contents
  await pg.evaluate(()=>openPanel()); await sleep(600);
  const aa=await pg.evaluate(()=>{ const t=$('#sheet').textContent; return {mode:!!document.querySelector('#sheet [data-set="mode"]'), theme:/Theme/.test(t), text:/Text size/.test(t), more:!!document.querySelector('#sheet [data-act="more"]'), bright:/Brightness/.test(t), pages:/Page turn/.test(t), voice:/Read aloud/.test(t), tiles:[...document.querySelectorAll('#sheet .fontgrid .chip')].map(c=>c.dataset.v), lit:document.querySelector('#sheet .fontgrid [data-v="literata"]').getAttribute('aria-pressed')}; });
  ok('Aa has mode, theme, text, More settings only', aa.mode&&aa.theme&&aa.text&&aa.more&&!aa.bright&&!aa.pages&&!aa.voice, aa);
  ok('no Book’s font tile without a book font; Original shows as Literata', !aa.tiles.includes('original') && aa.lit==='true', aa.tiles);
  await pg.evaluate(()=>{ R.bookFamily='TestBookFont'; R.text.font={family:'Test-Book_Font'}; refreshPanel(); }); await sleep(200);
  const bf=await pg.evaluate(()=>{ const c=document.querySelector('#sheet .fontgrid [data-v="original"]'); return c&&[c.textContent, c.style.fontFamily, c.getAttribute('aria-pressed')]; });
  ok('Book’s font tile when the book has a font', bf && /Book’s font/.test(bf[0]) && /Test Book Font/.test(bf[0]) && /TestBookFont/.test(bf[1]) && bf[2]==='true', bf);
  await pg.evaluate(()=>{ R.bookFamily=null; R.text.font=null; });
  // 2. More settings and back
  const pos0=await pg.evaluate(()=>R.pos);
  await sleep(500); await pg.evaluate(()=>document.querySelector('#sheet [data-act="more"]').click()); await sleep(700);
  const st=await pg.evaluate(()=>({reader:$('#v-reader').hidden, set:!$('#v-settings').hidden, tabs:$('#tabs').hidden, back:!!$('#backToBook'), sections:[...document.querySelectorAll('#readSet .panel-sec>h3')].map(h=>h.textContent)}));
  ok('More settings opens Settings over the book with Back', st.reader&&st.set&&st.tabs&&st.back && ['Brightness','Pages mode','Scroll mode','Speed mode','Speed mode pauses','Read aloud'].every(x=>st.sections.includes(x)), st);
  // change settings on the page
  await pg.evaluate(()=>{ const t=document.querySelector('#readSet input[data-set="autoScroll"]'); t.checked=!t.checked; t.dispatchEvent(new Event('change',{bubbles:true})); }); await sleep(300);
  ok('toggle on Settings page saves and redraws', await pg.evaluate(()=>S.autoScroll===true && !!document.querySelector('#readSet input[data-set="scrollWpm"]')));
  await pg.evaluate(()=>{ const r=document.querySelector('#readSet input[data-set="dim"]'); r.value='20'; r.dispatchEvent(new Event('input',{bubbles:true})); }); await sleep(200);
  ok('range on Settings page saves', await pg.evaluate(()=>S.dim===20));
  await pg.evaluate(()=>{ S.autoScroll=false; S.dim=0; saveSettings(); $('#backToBook').click(); }); await sleep(900);
  ok('Back returns to the book at the same place', await pg.evaluate(p=>!$('#v-reader').hidden && $('#v-settings').hidden && R.inSet===false && Math.abs(R.pos-p)<60, pos0), await pg.evaluate(()=>R.pos));
  // speed mode Aa shows word display
  await pg.evaluate(async()=>{ await switchMode('speed'); openPanel(); }); await sleep(700);
  ok('Speed Aa: mode, theme, word display', await pg.evaluate(()=>/Word display/.test($('#sheet').textContent) && !/Reading speed/.test($('#sheet').textContent)));
  await pg.evaluate(async()=>{ closeSheet(); await switchMode('pages'); }); await sleep(800);
  // 5. spoken words
  const sw=await pg.evaluate(()=>{
    const save=R.words, n=R.n;
    const run=str=>{ R.words=str.split(' '); R.n=R.words.length; const o=spokenWords(0,R.words.length); return R.words.map((w,k)=>o[k]==null?w:o[k]).filter(x=>x!=='').join(' '); };
    const r={
      a:run('see Matt 5:6 today'), b:run('glory (1 Cor. 10:31).'), c:run('says (Isa. 43:6–7).'), d:run('Ps. 23:1 and'), e:run('Rom. 8:28; 12:1 also'),
      f:run('things, e.g., this'), g:run('Dr. Smith and St. Paul'), h:run('as follows: one'), i:run('at 3:30 today'), j:run('John 3:16 says'), k:run('Rev. Jones read Rev. 21:4')};
    R.words=save; R.n=n; return r; });
  const exp={a:'see Matthew chapter 5 verse 6 today', b:'glory First Corinthians chapter 10 verse 31.', c:'says Isaiah chapter 43 verses 6 through 7.', d:'Psalm 23 verse 1 and', e:'Romans chapter 8 verse 28; chapter 12 verse 1 also', f:'things, for example, this', g:'Doctor Smith and Saint Paul', i:'at 3 30 today', j:'John chapter 3 verse 16 says', k:'Reverend Jones read Revelation chapter 21 verse 4'};
  for(const k in exp) ok('speaks '+k, sw[k]===exp[k], [sw[k]]);
  const colon=await pg.evaluate(()=>{ const save=R.words,n=R.n; R.words='as follows: one two.'.split(' '); R.n=R.words.length; R.blocks=R.blocks; const sp=spokenWords(0,R.n); R.words=save; R.n=n; return sp; });
  // full chunk text with colon from the real book path
  const ch=await pg.evaluate(()=>{ const k=R.words.findIndex(w=>/:$/.test(w)); if(k<0) return null; const c=speechChunk(Math.max(0,k-3),20,30); return c.text; });
  ok('no colon in spoken text', ch==null || !ch.includes(':'), ch);
  // 6. notes skipped + heading pause
  const nt=await pg.evaluate(()=>{
    const B=R.blocks; let bi=B.findIndex((b,k)=>k>2 && b.t==='p' && b.e-b.s>8 && B[k+1] && /^h/.test(B[k+1].t||''));
    if(bi<0) return {skip:true};
    const end=speechChunk(B[bi].e-3,55,1); 
    const saveN=R.notes; R.notes=new Map([[B[bi-1].s, B[bi].s+1]]); R._nb=null;
    const c=speechChunk(B[bi].s,55,1); R.notes=saveN; R._nb=null;
    return {pause:end.pauseAfter, skippedTo:c.i, nextBlockStart:B[bi+1].s};
  });
  ok('longer pause before a heading', nt.skip || nt.pause>=1000, nt);
  ok('note blocks are skipped', nt.skip || nt.skippedTo===nt.nextBlockStart, nt);
  const fnw=await pg.evaluate(()=>{ const save=R.wf; R.wf=new Uint8Array(R.n); const k=R.blocks.find(b=>b.t==='p'&&b.e-b.s>10); R.wf[k.s+2]=F_N; const c=speechChunk(k.s,6,30); R.wf=save; return [c.text.split(' ').length, R.words.slice(k.s,k.s+6).join(' '), c.text]; });
  ok('footnote markers are not spoken', fnw[0]===5, fnw);
  // 7. voice mode keeps controls and makes room
  await pg.evaluate(()=>{ S.focus=true; saveSettings(); $('#v-reader').classList.add('overlay'); $('#rTts').click(); }); await sleep(500);
  const vm=await pg.evaluate(()=>{ setChrome(false); return [R.chrome, $('#v-reader').classList.contains('chrome-off'), $('#v-reader').classList.contains('overlay'), $('#ttsBar').hidden]; });
  ok('voice mode: controls stay up and the page makes room', vm[0]===true && !vm[1] && !vm[2] && !vm[3], vm);
  ok('time left uses listening speed', await pg.evaluate(()=>{ S.ttsWpm=150; S.ttsRate=1; return readWpm()===150 && /left in chapter/.test(infoText()); }));
  await pg.evaluate(()=>$('#rTts').click()); await sleep(500);
  ok('leaving voice mode restores hide-controls layout', await pg.evaluate(()=>$('#v-reader').classList.contains('overlay') && TTS.mode===false));
  await pg.evaluate(()=>{ S.focus=false; saveSettings(); $('#v-reader').classList.remove('overlay'); setChrome(true); });
  // 8. scroll centering
  await pg.evaluate(async()=>{ await switchMode('scroll'); }); await sleep(900);
  const sc=await pg.evaluate(async()=>{ const v=scView.getBoundingClientRect(); const ws=[...scFlow.querySelectorAll('w')].filter(w=>{const r=w.getBoundingClientRect(); return r.top>v.top+v.height*0.8 && r.bottom<v.bottom;}); const w=ws[0]; const k=idxOf(w); await ttsMark(k); await new Promise(r=>setTimeout(r,900)); const r=wordEl(k).getBoundingClientRect(); const mid=v.top+v.height*0.5; await ttsMark(-1); return [r.top+r.height/2-mid]; });
  ok('scroll: spoken word kept at the middle', Math.abs(sc[0])<6, sc);
  const sc2=await pg.evaluate(async()=>{ const v=scView.getBoundingClientRect(); const ws=[...scFlow.querySelectorAll('w')].filter(w=>{const r=w.getBoundingClientRect(); return r.top>v.top+30 && r.top<v.top+v.height*0.35;}); const w=ws[0]; const k=idxOf(w); const t0=scView.scrollTop; await ttsMark(k); await new Promise(r=>setTimeout(r,500)); const moved=scView.scrollTop-t0; await ttsMark(-1); return moved; });
  ok('scroll: no scrolling while the word is above the middle', sc2===0, sc2);
  await pg.evaluate(async()=>{ await switchMode('pages'); closeReader(); }); await sleep(900); await pg.evaluate(()=>closeSheet());
  // 10. backup includes settings, restore brings them back
  const bk=await pg.evaluate(async()=>{ S.lineH=1.9; saveSettings(); LS.set('libSort','title'); const j=JSON.parse(await buildBackup()); return [j.settings&&j.settings.lineH, j.prefs&&j.prefs.libSort]; });
  ok('backup has settings and prefs', bk[0]===1.9 && bk[1]==='title', bk);
  const json=await pg.evaluate(async()=>buildBackup());
  fs.writeFileSync(S+'bk14.json', json);
  await pg.evaluate(()=>{ S.lineH=1.4; saveSettings(); LS.set('libSort','recent'); showView('settings'); }); await sleep(500);
  await pg.setInputFiles('#restoreIn', S+'bk14.json'); await sleep(800);
  ok('restore offers settings', await pg.evaluate(()=>!!$('#rsSettings') && $('#rsSettings').checked));
  await pg.evaluate(()=>document.querySelector('#sheet [data-act="go"]').click()); await sleep(2500);
  ok('restore brings settings back', await pg.evaluate(()=>S.lineH===1.9 && LS.get('libSort','')==='title'), await pg.evaluate(()=>[S.lineH, LS.get('libSort','')]));
  // 11. remove download clears the file and the state
  await pg.evaluate(async()=>{ const root=await navigator.storage.getDirectory(); const d=await root.getDirectoryHandle('piper',{create:true}); for(const n of ['en_US-lessac-medium.onnx','en_US-lessac-medium.onnx.json']){ const f=await d.getFileHandle(n,{create:true}); const w=await f.createWritable(); await w.write('x'); await w.close(); } LS.set('pipReady.en_US-lessac-medium',true); });
  ok('voice shows downloaded', await pg.evaluate(()=>pipDownloaded('en_US-lessac-medium')));
  await pg.evaluate(async()=>{ await pipRemove('en_US-lessac-medium'); });
  ok('remove download deletes it', await pg.evaluate(async()=>!(await pipDownloaded('en_US-lessac-medium'))));
  await pg.evaluate(()=>showView('settings')); await sleep(800);
  ok('settings shows Download now', await pg.evaluate(()=>/Not downloaded/.test(($('#kokState')||{}).textContent||'')), await pg.evaluate(()=>($('#kokState')||{}).textContent));
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
