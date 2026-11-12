const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(2000);
  console.log('tab label', await pg.evaluate(()=>[...document.querySelectorAll('#tabs button')].map(b=>b.textContent)));
  console.log('reminder toast on first boot', await pg.evaluate(()=>[!$('#toast').hidden, $('#toastMsg').textContent, $('#toastAct').textContent]));
  // empty notes
  await pg.click('#tabs [data-tab=words]'); await sleep(300);
  console.log('empty hl', await pg.evaluate(()=>$('#notesHl').textContent.slice(0,60)));
  // add highlight + bookmark in reader
  await pg.evaluate(()=>{ S.mode='pages'; saveSettings(); });
  await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(700);
  console.log('rNotes btn', await pg.evaluate(()=>[!!$('#rNotes').innerHTML, $('#rNotes').getBoundingClientRect().width]));
  await pg.evaluate(()=>{ addHighlight(20,28,2); const h=R.meta.highlights[0]; h.note='My note here'; touch(R.meta); goTo(300,true); });
  await sleep(400);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rMark'); await sleep(200);
  console.log('bookmark toast', await pg.evaluate(()=>[$('#toastMsg').textContent, $('#toastAct').textContent, $('#toastAct').hidden]));
  await pg.click('#toastAct'); await sleep(500);
  console.log('see all -> sheet', await pg.evaluate(()=>[$('#sheet').hidden, $('#sheet [aria-pressed=true]')&&$('#sheet [aria-pressed=true]').textContent]));
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  await pg.click('#rNotes'); await sleep(500);
  console.log('rNotes -> sheet', await pg.evaluate(()=>[$('#sheet [aria-pressed=true]').textContent, document.querySelectorAll("#sheet .hlrow").length]));
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  await pg.evaluate(()=>closeReader()); await sleep(300);
  // notes tab
  await pg.click('#tabs [data-tab=words]'); await sleep(500);
  console.log('notes hl', await pg.evaluate(()=>[$('#notesHl').hidden, document.querySelectorAll('#notesHl .nbook').length, document.querySelectorAll('#notesHl .hlrow').length, $('#notesHl .hlrow .t').textContent.slice(0,50), $('#notesHl .nt').textContent]));
  await pg.click('#notesSeg [data-n=bm]'); await sleep(400);
  console.log('notes bm', await pg.evaluate(()=>[$('#notesBm').hidden, document.querySelectorAll('#notesBm .hlrow').length, $('#notesBm .hlrow').textContent.slice(0,80)]));
  await pg.click('#notesSeg [data-n=w]'); await sleep(300);
  console.log('words pane', await pg.evaluate(()=>[$('#wordsPane').hidden, $('#notesBm').hidden]));
  await pg.click('#notesSeg [data-n=hl]'); await sleep(400);
  await pg.click('#notesHl .hlrow .grow'); await sleep(900);
  console.log('open from notes', await pg.evaluate(()=>[$('#v-reader').hidden, R.pos, !$('#backPill').hidden, R.playing]));
  await pg.evaluate(()=>closeReader()); await sleep(300);
  console.log('back returns to', await pg.evaluate(()=>[$('#v-words').hidden, $('#v-library').hidden]));
  // library options entry
  await pg.click('#tabs [data-tab=library]'); await sleep(300);
  await pg.click('#docList [data-more]'); await sleep(500);
  console.log('options btn', await pg.evaluate(()=>$('#sheet [data-act=notes]')&&$('#sheet [data-act=notes]').textContent));
  await pg.click('#sheet [data-act=notes]'); await sleep(1000);
  console.log('options -> reader+sheet', await pg.evaluate(()=>[$('#v-reader').hidden, $('#sheet').hidden, $('#sheet [aria-pressed=true]')&&$('#sheet [aria-pressed=true]').textContent]));
  await pg.evaluate(()=>{ closeSheet(); }); await sleep(450); await pg.evaluate(()=>closeReader()); await sleep(300);
  // settings
  await pg.click('#tabs [data-tab=settings]'); await sleep(300);
  console.log('settings', await pg.evaluate(()=>[/Storage check/.test($('#settingsBody').textContent), !!$('#bkPick'), !!$('#bkRemind'), $('#bkLast').textContent, canPickFolder()]));
  // folder backup with OPFS handle
  const r=await pg.evaluate(async()=>{ const root=await navigator.storage.getDirectory(); BK.dir=root; await kvSet('backupDir',root); bkSettingsUI();
    const ok=await folderBackup(true); const names=[]; for await (const [n] of root.entries()) names.push(n);
    const f=await (await root.getFileHandle('tooz-backup.json')).getFile(); const j=JSON.parse(await f.text());
    return [ok, names.sort(), j.app, j.meta.length, j.texts.length, j.meta[0].highlights.length, $('#bkFolder').textContent, $('#bkLast').textContent]; });
  console.log('folder backup', r);
  const r2=await pg.evaluate(async()=>{ const a=LS.get('bk.at'); const ok=await folderBackup(false); const same=LS.get('bk.at')===a; const m=LIB[0]; m.title='Renamed'; touch(m); await new Promise(r=>setTimeout(r,20)); const ok2=await folderBackup(false); const f=await (await BK.dir.getFileHandle('tooz-backup.json')).getFile(); return [ok, same, ok2, JSON.parse(await f.text()).meta.find(x=>x.id===m.id).title]; });
  console.log('auto skip/unchanged + changed', r2);
  // hidden triggers auto backup
  const r3=await pg.evaluate(async()=>{ LIB[0].title='Renamed2'; touch(LIB[0]); Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); await new Promise(r=>setTimeout(r,800)); delete document.hidden; const f=await (await BK.dir.getFileHandle('tooz-backup.json')).getFile(); return JSON.parse(await f.text()).meta.find(x=>x.id===LIB[0].id).title; });
  console.log('on hide', r3);
  // pruning
  const r4=await pg.evaluate(async()=>{ for(let d=1; d<=9; d++){ const fh=await BK.dir.getFileHandle(`tooz-backup-2020-01-0${d}.json`,{create:true}); const w=await fh.createWritable(); await w.write('{}'); await w.close(); } await folderBackup(true); const n=[]; for await (const [x] of BK.dir.entries()) n.push(x); return n.sort(); });
  console.log('prune', r4.length, r4);
  // reload: handle restored from kv
  await pg.reload(); await sleep(1000);
  console.log('after reload', await pg.evaluate(()=>[!!BK.dir, BK.dir&&BK.dir.name]));
  // restore from file
  console.log('errors', errs);
  await b.close();
})();
