
/* ---------- define + word list ---------- */
/*@@OLD:1151-1203@@*/

/* ---------- stats and daily goal ---------- */
function recordStats(ms, words){
  if(words<1||ms<500) return; const st=LS.get('stats',{}); const k=dayKey(); const d=st[k]||{ms:0,words:0};
  const before=d.ms; d.ms+=ms; d.words+=words; st[k]=d; LS.set('stats',st);
  const goal=(S.goalMins||0)*60000;
  if(goal && before<goal && d.ms>=goal) toast('You reached today’s reading goal of '+S.goalMins+' minutes.', null, 5000);
}
function renderStats(){
  const st=LS.get('stats',{}); const days=Object.keys(st);
  let tw=0,tms=0; for(const k of days){ tw+=st[k].words; tms+=st[k].ms; }
  const today=st[dayKey()]||{ms:0,words:0};
  const goal=(S.goalMins||0)*60000;
  const met=(k)=>goal ? (st[k]?.ms||0)>=goal : (st[k]?.words||0)>0;
  let streak=0; const d=new Date(); if(!met(dayKey(d))) d.setDate(d.getDate()-1);
  while(met(dayKey(d))){ streak++; d.setDate(d.getDate()-1); }
  const avg=tms>0?Math.round(tw/(tms/60000)):0; const fin=LIB.filter(x=>x.finished).length;
  const week=[]; for(let q=6;q>=0;q--){ const x=new Date(); x.setDate(x.getDate()-q); const k=dayKey(x); week.push({k, lbl:x.toLocaleDateString(undefined,{weekday:'short'}).slice(0,2), m:Math.round((st[k]?.ms||0)/60000), met:goal&&(st[k]?.ms||0)>=goal}); }
  const max=Math.max(1, S.goalMins||0, ...week.map(w=>w.m));
  const todayMin=Math.round(today.ms/60000);
  const pct=goal?Math.min(100,Math.round(100*today.ms/goal)):0;
  $('#statsBody').innerHTML=`
    <div class="chart">
      <div class="topbar" style="padding:0"><h2>Daily reading goal</h2><span class="val" style="font-family:var(--f-mono);color:var(--accent)">${S.goalMins?S.goalMins+' min':'Off'}</span></div>
      ${S.goalMins?`<p class="note" style="margin:6px 0 0">${todayMin} of ${S.goalMins} minutes today${pct>=100?' · goal reached':''}</p><div class="goalbar"><i style="width:${pct}%"></i></div>`:'<p class="note" style="margin:6px 0 0">Pick a daily target. Time counts in every reading mode.</p>'}
      <div class="chips" id="goalChips" style="margin-top:10px">${[0,10,15,20,30,45,60].map(v=>`<button class="chip" type="button" data-goal="${v}" aria-pressed="${(S.goalMins||0)===v}">${v?v+' min':'Off'}</button>`).join('')}</div>
    </div>
    <div class="tiles">
      <div class="tile"><div class="v">${todayMin}</div><div class="k">Minutes today</div></div>
      <div class="tile"><div class="v">${streak}</div><div class="k">${goal?'Days in a row goal met':'Day streak'}</div></div>
      <div class="tile"><div class="v">${today.words.toLocaleString()}</div><div class="k">Words today</div></div>
      <div class="tile"><div class="v">${avg||'—'}</div><div class="k">Average words per minute</div></div>
      <div class="tile"><div class="v">${fmtMins(tms/60000)}</div><div class="k">Time reading</div></div>
      <div class="tile"><div class="v">${fin}</div><div class="k">Books finished</div></div>
    </div>
    ${yearHTML(st, met)}
    <div class="chart"><h2>Minutes per day</h2><p class="note" style="margin:2px 0 0">Last 7 days${goal?' · green bars met your goal':''}</p>
      <div class="bars">${week.map(w=>`<div class="b"><em>${w.m||''}</em><i class="${w.m?(w.met?'met':''):'zero'}" style="height:${Math.round(100*w.m/max)}%"></i></div>`).join('')}</div>
      <div class="bars-x">${week.map(w=>`<span>${w.lbl}</span>`).join('')}</div>
    </div>
    <p class="note">Time counts while you turn pages, scroll, speed read or listen. Time stops when you switch apps or lock the phone. If you don’t touch the screen for ${S.idleMins||5} minutes (change this in Settings), that stretch counts only as long as the text usually takes you.</p>`;
  $('#yearChips').addEventListener('click',e=>{ const b=e.target.closest('[data-ygoal]'); if(!b) return; S.yearGoal=+b.dataset.ygoal; saveSettings(); renderStats(); });
  $('#goalChips').addEventListener('click',e=>{ const b=e.target.closest('[data-goal]'); if(!b) return; S.goalMins=+b.dataset.goal; saveSettings(); renderStats(); });
}

/* ---------- app settings (the Aa panel has mode, theme and text; the other reading options are here) ---------- */
function renderSettings(){
  $('#settingsBody').innerHTML=`
    ${R.inSet?`<button class="btn" type="button" id="backToBook" style="margin-bottom:10px">‹ Back to the book</button>`:''}
    <div class="topbar"><div><div class="eyebrow">Tooz eReader</div><h1>Settings</h1></div></div>
    <h2 id="readHead">Reading options</h2>
    <p class="note" style="margin:-4px 0 10px">The mode, theme and text are in the <b>Aa</b> button inside any book. Everything here applies to every book.</p>
    <div id="readSet">${readingSettingsHTML()}</div>
    <h2>Reading time</h2>
    <div class="group"><div class="set">
      <div class="hd"><b>Stop counting reading time after</b></div>
      <div class="seg" id="idleSeg">${[3,5,10].map(v=>`<button type="button" data-v="${v}" aria-pressed="${(S.idleMins||5)===v}">${v} min</button>`).join('')}</div>
      <div class="desc">If you don’t turn a page, scroll or touch the screen for this long, Tooz assumes you stepped away and counts only the time that stretch of text usually takes you.</div>
    </div></div>
    <h2>Send text from other apps</h2>
    <div class="group"><div class="set">
      <div class="desc" style="color:var(--ink)">Make a shortcut once, and “Send to Tooz” shows up in the iPhone share sheet.</div>
      <ol class="steps">
        <li>Open the <b>Shortcuts</b> app and tap <b>+</b>. Name it <b>Send to Tooz</b>.</li>
        <li>Tap the <b>ⓘ</b> button and turn on <b>Show in Share Sheet</b>. Set it to receive <b>Text</b>, <b>URLs</b> and <b>Safari web pages</b>.</li>
        <li>Add the action <b>Copy to Clipboard</b> (it copies the Shortcut Input).</li>
        <li>Share any text or link to <b>Send to Tooz</b>, open Tooz from your Home Screen, tap <b>Paste text</b>, then <b>Paste from clipboard</b>. A link loads the article; text is added as is.</li>
      </ol>
      <div class="desc">A shortcut can’t open the Home Screen app directly. It would open Safari, which keeps a separate library.</div>
    </div></div>
    <h2>Loading links</h2>
    <div class="group"><div class="set">
      <div class="hd"><label for="sLinkSvc">Your own reader service <span class="muted" style="font-weight:400">(optional)</span></label></div>
      <input class="input" id="sLinkSvc" type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="https://my-proxy.example.workers.dev/?url={url}" value="${esc(S.linkService||'')}">
      <div class="desc">When a site won’t let apps load it, Tooz tries a reader service. Public ones are free but sometimes down. If you run your own, enter its address here with {url} where the link goes; it’s tried first.</div>
    </div></div>
    <h2>Your library</h2>
    <div class="group"><div class="set">
      <div class="desc">Your library lives on this device, inside this browser. A backup keeps your books, highlights, notes, bookmarks, saved words, archive, reading log and settings safe if browser data is cleared.</div>
      <div class="row"><button class="btn" type="button" id="backupBtn">Save backup</button><button class="btn" type="button" id="restoreBtn">Restore backup</button></div>
      <div class="desc" id="bkLast"></div>
      <div class="desc" id="storeNote"></div>
    </div>
    ${canPickFolder()?`<div class="set">
      <div class="hd"><b>Backup folder</b></div>
      <div class="desc" id="bkFolder"></div>
      <div class="row"><button class="btn" type="button" id="bkPick">Choose folder</button><button class="btn" type="button" id="bkOff" hidden>Stop automatic backups</button></div>
      <div class="desc">Tooz saves <b>tooz-backup.json</b> to this folder by itself: when you close or switch away from the app, and every few minutes while something has changed. It also keeps one dated copy per day for the last week.</div>
    </div>`:`<div class="set">
      <div class="hd"><b>Backup reminder</b></div>
      <div class="seg" id="bkRemind">${[['0','Off'],['1','Daily'],['7','Weekly']].map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${String(S.bkRemind)===v}">${l}</button>`).join('')}</div>
      <div class="desc">On iPhone, Apple doesn’t let web apps pick a folder or save files without a tap, so automatic backups aren’t possible here. Instead, Tooz reminds you when your library has changed and it’s been a while. When you tap <b>Save backup</b>, choose <b>Save to Files</b>; iPhone opens the folder you used last time.</div>
    </div>`}</div>
    <h2>Storage</h2>
    <div class="group"><div class="set">
      <div class="desc" id="storeUse" style="color:var(--ink)">Checking…</div>
      <button class="btn" type="button" id="storeBooks">Show space used by each book</button>
      <button class="btn" type="button" id="rmVoices" style="margin-top:8px">Remove all downloaded voices</button>
    </div></div>
    <h2>Tags</h2>
    <div class="group"><div class="set" id="tagSet">${(()=>{ const n=tagCounts().length; return n? `<details class="tdet" id="tagDet"${TAGS_OPEN?' open':''}><summary>${n} tag${n===1?'':'s'} <span>· tap to ${TAGS_OPEN?'hide':'show'}</span></summary>${tagsSettingsHTML()}</details>` : tagsSettingsHTML(); })()}</div></div>
    <h2>Archived books${ARCH.list().length?' <span class="muted" style="font-weight:400">('+ARCH.list().length+')</span>':''}</h2>
    <div class="group"><div class="set" id="archSet">${archiveSettingsHTML()}</div></div>
    <h2>Tutorial</h2>
    <div class="group"><div class="set">
      <div class="desc">${LIB.some(m=>m.kind==='sample')?'The tutorial is in your library. When you close it, Tooz asks whether to keep it there or tuck it away here.':'The tutorial walks you through every feature. It’s tucked away here until you want it.'}</div>
      <div class="row">${LIB.some(m=>m.kind==='sample')?'':'<button class="btn" type="button" id="tutRestore">Restore tutorial to library</button>'}<button class="btn" type="button" id="tutOpen">Open the tutorial</button></div>
    </div></div>
    <h2>About</h2>
    <div class="group"><div class="set">
      <div class="hd"><b>Tooz eReader</b><span class="val" style="font-family:var(--f-mono)">Version ${APP_VERSION}</span></div>
      <button class="btn" type="button" id="wnBtn">What’s new</button>
    </div></div>
    <h2>Erase all data</h2>
    <div class="group"><div class="set">
      <div class="desc">Start fresh: deletes every book, note, setting and reading log in Tooz on this device.</div>
      <button class="btn danger" type="button" id="eraseBtn">Erase everything…</button>
    </div></div>`;
  const td=$('#tagDet'); if(td) td.addEventListener('toggle',()=>{ TAGS_OPEN=td.open; const sp=td.querySelector('summary span'); if(sp) sp.textContent='· tap to '+(td.open?'hide':'show'); });
  $('#tagSet').addEventListener('click',e=>{ const r=e.target.closest('[data-tren]'), d=e.target.closest('[data-tdel]'); if(r) renameTag(r.dataset.tren); else if(d) deleteTag(d.dataset.tdel); });
  $('#archSet').addEventListener('click',e=>{ const b=e.target.closest('[data-arch]'); if(b) openArchived(+b.dataset.arch); });
  if($('#tutRestore')) $('#tutRestore').onclick=async()=>{ await restoreTutorial(false); renderSettings(); toast('The tutorial is back in your library'); };
  $('#tutOpen').onclick=()=>restoreTutorial(true);
  $('#eraseBtn').onclick=eraseAllSheet;
  $('#storeNote').textContent=Store.db?'':'Storage is unavailable in this view, so documents will disappear when you close the app.';
  $('#sLinkSvc').addEventListener('change',e=>{ S.linkService=e.target.value.trim(); saveSettings(); toast(S.linkService?'Reader service saved':'Reader service cleared'); });
  $('#backupBtn').onclick=backup;
  $('#storeBooks').onclick=storageSheet; $('#rmVoices').onclick=()=>openSheet('Remove all downloaded voices?', `<p class="note" style="margin-top:0">This deletes every read-aloud voice saved on this phone. Your books, notes and settings stay. A voice downloads again the next time you use it.</p>
    <button class="btn danger block" type="button" data-act="yes">Remove all voices</button><button class="btn block" type="button" data-act="no">Cancel</button>`, { no:closeSheet, yes:async()=>{
      closeSheet(); if(TTS.on) ttsStop();
      let before=0, after=0; try{ before=(await navigator.storage.estimate()).usage||0; }catch(e){}
      const n=await natRemoveAll();
      try{ after=(await navigator.storage.estimate()).usage||0; }catch(e){}
      const freed=Math.max(0,before-after);
      toast(n? `Removed ${n} voice${n===1?'':'s'}${freed>1048576?' · freed about '+fmtBytes(freed):''}` : 'No downloaded voices to remove'); storageSummary();
    } }); $('#wnBtn').onclick=whatsNewSheet; storageSummary();
  $('#idleSeg').onclick=e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; S.idleMins=+b.dataset.v; saveSettings(); $('#idleSeg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); };
  bkSettingsUI();
  if($('#bkPick')) $('#bkPick').onclick=pickBackupFolder;
  if($('#bkOff')) $('#bkOff').onclick=async()=>{ BK.dir=null; await kvSet('backupDir',null); bkSettingsUI(); toast('Automatic backups turned off'); };
  if($('#bkRemind')) $('#bkRemind').onclick=e=>{ const b=e.target.closest('button[data-v]'); if(!b) return; S.bkRemind=+b.dataset.v; saveSettings(); $('#bkRemind').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); };
  $('#restoreBtn').onclick=()=>{ $('#restoreIn').value=''; $('#restoreIn').click(); };
  bindPanel($('#readSet'));
  $('#readSet').addEventListener('click',e=>{ const b=e.target.closest('[data-act]'); if(!b) return; const fn=READ_ACTS[b.dataset.act]; if(fn) fn(b,e); });
  setTimeout(natStateUI,0);
  if($('#backToBook')) $('#backToBook').onclick=backToBook;
}

/* ---------- backup / restore ---------- */
async function toPortable(t){
  const out={...t};
  if(t.images){ const files=[]; for(const f of t.images.files) files.push({path:f.path, data:f.data||(f.blob?await blobToDataURL(f.blob).catch(()=>''):'')}); out.images={files, at:t.images.at}; }
  if(t.font&&t.font.faces){ const faces=[]; for(const f of t.font.faces) faces.push({w:f.w, st:f.st, data:f.data||(f.blob?await blobToDataURL(f.blob).catch(()=>''):'')}); out.font={family:t.font.family, faces}; }
  return out;
}
function fromPortable(t){
  if(t.images&&Array.isArray(t.images.files)) t.images={...t.images, files:t.images.files.map(f=>f.data&&!f.blob?{path:f.path, blob:dataURLToBlob(f.data)}:f)};
  if(t.font&&Array.isArray(t.font.faces)) t.font={family:t.font.family, faces:t.font.faces.filter(f=>f.data||f.blob).map(f=>f.data&&!f.blob?{w:f.w, st:f.st, blob:dataURLToBlob(f.data)}:f)};
  return t;
}
/* the backup file, built as one JSON string; each book's converted text is cached so repeat backups are quick */
async function buildBackup(){
  const meta=(await Store.all('meta')).filter(m=>m.id!=='__probe'); const ids=new Set(meta.map(m=>m.id));
  const parts=[];
  for(const id of ids){
    let j=BK.cache.get(id);
    if(j==null){ const t=await Store.get('texts',id).catch(()=>null); if(!t) continue; j=JSON.stringify(await toPortable(t)); BK.cache.set(id,j); }
    parts.push(j);
  }
  for(const k of [...BK.cache.keys()]) if(!ids.has(k)) BK.cache.delete(k);
  const head=JSON.stringify({app:'Tooz', version:2, savedAt:new Date().toISOString(), meta, words:WORDS, stats:LS.get('stats',{}), archive:ARCH.list(), settings:S, prefs:{libSort:LS.get('libSort',null), qstyle:LS.get('qstyle',null), notesSeg:LS.get('notesSeg',null)}});
  return head.slice(0,-1)+',"texts":['+parts.join(',')+']}';
}
function backupDone(){ LS.set('bk.at',Date.now()); LS.set('bk.sig',librarySig()); if($('#bkLast')) bkSettingsUI(); }
async function backup(){
  if(BK.dir){ await folderBackup(true); return; }
  try{
    progress('Preparing the backup…', null);
    const data=await buildBackup();
    const filename=`tooz-backup-${dayKey()}.json`;
    const blob=new Blob([data], {type:'application/json'});
    $('#toast').hidden=true;
    if(navigator.share && navigator.canShare){
      const file=new File([blob], filename, {type:'application/json'});
      if(navigator.canShare({files:[file]})){ await navigator.share({files:[file]}); backupDone(); toast('Backup saved'); return; }
    }
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    backupDone(); toast('Backup downloaded');
  }catch(e){ if(e && e.name==='AbortError') toast('Backup cancelled'); else toast('Couldn’t save the backup'); }
}
$('#restoreIn').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  let b; try{ b=JSON.parse(await f.text()); if(!b||!/^(ReadFast|Tooz)$/.test(b.app)||!Array.isArray(b.meta)||!Array.isArray(b.texts)) throw 0; b.words=Array.isArray(b.words)?b.words:[]; b.stats=(b.stats&&typeof b.stats==='object')?b.stats:{}; }catch(err){ toast('That file isn’t a Tooz backup, or it’s incomplete.', null, 6000); return; }
  openSheet('Restore backup', `<p class="note">This backup from ${esc(new Date(b.savedAt).toLocaleString())} has ${b.meta.length} document${b.meta.length===1?'':'s'} and ${b.words.length} saved word${b.words.length===1?'':'s'}. They’ll be added to what’s here now. Documents already on this phone are replaced by their backed-up copy.</p>${b.settings&&typeof b.settings==='object'?`<label class="set" style="display:flex;gap:10px;align-items:center;margin:0 0 12px"><input type="checkbox" id="rsSettings" checked> <span>Also restore reading and app settings</span></label>`:''}<button class="btn primary block" type="button" data-act="go">Restore</button>`,{
    go:async()=>{
      const withSettings=!!($('#rsSettings')&&$('#rsSettings').checked);
      closeSheet(); if(R.meta && !R.mode) R.meta=null;
      try{
        let k=0; const tot=b.texts.length+b.meta.length;
        BK.cache.clear();
        for(const t of b.texts){ progress('Restoring … '+(++k)+' of '+tot, 100*k/tot); await Store.put('texts',fromPortable(t)); }
        for(const m of b.meta){ progress('Restoring … '+(++k)+' of '+tot, 100*k/tot); await Store.put('meta',m); }
        LIB=await Store.all('meta');
        const have=new Set(WORDS.map(w=>w.id)); for(const w of b.words) if(!have.has(w.id)) WORDS.push(w); WORDS.sort((a,c)=>c.at-a.at); saveWords();
        if(Array.isArray(b.archive)){ const have=new Set(ARCH.list().map(a=>a.id+'|'+a.archivedAt)); for(const a of b.archive) if(!have.has(a.id+'|'+a.archivedAt)) ARCH.list().push(a); ARCH.list().sort((x,y)=>y.archivedAt-x.archivedAt); ARCH.save(); }
        migrateTags();
        const st=LS.get('stats',{}); for(const k in b.stats){ if(!st[k]||(st[k].ms||0)<(b.stats[k].ms||0)) st[k]=b.stats[k]; } LS.set('stats',st);
        if(withSettings){ for(const k in b.settings){ if(k in DEFAULTS && typeof b.settings[k]===typeof DEFAULTS[k]) S[k]=b.settings[k]; } saveSettings(); applyLook();
          const pf=b.prefs||{}; for(const k of ['libSort','qstyle','notesSeg']) if(pf[k]!=null) LS.set(k,pf[k]); }
        renderLibrary(); renderWords(); if(!$('#v-settings').hidden) renderSettings(); toast('Backup restored');
      }catch(err){ console.error(err); toast('The backup couldn’t be fully restored'+(err&&err.name==='QuotaExceededError'?' because the phone’s storage for Tooz is full':'')+'.', null, 8000); try{ LIB=await Store.all('meta'); renderLibrary(); }catch(_){} }
    }});
});


/* ---------- backup folder and automatic backups ---------- */
const BK={dir:null, busy:false, cache:new Map(), asked:false, reminded:false, timer:0};
function canPickFolder(){ try{ return typeof window.showDirectoryPicker==='function' && window.self===window.top; }catch(e){ return false; } }
function kvDB(){ return new Promise(res=>{ try{ const r=indexedDB.open('tooz-kv',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); r.onblocked=()=>res(null); }catch(e){ res(null); } }); }
async function kvGet(k){ const db=await kvDB(); if(!db) return null; return new Promise(res=>{ try{ const q=db.transaction('kv').objectStore('kv').get(k); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }catch(e){ res(null); } }); }
async function kvSet(k,v){ const db=await kvDB(); if(!db) return; return new Promise(res=>{ try{ const t=db.transaction('kv','readwrite'); const os=t.objectStore('kv'); if(v==null) os.delete(k); else os.put(v,k); t.oncomplete=()=>res(); t.onerror=()=>res(); }catch(e){ res(); } }); }
/* changes whenever anything a backup holds changes */
function librarySig(){
  let mod=0; for(const m of LIB) mod=Math.max(mod, m.mod||0, m.lastRead||0);
  const st=LS.get('stats',{}); let ms=0; for(const k in st) ms+=(st[k].ms||0);
  const ar=ARCH.list(); return [LIB.length, mod, WORDS.length, WORDS[0]?WORDS[0].at:0, Math.round(ms/1000), ar.length, ar[0]?ar[0].archivedAt:0].join('|');
}
const bkChanged=()=>LS.get('bk.sig','')!==librarySig();
function fmtWhen(t){ if(!t) return 'never'; const d=new Date(t); return d.toDateString()===new Date().toDateString()? 'today at '+d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : d.toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'}); }
function bkSettingsUI(){
  const last=$('#bkLast'); if(last) last.textContent='Last backup: '+fmtWhen(LS.get('bk.at',0))+(LS.get('bk.at',0)&&bkChanged()?' · changes since then':'');
  const f=$('#bkFolder'); if(!f) return;
  f.innerHTML=BK.dir?`Saving to <b>${esc(BK.dir.name)}</b>`+(LS.get('bk.err','')?`<br><span style="color:var(--danger)">${esc(LS.get('bk.err',''))}</span>`:''):'No folder chosen. Choose one and backups happen automatically.';
  $('#bkPick').textContent=BK.dir?'Change folder':'Choose folder'; $('#bkOff').hidden=!BK.dir;
}
async function pickBackupFolder(){
  let h; try{ h=await window.showDirectoryPicker({id:'tooz-backup', mode:'readwrite', startIn:'documents'}); }catch(e){ if(!(e&&e.name==='AbortError')) toast('This browser wouldn’t open a folder picker.'); return; }
  BK.dir=h; await kvSet('backupDir',h); LS.set('bk.err',''); bkSettingsUI();
  await folderBackup(true);
}
async function folderPermission(ask){
  try{
    const o={mode:'readwrite'}; if(await BK.dir.queryPermission(o)==='granted') return true;
    if(ask) return (await BK.dir.requestPermission(o))==='granted';
  }catch(e){}
  return false;
}
/* write tooz-backup.json, plus one dated copy per day (the last 7 are kept) */
async function folderBackup(manual){
  if(!BK.dir || BK.busy) return false;
  if(!manual && !bkChanged()) return true;
  if(!await folderPermission(manual)){ if(manual) toast('Tooz needs permission to save in “'+BK.dir.name+'”.'); else askFolderAgain(); return false; }
  BK.busy=true;
  try{
    if(manual) progress('Saving the backup…', null);
    const sig=librarySig(); const data=await buildBackup(); const blob=new Blob([data],{type:'application/json'});
    for(const name of ['tooz-backup.json', `tooz-backup-${dayKey()}.json`]){
      const fh=await BK.dir.getFileHandle(name,{create:true}); const w=await fh.createWritable(); await w.write(blob); await w.close();
    }
    try{ const dated=[]; for await (const [n] of BK.dir.entries()) if(/^tooz-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)) dated.push(n); dated.sort(); for(const n of dated.slice(0,Math.max(0,dated.length-7))) await BK.dir.removeEntry(n); }catch(e){}
    LS.set('bk.at',Date.now()); LS.set('bk.sig',sig); LS.set('bk.err','');
    if(manual) toast('Backup saved to “'+BK.dir.name+'”');
    bkSettingsUI(); return true;
  }catch(e){
    LS.set('bk.err','The last automatic backup failed ('+((e&&(e.name||e.message))||'error')+'). Choose the folder again if it was moved.');
    if(manual) toast('Couldn’t save to “'+BK.dir.name+'”. Choose the folder again.', null, 6000); bkSettingsUI(); return false;
  }finally{ BK.busy=false; }
}
function askFolderAgain(){
  if(BK.asked || document.hidden) return; BK.asked=true;
  toast('Allow Tooz to keep saving backups to “'+BK.dir.name+'”?', {label:'Allow', fn:()=>folderBackup(true)}, 12000);
}
function remindBackup(){
  if(BK.dir || BK.reminded || !S.bkRemind || !LIB.some(m=>m.kind!=='sample'&&!m.pending) || !bkChanged()) return;
  const at=LS.get('bk.at',0); if(at && Date.now()-at < S.bkRemind*864e5) return;
  BK.reminded=true;
  setTimeout(()=>{ if($('#v-library').hidden && $('#v-words').hidden) { BK.reminded=false; return; } toast(at?'It’s been a while since your last backup':'Your library hasn’t been backed up yet', {label:'Save backup', fn:backup}, 12000); }, 1500);
}
async function initBackups(){
  if(canPickFolder()){
    const h=await kvGet('backupDir'); if(h && h.kind==='directory'){ BK.dir=h; if(!await folderPermission(false)) askFolderAgain(); }
  }
  const auto=()=>{ if(BK.dir) folderBackup(false); };
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) auto(); else remindBackup(); });
  window.addEventListener('pagehide',auto);
  BK.timer=setInterval(()=>{ if(!document.hidden) auto(); }, 3*60*1000);
  remindBackup();
}


/* ---------- library: sort, filter, search ---------- */
const LIBSORTS=[['recent','Recently read'],['title','Title A–Z'],['author','Author A–Z']];
let LIBV={sort:LS.get('libSort','recent'), q:''};
if(!LIBSORTS.some(([k])=>k===LIBV.sort)) LIBV.sort='recent';
/* opened and not finished = in progress */
const isReading=d=>!d.pending && !d.finished && ((d.pos||0)>0 || (d.lastRead||0)>0);
const STATUS=[['reading','Reading',isReading],['unread','Not started',d=>!d.finished&&!isReading(d)],['done','Finished',d=>!!d.finished]];
const normTag=t=>t.replace(/\s+/g,' ').trim().slice(0,40);
const tagsOf=d=>Array.isArray(d.tags)?d.tags:[];
const sortKey=t=>(t||'').toLowerCase().replace(/^(the|a|an)\s+/,'').trim();
const byName=(a,b)=>a.localeCompare(b, undefined, {sensitivity:'base', numeric:true});
function allTags(){ const m=new Map(); for(const d of LIB) for(const t of tagsOf(d)){ const k=t.toLowerCase(); if(!m.has(k)) m.set(k,t); } return [...m.values()].sort(byName); }
function allOf(key){ const m=new Map(); for(const d of LIB){ const v=(d[key]||'').trim(); if(v && !m.has(v.toLowerCase())) m.set(v.toLowerCase(), v); } return [...m.values()].sort(byName); }
function docCard(d){
  const pct=d.finished?100:Math.round(100*d.pos/Math.max(1,d.count-1));
  const left=fmtMins((d.count-d.pos)/(S.measuredWpm||230));
  const tg=tagsOf(d); const sz=d.pending&&SHELF_SIZE[d.id];
  return `<div class="doc" data-open="${d.id}" role="button" tabindex="0" style="--p:${d.pending?0:pct}%">
      <div class="t"><span class="tag">${KIND[d.kind]||'Text'}</span>${esc(d.title)}</div>
      <button class="icon-btn more" type="button" data-more="${d.id}" aria-label="Edit or organize ${esc(d.title)}">${ICON.more}</button>
      ${d.author?`<div class="a">${esc(d.author)}</div>`:''}
      <div class="m">${d.pending? 'Free book · tap to download'+(sz?' ('+sz+')':'') : d.count.toLocaleString()+' words · '+(d.finished?'Finished':pct+'% · '+left+' left')}</div>
      ${tg.length?`<div class="tg">${tg.map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}</div>`;
}
/* "Jane Austen" sorts under Austen */
function authorKey(a){ const first=a.split(/,|&| and /)[0].trim(); if(a.includes(',')&&!/,.*,/.test(a)&&first.split(' ').length===1) return a.toLowerCase(); const p=first.split(/\s+/); return (p.length>1?p[p.length-1]+' '+p.slice(0,-1).join(' '):first).toLowerCase(); }

/* Filters last until the app is closed. OR inside a section, AND across sections. */
const FSEC=[['st','Reading status'],['ti','Title'],['au','Author'],['tg','Tags']];
const F={st:new Set(), ti:new Set(), au:new Set(), tg:new Set()};
const fCount=()=>F.st.size+F.ti.size+F.au.size+F.tg.size;
const NOAUTH='Unknown author';
const authorOf=d=>(d.author||'').trim()||NOAUTH;
function matchSec(d, sec, set){
  set=set||F[sec]; if(!set.size) return true;
  if(sec==='st') return [...set].some(k=>STATUS.find(x=>x[0]===k)[2](d));
  if(sec==='ti') return set.has(d.id);
  if(sec==='au') return set.has(authorOf(d).toLowerCase());
  return tagsOf(d).some(t=>set.has(t.toLowerCase()));
}
const matchAll=(d,except)=>FSEC.every(([k])=>k===except || matchSec(d,k));
/* the choices a section offers: only those with a book that fits every other section; anything already picked stays listed */
function secOptions(sec){
  const pool=LIB.filter(d=>matchAll(d,sec)); const out=new Map();
  const add=(key,label,sortk)=>{ const o=out.get(key)||{key,label,sortk,n:0}; o.n++; out.set(key,o); };
  for(const d of pool){
    if(sec==='st'){ for(const [k,l,f] of STATUS) if(f(d)) add(k,l,STATUS.findIndex(x=>x[0]===k)); }
    else if(sec==='ti') add(d.id, d.title, sortKey(d.title));
    else if(sec==='au'){ const a=authorOf(d); add(a.toLowerCase(), a, a===NOAUTH?'￿':authorKey(a)); }
    else for(const t of tagsOf(d)) add(t.toLowerCase(), t, t.toLowerCase());
  }
  for(const k of F[sec]) if(!out.has(k)) out.set(k, {key:k, label:labelOf(sec,k), sortk:sec==='st'?STATUS.findIndex(x=>x[0]===k):(labelOf(sec,k)||'').toLowerCase(), n:0});
  return [...out.values()].sort((a,b)=> sec==='st'? a.sortk-b.sortk : byName(String(a.sortk),String(b.sortk)));
}
function labelOf(sec,k){
  if(sec==='st') return (STATUS.find(x=>x[0]===k)||[,k])[1];
  if(sec==='ti'){ const d=LIB.find(x=>x.id===k); return d?d.title:'(removed)'; }
  if(sec==='au'){ const d=LIB.find(x=>authorOf(x).toLowerCase()===k); return d?authorOf(d):k; }
  for(const d of LIB) for(const t of tagsOf(d)) if(t.toLowerCase()===k) return t; return k;
}
function toggleFilter(sec,k,on){ const s=F[sec]; if(on===undefined) on=!s.has(k); on? s.add(k) : s.delete(k); }
function clearFilters(){ for(const [k] of FSEC) F[k].clear(); }
/* drop picks that no longer exist (a deleted book or tag) */
function pruneFilters(){ for(const k of [...F.ti]) if(!LIB.some(d=>d.id===k)) F.ti.delete(k); for(const k of [...F.au]) if(!LIB.some(d=>authorOf(d).toLowerCase()===k)) F.au.delete(k); for(const k of [...F.tg]) if(!LIB.some(d=>tagsOf(d).some(t=>t.toLowerCase()===k))) F.tg.delete(k); }
const SECCLS={st:'f-st',ti:'f-ti',au:'f-au',tg:'f-tg'}, SECKEY={st:'Status',ti:'Title',au:'Author',tg:'Tag'};
function renderLibTools(){
  $('#sortBtn').innerHTML=ICON.sort; const n=fCount();
  $('#filterBtn').innerHTML=ICON.filter+(n?`<span class="badge">${n}</span>`:''); $('#filterBtn').classList.toggle('on',!!n);
  const pills=[]; for(const [sec] of FSEC) for(const k of F[sec]) pills.push(`<button class="pill ${SECCLS[sec]}" type="button" data-unf="${sec}" data-k="${esc(k)}" aria-label="Remove ${SECKEY[sec]} filter ${esc(labelOf(sec,k))}"><span class="x">✕</span><span class="k">${SECKEY[sec]}</span><span class="v">${esc(labelOf(sec,k))}</span></button>`);
  if(pills.length>1) pills.push('<button class="pill clear" type="button" data-unf="all">Clear all</button>');
  $('#libPills').hidden=!pills.length; $('#libPills').innerHTML=pills.join('');
  renderSuggest();
}
/* typing shows matching titles, authors and tags to tap */
function renderSuggest(){
  const q=LIBV.q.trim().toLowerCase(), box=$('#libSug');
  if(!q){ box.hidden=true; box.innerHTML=''; return; }
  const hits=[];
  for(const [sec] of [['tg'],['au'],['ti']]){ let n=0; for(const o of secOptions(sec)){ if(F[sec].has(o.key) || !o.label.toLowerCase().includes(q)) continue; hits.push(`<button class="pill ${SECCLS[sec]}" type="button" data-sug="${sec}" data-k="${esc(o.key)}"><span class="x">+</span><span class="k">${SECKEY[sec]}</span><span class="v">${esc(o.label)}</span></button>`); if(++n>=6) break; } }
  if(q.length>=3 && LIB.some(d=>!d.pending)) hits.push(`<button class="pill ftpill" type="button" data-fts="1"><span class="x">⌕</span><span class="v">Search inside books for “${esc(LIBV.q.trim())}”</span></button>`);
  box.hidden=!hits.length; box.innerHTML=hits.join('');
}
function renderLibrary(){
  const el=$('#docList');
  pruneFilters(); renderLibTools();
  $('#libTools').hidden=LIB.length<2 && !fCount();
  if(!LIB.length){ el.innerHTML=`<div class="empty">Nothing here yet. Tap <b>Add to library</b> to paste text, load a link or open a book file.</div>`; return; }
  const q=LIBV.q.trim().toLowerCase();
  let docs=LIB.filter(d=>matchAll(d));
  if(q) docs=docs.filter(d=>[d.title,d.author,...tagsOf(d)].some(x=>(x||'').toLowerCase().includes(q)));
  if(!docs.length){ el.innerHTML=`<div class="empty">No books match${q?' “'+esc(LIBV.q.trim())+'”':''}${fCount()?' with these filters':''}.${fCount()?' <button class="btn" type="button" data-unf="all" style="margin-top:10px">Clear all filters</button>':''}</div>`; return; }
  /* books in progress sit on top under Continue reading, but only while nothing is filtered or searched */
  let top='';
  if(!fCount() && !q){ const cont=docs.filter(isReading).sort((a,b)=>(b.lastRead||0)-(a.lastRead||0)); if(cont.length && cont.length<docs.length){ top=`<h3 class="grp">Continue reading <span>${cont.length}</span></h3>`+cont.map(docCard).join('')+'<h3 class="grp">Everything else</h3>'; docs=docs.filter(d=>!isReading(d)); } }
  const recent=(a,b)=>(b.lastRead||b.added)-(a.lastRead||a.added);
  const titleSort=(a,b)=>byName(sortKey(a.title),sortKey(b.title));
  if(LIBV.sort==='title'){ el.innerHTML=top+docs.sort(titleSort).map(docCard).join(''); return; }
  if(LIBV.sort==='author'){
    const groups=new Map(); for(const d of docs){ const a=authorOf(d); const k=a.toLowerCase(); if(!groups.has(k)) groups.set(k,{name:a,docs:[]}); groups.get(k).docs.push(d); }
    const keys=[...groups.values()].sort((a,b)=> a.name===NOAUTH?1 : b.name===NOAUTH?-1 : byName(authorKey(a.name),authorKey(b.name)));
    el.innerHTML=top+keys.map(g=>`<h3 class="grp">${esc(g.name)} <span>${g.docs.length}</span></h3>`+g.docs.sort(titleSort).map(docCard).join('')).join(''); return;
  }
  el.innerHTML=top+docs.sort(recent).map(docCard).join('');
}
function openSort(){
  openSheet('Sort by', LIBSORTS.map(([k,l])=>`<button class="sortopt" type="button" data-act="pick" data-s="${k}" aria-pressed="${LIBV.sort===k}">${LIBV.sort===k?'✓ ':''}${l}</button>`).join(''), {
    pick:(b)=>{ LIBV.sort=b.dataset.s; LS.set('libSort',LIBV.sort); closeSheet(); renderLibrary(); }
  });
}
/* Filter sheet: four collapsible sections; lists update in place so open sections and typed searches stay put */
const FOPEN={st:true, ti:false, au:false, tg:false}, FQ={st:'',ti:'',au:'',tg:''};
function openFilter(){
  openSheet('Filter', `${FSEC.map(([sec,l])=>`<details class="fsec ${SECCLS[sec]}" data-sec="${sec}"${FOPEN[sec]?' open':''}><summary><span class="dot"></span>${l}<span class="n" data-n="${sec}"></span><span class="chev">›</span></summary>${sec==='st'?'':`<input class="input fin" type="search" data-fq="${sec}" placeholder="Search ${l.toLowerCase()}" value="${esc(FQ[sec])}" autocomplete="off" autocapitalize="off" spellcheck="false">`}<div class="fopts" data-opts="${sec}"></div></details>`).join('')}
    <div class="row" style="margin-top:6px"><button class="btn" type="button" data-act="clear">Clear all filters</button><button class="btn primary" type="button" data-act="done" id="fDone">Show books</button></div>`, {
    clear:()=>{ clearFilters(); fillFilter(); renderLibrary(); },
    done:()=>closeSheet()
  });
  const sh=$('#sheet');
  sh.querySelectorAll('details.fsec').forEach(d=>d.addEventListener('toggle',()=>{ FOPEN[d.dataset.sec]=d.open; }));
  sh.querySelectorAll('[data-fq]').forEach(i=>i.addEventListener('input',()=>{ FQ[i.dataset.fq]=i.value; fillFilter(); }));
  fillFilter();
}
function fillFilter(){
  for(const [sec] of FSEC){
    const box=document.querySelector(`#sheet [data-opts="${sec}"]`); if(!box) return;
    const q=FQ[sec].trim().toLowerCase();
    const opts=secOptions(sec).filter(o=>!q || o.label.toLowerCase().includes(q));
    box.innerHTML=opts.length? opts.map(o=>`<button class="fopt" type="button" data-fopt="${sec}" data-k="${esc(o.key)}" aria-pressed="${F[sec].has(o.key)}"><span class="bx">${F[sec].has(o.key)?'✓':''}</span><span class="lb">${esc(o.label)}</span><span class="ct">${o.n}</span></button>`).join('') : `<p class="note" style="margin:6px 8px">${q?'Nothing matches.':'No matching books.'}</p>`;
    const n=document.querySelector(`#sheet [data-n="${sec}"]`); if(n) n.textContent=F[sec].size? F[sec].size+' selected' : '';
  }
  const shown=LIB.filter(d=>matchAll(d)).length; const b=$('#fDone'); if(b) b.textContent=`Show ${shown} book${shown===1?'':'s'}`;
}
document.addEventListener('click',e=>{
  const o=e.target.closest('#sheet [data-fopt]'); if(!o) return;
  toggleFilter(o.dataset.fopt, o.dataset.k); fillFilter(); renderLibrary();
});
$('#sortBtn').onclick=openSort;
$('#filterBtn').onclick=openFilter;
$('#v-library').addEventListener('click',e=>{
  const u=e.target.closest('[data-unf]'); if(u){ if(u.dataset.unf==='all') clearFilters(); else toggleFilter(u.dataset.unf,u.dataset.k,false); renderLibrary(); return; }
  if(e.target.closest('[data-fts]')){ searchAllBooks(LIBV.q); return; }
  const g=e.target.closest('[data-sug]'); if(g){ toggleFilter(g.dataset.sug,g.dataset.k,true); LIBV.q=''; $('#libFind').value=''; renderLibrary(); }
});
$('#libFind').addEventListener('input',e=>{ LIBV.q=e.target.value; renderLibrary(); });
$('#addBtn').innerHTML=ICON.plus+'Add to library';
$('#addBtn').onclick=()=>openSheet('Add to library', `
  <button class="addopt" type="button" data-act="file">${ICON.file}<span><b>Open a file</b><small>EPUB, PDF, TXT, Markdown or HTML</small></span></button>
  <button class="addopt" type="button" data-act="link">${ICON.link}<span><b>Paste a link</b><small>Loads the article from a web page</small></span></button>
  <button class="addopt" type="button" data-act="paste">${ICON.paste}<span><b>Paste text</b><small>Copied text, or anything you type</small></span></button>
  <button class="addopt" type="button" data-act="free">${ICON.book}<span><b>Find free books</b><small>Search 75,000 classics from Project Gutenberg</small></span></button>`, {
  free:()=>{ closeSheet(); setTimeout(openFreeBooks, 30); },
  file:()=>{ closeSheet(); $('#fileIn').value=''; $('#fileIn').click(); },
  link:()=>{ closeSheet(); openLink(); },
  paste:()=>{ closeSheet(); openPaste(false); }
});

function docOptions(id, keep){
  const d=LIB.find(x=>x.id===id); if(!d) return;
  const draft=keep||{title:d.title, author:d.author||'', tags:[...tagsOf(d)]};
  const has=t=>draft.tags.some(x=>x.toLowerCase()===t.toLowerCase());
  const auths=allOf('author'), known=allTags().filter(t=>!has(t));
  const nNotes=(d.highlights||[]).length+(d.bookmarks||[]).length;
  const grab=()=>{ draft.title=$('#edTitle').value; draft.author=$('#edAuthor').value; };
  const addTag=()=>{ grab(); const v=normTag($('#edTag').value); if(v && !has(v)) draft.tags.push(v); docOptions(id, draft); setTimeout(()=>{ const t=$('#edTag'); t&&t.focus(); },30); };
  openSheet('Edit and organize', `
    <div class="field"><label for="edTitle">Title</label><input class="input" id="edTitle" value="${esc(draft.title)}"></div>
    <div class="field"><label for="edAuthor">Author</label><input class="input" id="edAuthor" list="dlAuthors" value="${esc(draft.author)}" placeholder="Unknown"><datalist id="dlAuthors">${auths.map(a=>`<option value="${esc(a)}">`).join('')}</datalist></div>
    <div class="field"><label for="edTag">Tags</label>
      <div class="row" style="flex-wrap:nowrap"><input class="input" id="edTag" placeholder="Add a tag" enterkeyhint="done" autocomplete="off" style="flex:1;min-width:0"><button class="btn" type="button" data-act="addtag" style="flex:none;padding-left:20px;padding-right:20px">Add</button></div>
      ${draft.tags.length?`<div class="tagchips">${draft.tags.map((t,k)=>`<button class="chip" type="button" data-act="rmtag" data-k="${k}" aria-pressed="true" aria-label="Remove tag ${esc(t)}">${esc(t)}<span class="x">✕</span></button>`).join('')}</div>`:''}
      <div id="tagSug">${d.pending?`<p class="note" style="margin:10px 0 0">Download this book to see tag suggestions drawn from its text.</p><button class="btn" type="button" data-act="dltag" style="margin-top:8px">Download “${esc(d.title)}”${SHELF_SIZE[d.id]?' ('+SHELF_SIZE[d.id]+')':''}</button>`:'<p class="note" style="margin:10px 0 0">Finding suggestions…</p>'}</div>
      ${known.length?`<details class="tdet" id="knownDet"><summary id="knownHd">Your other tags <span>(${known.length})</span></summary><div class="tagchips" id="knownTags">${known.map(t=>`<button class="chip" type="button" data-act="usetag" data-v="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div></details>`:''}
    </div>
    <button class="btn primary block" type="button" data-act="save">Save</button>
    ${nNotes?`<button class="btn block" type="button" data-act="notes">${ICON.note} Highlights &amp; bookmarks (${nNotes})</button><button class="btn block" type="button" data-act="export">Export highlights and notes</button>`:''}
    <button class="btn block" type="button" data-act="restart">Start over from the beginning</button>
    <button class="btn block" type="button" data-act="archive">${ICON.archive} Archive</button>
    <div id="delZone"><button class="btn block danger" type="button" data-act="askdel">${ICON.trash} Delete from library</button></div>`, {
    addtag:addTag,
    usetag:(b)=>{ grab(); if(!has(b.dataset.v)) draft.tags.push(b.dataset.v); docOptions(id, draft); },
    rmtag:(b)=>{ grab(); draft.tags.splice(+b.dataset.k,1); docOptions(id, draft); },
    dltag:async()=>{ grab(); closeSheet(); if(await fetchShelfBook(d)) docOptions(id, draft); },
    save:()=>{ grab(); const t=draft.title.trim(); if(!t){ toast('The title can’t be empty'); return; }
      const pend=normTag($('#edTag').value); if(pend && !has(pend)) draft.tags.push(pend);
      d.title=t; d.author=draft.author.replace(/\s+/g,' ').trim(); d.tags=draft.tags.map(normTag).filter(Boolean);
      touch(d); renderLibrary(); closeSheet(); toast('Saved'); },
    notes:async()=>{ closeSheet(); if(await openDoc(id)!==false){ R.returnTo='library'; openToc((d.highlights||[]).length?'hls':'marks'); } },
    export:()=>exportSheet(d),
    restart:async()=>{ if(R.meta&&R.meta.id===id&&R.mode) closeReader(); startOver(d); renderLibrary(); closeSheet(); toast('Back to the beginning'); },
    archive:()=>archiveFlow(id),
    askdel:()=>{ revealEnd('#delZone'); $('#delZone').innerHTML=`<p class="note">Delete “${esc(d.title)}” and its highlights and bookmarks? Your saved words stay in Notes.</p><div class="row"><button class="btn" type="button" data-act="nodel">Keep it</button><button class="btn primary" style="background:var(--danger);border-color:var(--danger)" type="button" data-act="del">Delete</button></div>`; },
    nodel:()=>docOptions(id, draft),
    del:async()=>{ await removeBook(id); renderLibrary(); closeSheet(); toast('Deleted'); }
  });
  const ti=$('#edTag');
  if(ti){
    ti.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); addTag(); } });
    /* typing narrows the suggestions to matching tags */
    ti.addEventListener('input',()=>filterTagChips(ti.value));
  }
  if(!d.pending) suggestTags(d).then(list=>{ const box=$('#tagSug'); if(!box||!$('#edTag')) return; const l=list.filter(t=>!has(t));
    box.innerHTML=l.length?`<div class="small" id="sugHd" style="margin-top:12px;color:var(--muted)">Suggested for this book</div><div class="tagchips">${l.map(t=>`<button class="chip" type="button" data-act="usetag" data-v="${esc(t)}">+ ${esc(t)}</button>`).join('')}</div>`:'';
    filterTagChips($('#edTag').value||''); });
}
/* typing in the tag box narrows both chip lists; a list with no matches hides its heading */
function filterTagChips(v){ const q=(v||'').trim().toLowerCase();
  const sug=[...document.querySelectorAll('#tagSug .chip')]; sug.forEach(c=>{ c.hidden=!!q && !c.dataset.v.toLowerCase().includes(q); }); const h=$('#sugHd'); if(h) h.hidden=!sug.some(c=>!c.hidden);
  /* your other tags stay folded away unless what you type matches one */
  const det=$('#knownDet'); if(det){ const kn=[...det.querySelectorAll('.chip')]; kn.forEach(c=>{ c.hidden=!!q && !c.dataset.v.toLowerCase().includes(q); }); const any=kn.some(c=>!c.hidden); det.hidden=!!q && !any; if(q && any) det.open=true; } }
/* a book at 98% or more that isn't marked finished: ask once, then stay quiet until more of it is read */
function nearFinishCheck(){
  if($('#v-library').hidden || !$('#sheet').hidden || (R.meta&&R.mode)) return;
  const d=LIB.filter(m=>!m.pending && !m.finished && m.kind!=='sample' && (m.count||0)>1 && (m.pos||0)/(m.count-1)>=0.98 && !((m.nearAsked||-1)>=(m.pos||0))).sort((a,b)=>(b.lastRead||0)-(a.lastRead||0))[0];
  if(!d) return;
  openSheet('Have you finished this book?', `<p class="note" style="margin-top:0">You’re ${Math.floor(100*(d.pos||0)/(d.count-1))}% of the way through “${esc(d.title)}”. Have you finished it?</p><div class="row"><button class="btn" type="button" data-act="no">Not yet</button><button class="btn primary" type="button" data-act="yes">Yes, I finished</button></div>`, {
    yes:()=>{ d.finished=true; d.finishedAt=Date.now(); d.keepFinished=false; touch(d); renderLibrary(); finishPrompt(d.id); },
    no:()=>openSheet('Finish it now?', `<p class="note" style="margin-top:0">Do you want to finish “${esc(d.title)}” now?</p><div class="row"><button class="btn" type="button" data-act="later">No</button><button class="btn primary" type="button" data-act="now">Yes, open it</button></div>`, {
      now:()=>{ closeSheet(); openDoc(d.id); },
      later:()=>{ d.nearAsked=d.pos||0; touch(d); closeSheet(); }
    })
  });
}
/* bring a confirmation that just appeared at the bottom of a sheet into view */
function revealEnd(sel){ setTimeout(()=>{ const el=$(sel); if(el) el.scrollIntoView({block:'end', behavior:'smooth'}); }, 60); }
function startOver(d){ d.pos=0; d.finished=false; d.lastRead=0; d.keepFinished=false; d.finishedAt=null; d.nearAsked=null; LS.set('pos.'+d.id,{pos:0,t:0,fin:false}); touch(d); }
async function removeBook(id){
  if(R.meta&&R.meta.id===id){ if(R.mode) closeReader(true); R.meta=null; }
  try{ localStorage.removeItem('rf.pos.'+id); }catch(e){}
  await Store.del('meta',id).catch(()=>{}); await Store.del('texts',id).catch(()=>{}); LIB=LIB.filter(x=>x.id!==id); BK.cache.delete(id);
}

/* ---------- tag suggestions: keywords in the book's own text ---------- */
/* Topic keywords. A two-word entry is a phrase ("holy spirit"). A topic is suggested when its words are common in the book
   and at least three different ones turn up regularly, so one frequent word can't carry it alone. */
const TOPICS={
  'Theology':['god','christ','grace','faith','sin','salvation','gospel','righteousness','redemption','doctrine','divine','atonement','justification','holy spirit'],
  'Holy Spirit':['holy spirit','holy ghost','spirit','comforter','pentecost','indwelling'],
  'Prayer':['pray','prayer','prayed','praying','prayers','supplication','intercession'],
  'Devotional':['soul','the lord','heart','humility','meditate','devotion','communion','abide','dear lord','thy'],
  'Apologetics':['christianity','reason','belief','truth','sceptic','skeptic','rationalist','materialist','materialism','argument','unbeliever'],
  'Church History':['martyr','martyrs','persecution','bishop','bishops','pope','council','heretic','heretics','reformers','emperor'],
  'Church':['church','congregation','pastor','minister','elders','sacrament','baptism','the church','deacons'],
  'Worship':['worship','praise','hymn','hymns','sing','glory','psalm','adoration'],
  'Heaven':['heaven','eternal','eternity','paradise','angels','eternal life','the kingdom','celestial'],
  'Suffering':['suffering','affliction','afflictions','trial','trials','sorrow','grief','pain','tears','comfort'],
  'Holiness':['holiness','sanctification','sanctified','obedience','mortify','mortification','purity','sanctify'],
  'Grace':['grace','mercy','forgiveness','pardon','gracious','undeserved','free grace'],
  'Marriage':['marriage','husband','wife','married','wedding','bride','bridegroom'],
  'Scripture':['scripture','scriptures','the bible','the word','word of god','apostle','prophet','prophets','israel','moses'],
  'Missions':['missionary','missionaries','missions','heathen','nations','the gospel','preached'],
  'Adventure':['ship','island','treasure','captain','sword','voyage','pirate','escape','danger','journey'],
  'Sea':['sea','ship','whale','sail','sailors','deck','boat','ocean','waves','harpoon'],
  'Mystery':['detective','clue','inspector','mystery','evidence','suspect','the case','scotland yard'],
  'Romance':['love','marriage','married','marry','lover','engagement','affection','in love'],
  'War':['war','battle','soldier','soldiers','army','enemy','regiment','troops','general'],
  'History':['king','empire','century','history','kingdom','emperor','revolution','nation','reign'],
  'Philosophy':['reason','virtue','nature','wisdom','truth','philosophy','universe','soul','happiness','existence'],
  'Crime':['crime','murder','prison','police','criminal','guilt','punishment','theft'],
  'Mythology':['gods','goddess','zeus','olympus','athena','apollo','heroes','jove'],
  'Nature':['trees','forest','river','mountain','flowers','fields','birds'],
  'Politics':['government','law','liberty','state','rights','parliament','republic','citizens'],
  'Slavery':['slave','slavery','slaves','master','freedom','plantation','overseer'],
  'Death':['death','grave','dying','funeral','dead','tomb'],
  'Money':['money','wealth','rich','fortune','poor','poverty','pounds'],
  'Travel':['journey','travel','road','city','voyage','traveller','inn'],
  'Gothic':['castle','ghost','gloomy','dread','horror','ruins','haunted','candle','corridor'],
  'Horror':['horror','terror','monster','dread','fiend','blood','shriek'],
  'Fantasy':['magic','wizard','dragon','enchanted','fairy','spell','enchantment','elves'],
  'Science Fiction':['machine','planet','scientist','experiment','martian','martians','invention','time machine'],
  'Western':['ranch','cattle','sheriff','cowboy','saddle','frontier','prairie','canyon'],
  'Revenge':['revenge','vengeance','avenge','enemy','enemies','hatred'],
  'Russian Literature':['russian','moscow','petersburg','rouble','roubles','prince','count'],
  'France':['paris','french','monsieur','madame','france'],
  'England':['london','england','english','lord','lady','parish'],
  'America':['america','american','states','washington','yankee','dollars']
};
const STOP=new Set('the and of to a in that he it was his i is with as for had you not be her on at by which have but this they from she all were him my so me or one we an are there no their them if when been what would said will who could more then into out up do upon its our like your any only some should now very than these two may made such these those great man men time can much'.split(' '));
const SUGG=new Map();
/* a book's own subject labels (Library of Congress subjects, Standard Ebooks' genre, Gutenberg bookshelves), tidied into short tags */
const titleCase=s=>s.split(' ').map((w,k)=>(k && /^(and|or|of|the|in|on|to|for|a|an|at|by)$/i.test(w))? w.toLowerCase() : w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const GENRE_PART={'fiction':'Fiction','juvenile fiction':'Children','juvenile literature':'Children','poetry':'Poetry','drama':'Drama','short stories':'Short Stories','sermons':'Sermons','correspondence':'Letters','humor':'Humor'};
function tidySubjects(list){
  const out=[];
  const add=t=>{ t=t.replace(/\s+/g,' ').trim(); if(t && t.length<=32 && !/\d/.test(t) && !out.some(x=>x.toLowerCase()===t.toLowerCase())) out.push(t); };
  for(let s of list||[]){
    s=String(s).replace(/^(browsing|category|bookshelf)\s*:\s*/i,'').trim();
    if(!s || /listings|harvard classics|best books|bestseller|banned|top \d|gutenberg|movie|reviewed|-- ?translations/i.test(s)) continue;
    const parts=s.split(/\s*--\s*/).map(x=>x.replace(/[.;:,]+$/,'').trim()).filter(Boolean); if(!parts.length) continue;
    let main=parts[0].replace(/\s*\([^)]*\)\s*/g,' ').replace(/,\s*(English|American|French|German|Russian|Italian|Spanish|Latin|Greek|Scottish|Irish)$/i,'').split('/')[0].trim();
    if(/^bible\b/i.test(main)) main='Bible';
    /* a person ("Lewis, C. S., 1898-1963") is a subject, not a tag */
    if(!/\d/.test(parts[0]) && !/^[A-Z][a-z]+, [A-Z]/.test(main) && !/^(authors|women|men|persons|characters|literature|english literature|american literature|translations)$/i.test(main)) add(titleCase(main));
    for(const p of parts.slice(1)){ const g=GENRE_PART[p.toLowerCase()]; if(g) add(g); }
  }
  return out.slice(0,6);
}
/* the book's form, read from its layout and its contents list */
function formTags(t, d){
  const out=[]; const B=t.blocks||[]; const W=t.words; const ch=d.chapters||[];
  const paras=B.filter(b=>b.t==='p');
  if(paras.length>=60){
    let short=0, open=0, caps=0;
    for(const b of paras){ const n=b.e-b.s; if(n<=10){ short++; if(!/[.!?]["”’)\]]*$/.test(W[b.e-1]||'')) open++; } if(/^[A-Z][A-Z'’-]{2,}[.:]?$/.test(W[b.s]||'') && n>1) caps++; }
    if(short/paras.length>=0.45 && open/Math.max(1,short)>=0.5) out.push('Poetry');
    if(caps/paras.length>=0.15) out.push('Drama');
  }
  const titles=ch.map(c=>(c.t||'').trim()); const cnt=re=>titles.filter(x=>re.test(x)).length;
  if(cnt(/^(act|scene)\b/i)>=3 && !out.includes('Drama')) out.push('Drama');
  if(cnt(/\bsermons?\b/i)>=3) out.push('Sermons');
  if(cnt(/^(letter\b|epistle\b|to (the|my|mr|mrs|miss|a)\b)/i)>=3) out.push('Letters');
  if(cnt(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b|^day\s+\d+|\b(morning|evening)\b/i)>=10 && !out.includes('Devotional')) out.push('Devotional');
  /* many separately titled pieces, no numbered chapters and no parts: a collection */
  const skip=/^(contents|table of contents|preface|introduction|foreword|index|notes|endnotes|acknowledg|imprint|colophon|title ?page|half ?title|uncopyright|copyright|dedication|epigraph|about|glossary|appendix|bibliography|loi|landmarks)/i;
  const top=ch.filter(c=>!c.d).map(c=>(c.t||'').trim());
  const named=top.filter(x=>x && !skip.test(x) && !/^(chapter|book|part|section|canto|psalm|letter|sermon|volume)\b|^[ivxlcdm]+\.?$|^\d+\.?$/i.test(x));
  const numbered=top.filter(x=>/^(chapter|book|part|volume)\b|^[ivxlcdm]+\.?$|^\d+\.?$/i.test(x)).length;
  if(named.length>=5 && named.length<=60 && !numbered){
    const avg=W.length/named.length; let q=0; for(const w of W) if(/^[“"]/.test(w)) q++;
    if(avg>=800 && avg<=15000) out.push(q*1000/W.length>6 ? 'Short Stories' : 'Essays');
  }
  return out;
}
async function suggestTags(d){
  if(SUGG.has(d.id)) return SUGG.get(d.id);
  const t=(R.meta&&R.meta.id===d.id&&R.text)||await Store.get('texts',d.id).catch(()=>null)||fetchText(d); if(!t||!t.words) return [];
  const N=t.words.length, clean=w=>w.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'');
  /* count words and two-word phrases; very long books are read in evenly spaced stretches */
  const freq=new Map(), pairs=new Map(); let n=0; const span=1000, every=N>200000? Math.ceil(N/200000) : 1;
  for(let a=0;a<N;a+=span*every){ let prev=''; for(let k=a;k<Math.min(N,a+span);k++){ const w=clean(t.words[k]); if(!w){ prev=''; continue; } n++; if(w.length>2 && !STOP.has(w)) freq.set(w,(freq.get(w)||0)+1); if(prev){ const p=prev+' '+w; pairs.set(p,(pairs.get(p)||0)+1); } prev=w; } }
  const per=w=>((w.includes(' ')? (pairs.get(w)||0)*2 : (freq.get(w)||0)))*10000/Math.max(1,n);
  const ranked=[];
  tidySubjects(d.subjects).forEach((tag,k)=>ranked.push([tag,5000-k]));
  formTags(t,d).forEach((tag,k)=>ranked.push([tag,4000-k]));
  if(d.author) for(const o of LIB) if(o.id!==d.id && o.author && o.author.toLowerCase()===d.author.toLowerCase()) for(const tag of tagsOf(o)) ranked.push([tag,3000]);
  for(const [tag,words] of Object.entries(TOPICS)){ const hits=words.map(per); const sc=hits.reduce((a,b)=>a+b,0), spread=hits.filter(h=>h>=1.5).length; if(sc>=18 && spread>=3) ranked.push([tag,sc]); }
  /* your own tags whose words show up a lot in this book */
  for(const tag of allTags()){ if(TOPICS[tag]) continue; const ws=tag.toLowerCase().split(/[^\p{L}]+/u).filter(w=>w.length>2&&!STOP.has(w)); if(!ws.length) continue; const sc=Math.min(...ws.map(per)); if(sc>=3) ranked.push([tag,sc*4]); }
  const seen=new Set(), out=[];
  for(const [tag] of ranked.sort((a,b)=>b[1]-a[1])){ const k=tag.toLowerCase(); if(seen.has(k)) continue; seen.add(k); out.push(tag); if(out.length>=10) break; }
  SUGG.set(d.id,out); return out;
}

/* ---------- tags in Settings: rename or delete everywhere ---------- */
let TAGS_OPEN=false;
function tagCounts(){ const m=new Map(); for(const d of LIB) for(const t of tagsOf(d)){ const k=t.toLowerCase(); const v=m.get(k)||{name:t,n:0}; v.n++; m.set(k,v); } return [...m.values()].sort((a,b)=>byName(a.name,b.name)); }
function tagsSettingsHTML(){
  const tc=tagCounts();
  return tc.length? `<div class="list">${tc.map(t=>`<div class="li" style="cursor:default"><div class="grow" style="min-width:0"><b>${esc(t.name)}</b><div class="small">${t.n} book${t.n===1?'':'s'}</div></div><button class="btn" type="button" data-tren="${esc(t.name)}" style="flex:none;padding:8px 12px">Rename</button><button class="btn" type="button" data-tdel="${esc(t.name)}" style="flex:none;padding:8px 12px;color:var(--danger)">Delete</button></div>`).join('')}</div>`
    : '<div class="desc">No tags yet. Add them to a book from its ••• menu in the library.</div>';
}
function forEachTagged(name, fn){ const k=name.toLowerCase(); let n=0; for(const d of LIB){ const tg=tagsOf(d); if(tg.some(t=>t.toLowerCase()===k)){ d.tags=fn(tg.filter(t=>t.toLowerCase()!==k)); touch(d); n++; } } for(const a of ARCH.list()) if((a.tags||[]).some(t=>t.toLowerCase()===k)){ a.tags=fn(a.tags.filter(t=>t.toLowerCase()!==k)); } ARCH.save(); SUGG.clear(); return n; }
function renameTag(name){
  openSheet('Rename tag', `<div class="field"><label for="tagNew">New name for “${esc(name)}”</label><input class="input" id="tagNew" value="${esc(name)}" autocomplete="off"></div><button class="btn primary block" type="button" data-act="ok">Rename</button>`, {
    ok:()=>{ const v=normTag($('#tagNew').value); if(!v){ toast('The tag name can’t be empty'); return; }
      const n=forEachTagged(name, tg=> tg.some(t=>t.toLowerCase()===v.toLowerCase())? tg : [...tg, v]);
      if(F.tg.has(name.toLowerCase())){ F.tg.delete(name.toLowerCase()); F.tg.add(v.toLowerCase()); }
      closeSheet(); renderSettings(); renderLibrary(); toast('Renamed on '+n+' book'+(n===1?'':'s')); }
  });
  setTimeout(()=>{ const i=$('#tagNew'); if(i){ i.focus(); i.select(); i.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); $('#sheet [data-act=ok]').click(); } }); } },60);
}
function deleteTag(name){
  const n=tagCounts().find(t=>t.name.toLowerCase()===name.toLowerCase()); const c=n?n.n:0;
  openSheet('Delete tag?', `<p class="note">Deleting “${esc(name)}” removes it from ${c===1?'the 1 book':'all '+c+' books'} it’s on. The books themselves stay in your library.</p><div class="row"><button class="btn" type="button" data-act="no">Keep it</button><button class="btn primary" style="background:var(--danger);border-color:var(--danger)" type="button" data-act="yes">Delete tag</button></div>`, {
    no:()=>closeSheet(),
    yes:()=>{ forEachTagged(name, tg=>tg); F.tg.delete(name.toLowerCase()); closeSheet(); renderSettings(); renderLibrary(); toast('Tag deleted'); }
  });
}
/* categories became tags: an old category is kept as a tag; starter books get their tags once */
function migrateTags(){
  for(const m of LIB){
    let ch=false; const tg=tagsOf(m).slice(); const add=t=>{ if(t && !tg.some(x=>x.toLowerCase()===t.toLowerCase())){ tg.push(t); ch=true; } };
    const sh=SHELF.find(x=>x.id===m.id);
    if('category' in m){ if(!sh) add(m.category); delete m.category; ch=true; }
    if(sh && !m.shelfTagged){ sh.tags.forEach(add); m.shelfTagged=1; ch=true; }
    if(ch){ m.tags=tg; Store.put('meta',m).catch(()=>{}); }
  }
}

/* ---------- archive ---------- */
const ARCH={ list:()=>{ if(!ARCH._l) ARCH._l=LS.get('archive',[]); return ARCH._l; }, save:()=>LS.set('archive',ARCH.list()), _l:null };
let ARCH_RESTORE=null;
const pctRead=d=>d.finished?100:Math.floor(100*(d.pos||0)/Math.max(1,(d.count||1)-1));
function archiveFlow(id){
  const d=LIB.find(x=>x.id===id); if(!d) return;
  if(!d.finished) openSheet('Did you finish it?', `<p class="note">You’re ${pctRead(d)}% of the way through “${esc(d.title)}”. Did you finish reading it?</p><div class="row"><button class="btn" type="button" data-act="no">No, I didn’t finish</button><button class="btn primary" type="button" data-act="yes">Yes, I finished</button></div>`, { yes:()=>archiveSheet(id,true), no:()=>archiveSheet(id,false) });
  else archiveSheet(id,true);
}
function archiveSheet(id, finished, st){
  const d=LIB.find(x=>x.id===id); if(!d) return;
  const hl=d.highlights||[], notes=hl.filter(h=>h.note).length, bm=(d.bookmarks||[]).length;
  st=st||{keep:{progress:true, bookmarks:true, highlights:true, notes:true}, rating:0, review:''};
  const opt=[['progress','Reading progress',finished?'':pctRead(d)+'%'],['bookmarks','Bookmarks',bm],['highlights','Highlights',hl.length],['notes','Notes',notes]].filter(([k,,n])=>k==='progress'||n);
  const grab=()=>{ const r=$('#arcReview'); if(r) st.review=r.value; };
  openSheet(finished?'Archive a finished book':'Archive as Did Not Finish', `
    <p class="note" style="margin-top:0">“${esc(d.title)}” leaves your library and the book itself is deleted. ${finished?'It’s recorded as finished today.':'It’s recorded as <b>Did Not Finish</b>.'} You can add it back from Settings.</p>
    <div class="small" style="color:var(--muted)">Keep with the archive</div>
    <div class="tagchips">${opt.map(([k,l,n])=>`<button class="chip" type="button" data-act="kp" data-k="${k}" aria-pressed="${!!st.keep[k]}">${st.keep[k]?'✓ ':''}${l}${n!==''?` <span style="opacity:.7">(${n})</span>`:''}</button>`).join('')}</div>
    ${finished?`<div class="small" style="color:var(--muted);margin-top:16px">Your rating <span style="opacity:.7">(optional)</span></div>
    <div class="stars" role="group" aria-label="Rating">${[1,2,3,4,5].map(v=>`<button type="button" data-act="star" data-v="${v}" aria-label="${v} star${v>1?'s':''}" aria-pressed="${st.rating>=v}">${st.rating>=v?'★':'☆'}</button>`).join('')}</div>
    <div class="field" style="margin-top:10px"><label for="arcReview">Your review <span style="font-weight:400;color:var(--muted)">(optional)</span></label><textarea class="input" id="arcReview" rows="4" placeholder="What did you think of it?">${esc(st.review)}</textarea></div>`:''}
    <div class="row" style="margin-top:14px"><button class="btn" type="button" data-act="cancel">Cancel</button><button class="btn primary" type="button" data-act="go">${ICON.archive} Archive</button></div>`, {
    kp:(b)=>{ grab(); st.keep[b.dataset.k]=!st.keep[b.dataset.k]; archiveSheet(id,finished,st); },
    star:(b)=>{ grab(); const v=+b.dataset.v; st.rating= st.rating===v?0:v; archiveSheet(id,finished,st); },
    cancel:()=>closeSheet(),
    go:async()=>{ grab(); closeSheet(); await archiveBook(d, finished, st); }
  });
}
async function archiveBook(d, finished, st){
  await bookSnips(d).catch(()=>{});
  const t=d.pending?null:((R.meta&&R.meta.id===d.id&&R.text)||await Store.get('texts',d.id).catch(()=>null)||fetchText(d));
  const full=(s,e)=> t&&t.words? joinWords(t,s,e) : snip(d,s,e);
  const k=st.keep;
  const rec={id:d.id, title:d.title, author:d.author||'', tags:[...tagsOf(d)], kind:d.kind, source:d.source||null, count:d.count||0,
    status:finished?'finished':'dnf', finishedAt:finished?(d.finishedAt||Date.now()):null, archivedAt:Date.now(),
    rating:finished?(st.rating||0):0, review:finished?(st.review||'').trim():'',
    kept:{ progress: k.progress? {pos:finished?Math.max(0,(d.count||1)-1):(d.pos||0), pct:pctRead(d)} : null,
      bookmarks: k.bookmarks? (d.bookmarks||[]).map(b=>({i:b.i, name:b.name||'', at:b.at, q:snip(d,b.i,b.i+11)})) : [],
      highlights: (d.highlights||[]).filter(h=>k.highlights || (k.notes && h.note)).map(h=>({s:h.s, e:h.e, c:h.c, at:h.at, note:k.notes?(h.note||''):'', q:full(h.s,h.e), noteOnly:!k.highlights})) } };
  ARCH.list().unshift(rec); ARCH.save();
  await removeBook(d.id); renderLibrary(); if(!$('#v-settings').hidden) renderSettings();
  toast('Archived “'+d.title+'”', null, 3500);
}
const starsTxt=n=>n?'★'.repeat(n)+'☆'.repeat(5-n):'';
const fmtDay=t=>new Date(t).toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'});
function archiveSettingsHTML(){
  const L=ARCH.list();
  if(!L.length) return '<div class="desc">Books you archive appear here, with any rating, review, highlights and notes you kept. Archive a book from its ••• menu in the library.</div>';
  return `<div class="list">${L.map((a,k)=>`<button class="li" type="button" data-arch="${k}"><span class="grow" style="min-width:0"><b>${esc(a.title)}</b><span class="small" style="display:block">${a.author?esc(a.author)+' · ':''}${a.status==='finished'?'Finished '+fmtDay(a.finishedAt):'Did not finish · archived '+fmtDay(a.archivedAt)}${a.rating?' · <span style="color:var(--accent)">'+starsTxt(a.rating)+'</span>':''}</span></span></button>`).join('')}</div>`;
}
function openArchived(k, confirmDel){
  const a=ARCH.list()[k]; if(!a) return;
  const hl=a.kept.highlights||[], bm=a.kept.bookmarks||[];
  const canAuto=SHELF.some(s=>s.id===a.id) || (a.source||'').startsWith('gutenberg:');
  openSheet(a.title, `
    ${a.author?`<p class="note" style="margin-top:0">${esc(a.author)}</p>`:''}
    <p style="margin:0 0 6px"><b>${a.status==='finished'?'Finished '+fmtDay(a.finishedAt):'Did not finish'}</b>${a.status!=='finished'&&a.kept.progress?' · stopped at '+a.kept.progress.pct+'%':''}${a.rating?` · <span style="color:var(--accent);letter-spacing:2px">${starsTxt(a.rating)}</span>`:''}</p>
    ${a.review?`<blockquote class="note" style="white-space:pre-wrap;border-left:3px solid var(--line);margin:8px 0;padding-left:12px">${esc(a.review)}</blockquote>`:''}
    ${(a.tags||[]).length?`<div class="tagchips" style="margin-bottom:8px">${a.tags.map(t=>`<span class="chip" style="cursor:default">${esc(t)}</span>`).join('')}</div>`:''}
    ${hl.length?`<h3 class="grp">Highlights and notes <span>${hl.length}</span></h3>${hl.map(h=>`<div class="hlrow"><span class="bar" style="background:var(--hl${h.c||1})"></span><div class="grow"><div class="t">${h.noteOnly?'':esc(h.q.length>400?h.q.slice(0,400)+'…':h.q)}</div>${h.note?`<div class="nt">${esc(h.note)}</div>`:''}</div></div>`).join('')}`:''}
    ${bm.length?`<h3 class="grp">Bookmarks <span>${bm.length}</span></h3>${bm.map(b=>`<div class="hlrow"><span class="bar" style="background:var(--accent)"></span><div class="grow"><div class="t"><b>${esc(b.name||'Bookmark')}</b></div><div class="where">${esc(b.q||'')}…</div></div></div>`).join('')}`:''}
    ${hl.length?'<button class="btn block" type="button" data-act="copy">Copy highlights and notes</button>':''}${hl.length||bm.length?'<button class="btn block" type="button" data-act="export">Export highlights and notes</button>':''}
    <button class="btn primary block" type="button" data-act="back">Add back to the library</button>
    ${canAuto?'':'<p class="note" style="margin:0">The book file was deleted when it was archived, so you’ll open or paste it again and your saved data is added to it.</p>'}
    <div id="arcDel">${confirmDel?`<p class="note">Delete “${esc(a.title)}” from the archive for good, with its rating, review and everything kept with it?</p><div class="row"><button class="btn" type="button" data-act="keep">Keep it</button><button class="btn primary" style="background:var(--danger);border-color:var(--danger)" type="button" data-act="del">Delete for good</button></div>`:`<button class="btn block danger" type="button" data-act="ask">${ICON.trash} Delete permanently</button>`}</div>`, {
    copy:async()=>{ const txt=a.title+(a.author?' — '+a.author:'')+'\n\n'+hl.map(h=>(h.noteOnly?'':'“'+h.q+'”')+(h.note?(h.noteOnly?'':'\n')+'Note: '+h.note:'')).join('\n\n'); try{ await navigator.clipboard.writeText(txt); toast('Copied'); }catch(e){ toast('Couldn’t copy on this device.'); } },
    export:()=>exportSheet(a),
    back:()=>restoreArchived(k),
    ask:()=>{ openArchived(k,true); revealEnd('#arcDel'); }, keep:()=>openArchived(k,false),
    del:()=>{ ARCH.list().splice(k,1); ARCH.save(); closeSheet(); renderSettings(); toast('Deleted for good'); }
  });
}
function applyKept(m, a){
  const kp=a.kept||{};
  if(kp.progress){ m.pos=a.status==='finished'?0:kp.progress.pos; m.lastRead=a.status==='finished'?0:Date.now(); LS.set('pos.'+m.id,{pos:m.pos,t:m.lastRead,fin:false}); }
  m.bookmarks=(kp.bookmarks||[]).map(b=>({i:b.i, name:b.name, at:b.at}));
  m.highlights=(kp.highlights||[]).map(h=>({s:h.s, e:h.e, c:h.c||1, at:h.at, ...(h.note?{note:h.note}:{})}));
  const tg=tagsOf(m).slice(); for(const t of a.tags||[]) if(!tg.some(x=>x.toLowerCase()===t.toLowerCase())) tg.push(t); m.tags=tg;
  if(a.author && !m.author) m.author=a.author;
  m.history=[...(m.history||[]), {status:a.status, finishedAt:a.finishedAt, rating:a.rating, review:a.review}];
  touch(m);
}
async function restoreArchived(k){
  const a=ARCH.list()[k]; if(!a) return;
  const take=()=>{ const i=ARCH.list().indexOf(a); if(i>=0){ ARCH.list().splice(i,1); ARCH.save(); } };
  const sh=SHELF.find(s=>s.id===a.id);
  if(sh || (a.source||'').startsWith('gutenberg:')){
    if(LIB.some(m=>m.id===a.id)){ toast('That book is already in your library'); return; }
    const m=sh? shelfMeta(sh,0) : {...shelfMeta({id:a.id, title:a.title, author:a.author, tags:[], src:a.source},0), shelfTagged:0};
    m.added=Date.now(); m.title=a.title; LIB.push(m); applyKept(m,a); take();
    closeSheet(); renderLibrary(); renderSettings(); toast('“'+a.title+'” is back in your library'); return;
  }
  ARCH_RESTORE=a.id;
  openSheet('Add “'+a.title+'” back', `<p class="note" style="margin-top:0">Open or paste the same book again. Your ${[a.kept.progress?'place':'',(a.kept.highlights||[]).length?'highlights and notes':'',(a.kept.bookmarks||[]).length?'bookmarks':''].filter(Boolean).join(', ')||'tags'} will be added to it.</p>
    <button class="addopt" type="button" data-act="file">${ICON.file}<span><b>Open the file</b><small>EPUB, PDF, TXT, Markdown or HTML</small></span></button>
    <button class="addopt" type="button" data-act="link">${ICON.link}<span><b>Paste the link</b><small>${a.source&&/^https?:/.test(a.source)?esc(a.source.slice(0,60)):'The web page it came from'}</small></span></button>
    <button class="addopt" type="button" data-act="paste">${ICON.paste}<span><b>Paste the text</b><small>The same text you added before</small></span></button>`, {
    file:()=>{ closeSheet(); $('#fileIn').value=''; $('#fileIn').click(); },
    link:()=>{ closeSheet(); openLink(); setTimeout(()=>{ const i=$('#linkUrl')||$('#sheet input'); if(i&&a.source&&/^https?:/.test(a.source)) i.value=a.source; },80); },
    paste:()=>{ closeSheet(); openPaste(false); }
  });
}
/* the next book added after "Add back" picks up the archived data */
const addDocPlain=addDoc;
addDoc=async function(d){
  const m=await addDocPlain(d);
  if(ARCH_RESTORE){ const i=ARCH.list().findIndex(x=>x.id===ARCH_RESTORE); ARCH_RESTORE=null; if(i>=0){ const a=ARCH.list()[i]; applyKept(m,a); ARCH.list().splice(i,1); ARCH.save(); renderLibrary(); setTimeout(()=>toast('Your saved data was added to “'+m.title+'”'),3300); } }
  return m;
};

/* ---------- finishing a book ---------- */
function finishPrompt(id, step){
  const d=LIB.find(x=>x.id===id); if(!d) return;
  openSheet('You finished it!', `
    <p class="note" style="margin-top:0">You reached the end of “${esc(d.title)}”. What would you like to do with it?</p>
    <button class="btn block" type="button" data-act="keep">Keep it in my library</button>
    <button class="btn block" type="button" data-act="arch">${ICON.archive} Archive it</button>
    <div id="finDel">${step==='del'?`<p class="note">Delete “${esc(d.title)}” and all its highlights, notes and bookmarks? This can’t be undone.</p><div class="row"><button class="btn" type="button" data-act="back">Go back</button><button class="btn primary" style="background:var(--danger);border-color:var(--danger)" type="button" data-act="del">Delete</button></div>`:`<button class="btn block danger" type="button" data-act="ask">${ICON.trash} Delete it</button>`}</div>`, {
    keep:()=>{ d.keepFinished=true; touch(d); closeSheet(); },
    arch:()=>archiveSheet(id,true),
    ask:()=>{ finishPrompt(id,'del'); revealEnd('#finDel'); }, back:()=>finishPrompt(id),
    del:async()=>{ await removeBook(id); closeSheet(); renderLibrary(); toast('Deleted'); }
  });
}

/* ---------- the tutorial book ---------- */
const keepTutorial=()=>!!window.__toozKeepSample;
async function removeTutorial(id){ await removeBook(id); renderLibrary(); }
/* leaving the tutorial (or reopening the app after closing it there) asks where it should live */
function tutorialPrompt(id){
  if(!LIB.some(m=>m.id===id)) return;
  openSheet('Keep the tutorial handy?', `<p class="note" style="margin-top:0">You can tuck the tutorial away in Settings, where you can open it any time, or keep it in your library.</p>
    <button class="btn primary block" type="button" data-act="tuck">Tuck it away in Settings</button>
    <button class="btn block" type="button" data-act="keep">Keep it in my library</button>`, {
    tuck:async()=>{ closeSheet(); await removeTutorial(id); if(!$('#v-settings').hidden) renderSettings(); toast('The tutorial is in Settings → Tutorial'); },
    keep:()=>closeSheet()
  });
}
async function restoreTutorial(open){
  let sm=LIB.find(m=>m.kind==='sample');
  if(!sm){ sm=await addDocPlain(sampleDoc()); sm.sv=SAMPLE_V; sm.added=Date.now(); touch(sm); renderLibrary(); }
  if(open){ await openDoc(sm.id); } return sm;
}

/* ---------- erase everything ---------- */
function eraseAllSheet(){
  openSheet('Erase everything?', `<p class="note" style="margin-top:0">This deletes every book, highlight, note, bookmark, saved word, archived book, reading log and setting in Tooz on this device. It can’t be undone.</p><p class="note">If you might want any of it later, save a backup first.</p>
    <button class="btn block" type="button" data-act="bk">Save a backup first</button>
    <button class="btn primary block" style="background:var(--danger);border-color:var(--danger)" type="button" data-act="go">Erase everything</button>`, {
    bk:()=>{ closeSheet(); backup(); },
    go:()=>eraseAll()
  });
}
async function eraseAll(){
  closeSheet(); progress('Erasing…', null);
  try{ if(R.meta&&R.mode) closeReader(true); }catch(e){}
  try{ Store.db&&Store.db.close(); }catch(e){} Store.db=null;
  const drop=name=>new Promise(r=>{ try{ const q=indexedDB.deleteDatabase(name); q.onsuccess=q.onerror=q.onblocked=()=>r(); }catch(e){ r(); } setTimeout(r,3000); });
  await drop('readfast'); await drop('tooz-kv');
  try{ Object.keys(localStorage).filter(k=>k.startsWith('rf.')).forEach(k=>localStorage.removeItem(k)); }catch(e){}
  try{ if(window.caches) for(const k of await caches.keys()) await caches.delete(k); }catch(e){}
  location.reload();
}
/* ---------- free books: starter shelf and Project Gutenberg search ---------- */
const CC='Christian Classics', LC='Literary Classics';
const SHELF=[
  ['kjv','The Holy Bible: King James Version','King James Version',['Bible','Scripture'],'bible-kjv'],
  ['web','The Holy Bible: World English Bible','World English Bible',['Bible','Scripture'],'bible-web'],
  ['pilgrim','The Pilgrim’s Progress','John Bunyan',[CC,'Allegory','Puritans'],'john-bunyan_the-pilgrims-progress'],
  ['confessions','Confessions','Augustine',[CC,'Church Fathers','Autobiography'],'g:3296'],
  ['imitation','The Imitation of Christ','Thomas à Kempis',[CC,'Devotional'],'thomas-a-kempis_the-imitation-of-christ_william-benham'],
  ['orthodoxy','Orthodoxy','G. K. Chesterton',[CC,'Apologetics'],'g-k-chesterton_orthodoxy'],
  ['everlasting','The Everlasting Man','G. K. Chesterton',[CC,'Apologetics','History'],'g-k-chesterton_the-everlasting-man'],
  ['presence','The Practice of the Presence of God','Brother Lawrence',[CC,'Devotional','Prayer'],'g:5657'],
  ['pursuit','The Pursuit of God','A. W. Tozer',[CC,'Devotional','Prayer'],'a-w-tozer_the-pursuit-of-god'],
  ['institutes1','Institutes of the Christian Religion, Vol. 1','John Calvin',[CC,'Theology','Reformation'],'g:45001'],
  ['institutes2','Institutes of the Christian Religion, Vol. 2','John Calvin',[CC,'Theology','Reformation'],'g:64392'],
  ['paradise','Paradise Lost','John Milton',[CC,'Poetry','Epic'],'john-milton_paradise-lost'],
  ['comedy','The Divine Comedy','Dante Alighieri',[CC,'Poetry','Epic'],'dante-alighieri_the-divine-comedy_henry-wadsworth-longfellow'],
  ['martyrs','Fox’s Book of Martyrs','John Foxe',[CC,'Church History'],'g:22400'],
  ['benhur','Ben-Hur','Lew Wallace',[CC,'Historical Fiction','Adventure'],'lew-wallace_ben-hur'],
  ['pride','Pride and Prejudice','Jane Austen',[LC,'Romance','Social Satire'],'jane-austen_pride-and-prejudice'],
  ['twocities','A Tale of Two Cities','Charles Dickens',[LC,'Historical Fiction','French Revolution'],'charles-dickens_a-tale-of-two-cities'],
  ['miserables','Les Misérables','Victor Hugo',[LC,'Historical Fiction','Redemption'],'victor-hugo_les-miserables_isabel-f-hapgood'],
  ['karamazov','The Brothers Karamazov','Fyodor Dostoevsky',[LC,'Russian Literature','Philosophy'],'fyodor-dostoevsky_the-brothers-karamazov_constance-garnett'],
  ['crime','Crime and Punishment','Fyodor Dostoevsky',[LC,'Russian Literature','Psychological'],'fyodor-dostoevsky_crime-and-punishment_constance-garnett'],
  ['montecristo','The Count of Monte Cristo','Alexandre Dumas',[LC,'Adventure','Revenge'],'alexandre-dumas_the-count-of-monte-cristo_chapman-and-hall'],
  ['moby','Moby-Dick','Herman Melville',[LC,'Adventure','Sea'],'herman-melville_moby-dick'],
  ['eyre','Jane Eyre','Charlotte Brontë',[LC,'Romance','Gothic'],'charlotte-bronte_jane-eyre'],
  ['quixote','Don Quixote','Miguel de Cervantes',[LC,'Satire','Adventure'],'miguel-de-cervantes-saavedra_don-quixote_john-ormsby'],
  ['odyssey','The Odyssey','Homer',[LC,'Epic','Mythology'],'homer_the-odyssey_william-cullen-bryant'],
  ['meditations','Meditations','Marcus Aurelius',[LC,'Philosophy','Stoicism'],'marcus-aurelius_meditations_george-long'],
  ['holmes','The Adventures of Sherlock Holmes','Arthur Conan Doyle',[LC,'Mystery','Short Stories'],'arthur-conan-doyle_the-adventures-of-sherlock-holmes'],
  ['gatsby','The Great Gatsby','F. Scott Fitzgerald',[LC,'American Literature','Jazz Age'],'f-scott-fitzgerald_the-great-gatsby'],
  ['treasure','Treasure Island','Robert Louis Stevenson',[LC,'Adventure','Pirates'],'robert-louis-stevenson_treasure-island'],
  ['douglass','Narrative of the Life of Frederick Douglass','Frederick Douglass',[LC,'Autobiography','American History'],'frederick-douglass_narrative-of-the-life-of-frederick-douglass']
].map(([k,title,author,tags,src])=>({id:'shelf-'+k, title, author, tags, src: src.startsWith('g:')? 'gutenberg:'+src.slice(2) : 'books/'+src+'.epub'}));
const SHELF_SIZE={"shelf-pilgrim": "1.3 MB", "shelf-imitation": "1.1 MB", "shelf-orthodoxy": "1.3 MB", "shelf-everlasting": "0.7 MB", "shelf-pursuit": "0.7 MB", "shelf-paradise": "0.8 MB", "shelf-comedy": "2.1 MB", "shelf-benhur": "1.2 MB", "shelf-pride": "0.8 MB", "shelf-twocities": "1.2 MB", "shelf-miserables": "2.8 MB", "shelf-karamazov": "1.2 MB", "shelf-crime": "1.7 MB", "shelf-montecristo": "2.0 MB", "shelf-moby": "1.3 MB", "shelf-eyre": "0.8 MB", "shelf-quixote": "1.3 MB", "shelf-odyssey": "1.0 MB", "shelf-meditations": "0.7 MB", "shelf-holmes": "1.4 MB", "shelf-gatsby": "0.4 MB", "shelf-treasure": "0.7 MB", "shelf-douglass": "0.2 MB", "shelf-kjv": "1.4 MB", "shelf-web": "1.4 MB"};
function shelfMeta(b, n){ const now=Date.now(); return {id:b.id, title:b.title, author:b.author, tags:[...b.tags], shelfTagged:1, kind:'epub', source:b.src, pending:{src:b.src}, count:0, pos:0, added:1000-n, lastRead:0, mod:now, chapters:[], bookmarks:[], highlights:[], finished:false, imageCount:0}; }
/* each starter book is added once; one you delete stays deleted (add it again from Free books) */
async function seedShelf(){
  const done=new Set(LS.get('shelf',[])); let n=0;
  for(const b of SHELF){ if(done.has(b.id)) continue; done.add(b.id); if(LIB.some(m=>m.id===b.id)) continue; const m=shelfMeta(b, n++); LIB.push(m); await Store.put('meta',m).catch(()=>{}); }
  LS.set('shelf',[...done]);
}
const gutenbergUrl=id=>`https://www.gutenberg.org/cache/epub/${id}/pg${id}-images-3.epub`;
/* the app's own copy first; Gutenberg directly, then through the reader services (some phones' browsers are blocked from downloading it directly) */
async function downloadEpub(src, label, P){
  const urls = src.startsWith('gutenberg:') ? (u=>[u, ...linkServices().map(f=>f(u))])(gutenbergUrl(src.slice(10))) : [src];
  const ctl=new AbortController();
  for(let k=0;k<urls.length;k++){
    try{
      P(k? 'Trying another way to download “'+label+'”…' : 'Downloading “'+label+'”…', 5);
      const {res,buf}=await fetchTimed(urls[k], ctl.signal, 25000, (g,t)=>P('Downloading “'+label+'”… '+fmtSize(g)+(t?' of '+fmtSize(t):''), t? 5+60*g/t : null));
      if(res.ok && buf.length>1000 && buf[0]===0x50 && buf[1]===0x4B) return buf;
    }catch(e){}
  }
  return null;
}
async function fetchShelfBook(meta){
  const P=(m,p)=>progress(m,p);
  const buf=await downloadEpub(meta.pending.src, meta.title, P);
  if(!buf){ toast('Couldn’t download “'+meta.title+'”. Check your internet connection and try again.', null, 7000); return false; }
  let d; try{ d=await parseFile(new File([buf], meta.title+'.epub'), (m,p)=>P(m, p==null?null:65+p*0.3)); }catch(e){ toast(e&&e.message||'That book couldn’t be opened.', null, 7000); return false; }
  P('Saving to your library…', 97);
  const text={id:meta.id, words:d.words, ends:d.ends, images:d.images||null, blocks:d.blocks||null, wf:d.wf||null, notes:d.notes||null, breaks:d.breaks||null, secs:d.secs||null, font:d.font||null, lang:d.lang||null};
  try{ await Store.put('texts',text); }catch(e){ toast('There isn’t enough storage on this device to save “'+meta.title+'”.', null, 7000); return false; }
  Object.assign(meta,{count:d.words.length, chapters:d.chapters||[], imageCount:d.images?d.images.at.length:0, pending:null, subjects:(d.subjects||[]).slice(0,20)}); SUGG.delete(meta.id);
  if(!meta.author && d.author) meta.author=d.author;
  touch(meta); BK.cache.delete(meta.id); renderLibrary(); $('#toast').hidden=true;
  return true;
}
/* Free books sheet: the starter shelf, plus a search of Project Gutenberg's 75,000 books */
let FB={q:'', results:null, busy:false, err:''};
function openFreeBooks(){
  const inLib=new Set(LIB.map(m=>m.id));
  const missing=SHELF.filter(b=>!inLib.has(b.id));
  const res=FB.results;
  openSheet('Free books', `
    <div class="row" style="flex-wrap:nowrap"><input class="input" id="fbQ" type="search" enterkeyhint="search" placeholder="Search by title or author" value="${esc(FB.q)}" style="flex:1;min-width:0" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="btn primary" type="button" data-act="find" style="flex:none;padding-left:18px;padding-right:18px">Search</button></div>
    <p class="note" style="margin:0">Searches Project Gutenberg: over 75,000 public-domain books, free to keep.</p>
    <div id="fbRes">${FB.busy?'<p class="note">Searching…</p>':FB.err?`<p class="note">${esc(FB.err)}</p>`:res?(res.length?`<div class="list">${res.map((r,k)=>`<div class="li"><div class="grow" style="min-width:0"><b>${esc(r.title)}</b><div class="small">${esc(r.author||'Unknown author')}</div></div><button class="btn" type="button" data-act="get" data-k="${k}" style="flex:none">${LIB.some(m=>m.source==='gutenberg:'+r.id)?'Added':'Add'}</button></div>`).join('')}</div>`:'<p class="note">No books matched. Try fewer words, or just the author’s last name.</p>'):''}</div>
    ${missing.length?`<h3 class="grp" style="margin-top:6px">Starter shelf books you removed</h3><div class="list">${missing.map(b=>`<div class="li"><div class="grow" style="min-width:0"><b>${esc(b.title)}</b><div class="small">${esc(b.author)}</div></div><button class="btn" type="button" data-act="shelf" data-id="${b.id}" style="flex:none">Add</button></div>`).join('')}</div>`:''}`, {
    find:()=>searchGutenberg($('#fbQ').value),
    get:(b)=>addGutenberg(FB.results[+b.dataset.k]),
    shelf:async(b)=>{ const s=SHELF.find(x=>x.id===b.dataset.id); if(!s||LIB.some(m=>m.id===s.id)) return; const m=shelfMeta(s,0); LIB.push(m); await Store.put('meta',m).catch(()=>{}); renderLibrary(); toast('Added “'+s.title+'”'); openFreeBooks(); }
  });
  const q=$('#fbQ'); q.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); searchGutenberg(q.value); } });
}
const flipName=n=>{ const p=(n||'').split(', '); return p.length===2? p[1]+' '+p[0] : n||''; };
async function searchGutenberg(q){
  q=(q||'').trim(); if(!q) return; FB={q, results:null, busy:true, err:''}; openFreeBooks();
  const api=`https://gutendex.com/books/?languages=en&search=${encodeURIComponent(q)}`;
  const ctl=new AbortController(); let data=null;
  for(const u of [api, ...linkServices().map(f=>f(api))]){
    try{ const {res,buf}=await fetchTimed(u, ctl.signal, 15000); if(!res.ok) continue; data=JSON.parse(new TextDecoder().decode(buf)); if(data&&Array.isArray(data.results)) break; data=null; }catch(e){}
  }
  if(FB.q!==q) return;
  FB.busy=false;
  if(!data) FB.err='The book search isn’t answering right now. Check your connection and try again in a minute.';
  else FB.results=data.results.filter(r=>r.formats&&Object.keys(r.formats).some(k=>k.startsWith('application/epub'))).slice(0,30).map(r=>({id:r.id, title:(r.title||'').replace(/\s*\r?\n\s*/g,': ').replace(/\$/g,''), author:(r.authors||[]).slice(0,2).map(a=>flipName(a.name)).join(', '), subjects:[...(r.subjects||[]), ...(r.bookshelves||[])].slice(0,16)}));
  if(!$('#sheet').hidden && $('#fbQ')) openFreeBooks();
}
async function addGutenberg(r){
  if(!r) return; if(LIB.some(m=>m.source==='gutenberg:'+r.id)){ toast('That book is already in your library'); return; }
  closeSheet();
  const P=(m,p)=>progress(m,p);
  const buf=await downloadEpub('gutenberg:'+r.id, r.title, P);
  if(!buf){ toast('Couldn’t download “'+r.title+'”. Check your connection and try again.', null, 7000); return; }
  try{
    const d=await parseFile(new File([buf], r.title+'.epub'), (m,p)=>P(m, p==null?null:65+p*0.3));
    d.title=r.title||d.title; d.author=r.author||d.author; d.source='gutenberg:'+r.id; d.subjects=[...(r.subjects||[]), ...(d.subjects||[])];
    const m=await addDoc(d); toast('Added “'+m.title+'”');
  }catch(e){ toast(e&&e.message||'That book couldn’t be opened.', null, 7000); }
}

/* ---------- Notes tab: highlights, notes and bookmarks from every book ---------- */
let NOTESEG=LS.get('notesSeg','hl'), notesTok=0; const SNIPS=new Map();
function joinWords(t,s,e){ const wf=(t.wf&&t.wf.length===t.words.length)?t.wf:null; let o=''; for(let k=s;k<=e&&k<t.words.length;k++){ if(k>s && !(wf&&(wf[k]&F_GLUE))) o+=' '; o+=t.words[k]; } return o; }
async function bookSnips(d){
  const need=[]; for(const h of d.highlights||[]) need.push([h.s,h.e]); for(const b of d.bookmarks||[]) need.push([b.i,b.i+11]);
  if(need.every(([s,e])=>SNIPS.has(d.id+'|'+s+'|'+e))) return;
  let t=(R.meta&&R.meta.id===d.id&&R.text)||await Store.get('texts',d.id).catch(()=>null)||fetchText(d); if(!t||!t.words) return;
  for(const [s,e] of need) SNIPS.set(d.id+'|'+s+'|'+e, joinWords(t,s,e));
}
const snip=(d,s,e)=>SNIPS.get(d.id+'|'+s+'|'+e)||'';
const pctOf=(d,i)=>Math.round(100*i/Math.max(1,(d.count||1)-1));
function chapterName(d,i){ let c=null; for(const x of d.chapters||[]){ if(x.i<=i) c=x; else break; } return c?c.t:''; }
async function renderNotes(){
  if(!['hl','bm','w'].includes(NOTESEG)) NOTESEG='hl';
  document.querySelectorAll('#notesSeg button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.n===NOTESEG));
  $('#notesHl').hidden=NOTESEG!=='hl'; $('#notesBm').hidden=NOTESEG!=='bm'; $('#wordsPane').hidden=NOTESEG!=='w';
  if(NOTESEG==='w'){ renderWords(); return; }
  const hl=NOTESEG==='hl', key=hl?'highlights':'bookmarks', el=hl?$('#notesHl'):$('#notesBm');
  const books=LIB.filter(d=>(d[key]||[]).length).sort((a,b)=>(b.lastRead||0)-(a.lastRead||0));
  if(!books.length){ el.innerHTML=`<div class="empty">${hl?'Highlights and notes from all your books appear here. In a book, press and hold a word, drag to select, then pick a color or tap Note.':'Bookmarks from all your books appear here. In a book, tap the bookmark button at the bottom left.'}</div>`; return; }
  const tok=++notesTok; await Promise.all(books.map(bookSnips)); if(tok!==notesTok) return;
  el.innerHTML=books.map(d=>{
    const L=d[key]; const n=L.length;
    const rows=hl? L.map((h,k)=>{ const t=snip(d,h.s,h.e); return `<div class="hlrow"><span class="bar" style="background:var(--hl${h.c||1})"></span><div class="grow" data-nb="${d.id}" data-ni="${h.s}"><div class="t">${esc(t.length>320?t.slice(0,320)+'…':t)}</div>${h.note?`<div class="nt">${esc(h.note)}</div>`:''}<div class="where">${esc(chapterName(d,h.s))}${chapterName(d,h.s)?' · ':''}${pctOf(d,h.s)}%</div></div></div>`; }).join('')
      : L.map(b=>`<div class="hlrow"><span class="bar" style="background:var(--accent)"></span><div class="grow" data-nb="${d.id}" data-ni="${b.i}"><div class="t"><b>${esc(b.name||'Bookmark')}</b></div><div class="where">${pctOf(d,b.i)}% · ${esc(snip(d,b.i,b.i+11))}…</div></div></div>`).join('');
    return `<div class="nbook"><div class="nbook-h"><b>${esc(d.title)}</b><span class="small">${n} ${hl?'highlight':'bookmark'}${n===1?'':'s'}</span>${hl?`<button class="btn" type="button" data-copy="${d.id}" style="padding:6px 10px;font-size:.8rem">Copy</button>`:''}<button class="btn" type="button" data-exp="${d.id}" style="padding:6px 10px;font-size:.8rem">Export</button></div>${rows}</div>`;
  }).join('');
}
$('#notesSeg').addEventListener('click',e=>{ const b=e.target.closest('button[data-n]'); if(!b) return; NOTESEG=b.dataset.n; LS.set('notesSeg',NOTESEG); renderNotes(); });
for(const id of ['#notesHl','#notesBm']) $(id).addEventListener('click',async e=>{
  const x=e.target.closest('[data-exp]'); if(x){ const d=LIB.find(y=>y.id===x.dataset.exp); if(d) exportSheet(d); return; }
  const c=e.target.closest('[data-copy]');
  if(c){ const d=LIB.find(x=>x.id===c.dataset.copy); if(!d) return; await bookSnips(d); const txt=d.title+'\n\n'+d.highlights.map(h=>'“'+snip(d,h.s,h.e)+'”'+(h.note?'\nNote: '+h.note:'')).join('\n\n'); try{ await navigator.clipboard.writeText(txt); toast('Copied '+d.highlights.length+' highlight'+(d.highlights.length===1?'':'s')); }catch(err){ toast('Couldn’t copy on this device.'); } return; }
  const g=e.target.closest('[data-nb]'); if(!g) return;
  const i=+g.dataset.ni; if(await openDoc(g.dataset.nb)!==false){ R.returnTo='words'; goTo(i,true); }
});

/* ---------- sheet, toast, views ---------- */
let sheetActs={}, sheetAt=0;
/* a tap that opens a sheet is followed by the browser's own click at the same spot; ignore it */
const ghost=()=>performance.now()-sheetAt<420;
function openSheet(title, body, acts, cls){
  sheetActs=acts||{}; selHide(); sheetAt=performance.now();
  const sh=$('#sheet'); sh.className=cls||'';
  sh.innerHTML=`<div class="grab"></div><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-act="__close" aria-label="Close">${ICON.close}</button></div><div class="sheet-body">${body}</div>`;
  sh.hidden=false; const bd=$('#backdrop'); bd.className=cls&&cls.includes('short')?'light':''; bd.hidden=false;
}
function closeSheet(){ $('#sheet').hidden=true; $('#backdrop').hidden=true; sheetActs={}; }
$('#sheet').addEventListener('click',e=>{ if(ghost()){ e.preventDefault(); return; } const b=e.target.closest('[data-act]'); if(!b) return; const a=b.dataset.act; if(a==='__close'){ closeSheet(); return; } const fn=sheetActs[a]; if(fn) fn(b,e); });
$('#backdrop').onclick=()=>{ if(!ghost()) closeSheet(); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(!$('#sheet').hidden) closeSheet(); else if($('#imgOverlay')) $('#imgOverlay').remove(); } });
function toast(msg, action, ms, progress){
  $('#toastMsg').textContent=msg; const a=$('#toastAct'); const prog=$('#toastProg'); const bar=$('#toastBar');
  if(action){ a.hidden=false; a.textContent=action.label; a.onclick=()=>{ action.fn(); $('#toast').hidden=true; }; } else a.hidden=true;
  if(progress!=null){ prog.hidden=false; bar.style.width=Math.max(0,Math.min(100,progress))+'%'; } else { prog.hidden=true; }
  $('#toast').hidden=false; clearTimeout(toastT); if(ms!==0) toastT=setTimeout(()=>{ $('#toast').hidden=true; }, ms||(action?5000:3200));
}
const VIEWS=['library','words','stats','settings'];
function showView(v){
  for(const x of VIEWS) $('#v-'+x).hidden=(x!==v);
  $('#v-reader').hidden=v!=='reader'; $('#tabs').hidden=v==='reader';
  document.querySelectorAll('#tabs button').forEach(b=>{ if(b.dataset.tab===v) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  if(v==='stats') renderStats(); if(v==='settings') renderSettings(); if(v==='words') renderNotes(); if(v==='library'){ renderLibrary(); setTimeout(nearFinishCheck, 600); }
}
const TABS={library:['book','Library'], words:['note','Notes'], stats:['stats','Stats'], settings:['gear','Settings']};
document.querySelectorAll('#tabs button').forEach(b=>{ const [ic,l]=TABS[b.dataset.tab]; b.innerHTML=ICON[ic]+l; b.onclick=()=>showView(b.dataset.tab); });
$('#rBack').innerHTML=ICON.back; $('#rSearch').innerHTML=ICON.search; $('#rToc').innerHTML=ICON.toc; $('#rNotes').innerHTML=ICON.note; $('#rMark').innerHTML=ICON.mark; $('#rTts').innerHTML=ICON.speaker;
$('#bSent').innerHTML=ICON.bsent; $('#bWord').innerHTML=ICON.back; $('#fWord').innerHTML=ICON.fwd; $('#fSent').innerHTML=ICON.fsent;
$('#wpmDown').innerHTML=ICON.minus; $('#wpmUp').innerHTML=ICON.plus; $('#asDown').innerHTML=ICON.minus; $('#asUp').innerHTML=ICON.plus; $('#asPlay').innerHTML=ICON.play;
$('#defineBtn').innerHTML=ICON.define+'Define'; $('#markBtn').innerHTML=ICON.mark+'Bookmarks';

/* ---------- sample book ---------- */
const SAMPLE_V=12;
const SAMPLE_HTML=`
<h2>Welcome to Tooz eReader</h2>
<p>This short book is a tour of Tooz. It opens by itself the first time you use the app. When you close it, Tooz asks whether to keep it in your library or tuck it away in <strong>Settings → Tutorial</strong>, where you can open it again any time.</p>
<p>Swipe left, or tap the right edge of the page, to turn it. Tap the left edge to go back. Tap the <em>middle</em> of the page to show or hide the controls.</p>
<p>While you read, the controls stay out of the way. The chapter name sits at the top and your page number at the bottom.</p>
<h2>Three ways to read</h2>
<p>Tap <strong>Aa</strong> at the top to choose how you read:</p>
<ul><li><strong>Pages</strong> turns pages like a printed book.</li><li><strong>Scroll</strong> gives you one long column to scroll through.</li><li><strong>Speed</strong> flashes the words one at a time in the same spot, so your eyes never have to move.</li></ul>
<p>All three share your place, down to the word. Switch in the middle of a sentence and you carry on <em>exactly</em> where you were.</p>
<h2>Auto-scroll</h2>
<p>In Scroll, turn on <strong>Auto-scroll</strong> in Settings (or Aa → <strong>More settings</strong>). A play button and a speed slider appear at the bottom. The text then moves by itself at the words per minute you set, easing in gently when it starts. Tap the page to pause. After that, a tap simply shows or hides the controls so you can read at your own pace; press the play button when you want it to move again.</p>
<p>It can also pause for a moment at pictures and headings, so you have time to take them in.</p>
<h2>Speed reading</h2>
<p>In Speed, press play and keep your eyes on the coloured letter. Tap anywhere to pause, and the whole sentence appears so you can find your place. The buttons step back or forward by a word or a sentence, and the slider sets your speed.</p>
<p>Every speed setting is in Settings under Speed mode (or Aa → <strong>More settings</strong>): pauses at commas and full stops, a gentle ramp up to speed, two or three words at once, and the colour of the focus letter.</p>
<p>Hyphenated words like well-known and twenty-five stay on screen a little longer. A dash joins the word before it—like this—and gets the same short pause as a comma.</p>
<h2>Make it yours</h2>
<p>Tap <strong>Aa</strong> for the things you change most:</p>
<ul><li>The mode: Pages, Scroll or Speed.</li><li>The theme, from white through sepia to black, with a night theme that can switch on by itself.</li><li>The font (including the dyslexia-friendly Lexend and OpenDyslexic), text size, line spacing and margins. If a book comes with its own font, a <strong>Book’s font</strong> choice appears too.</li><li>Paragraphs: indented, spaced, or spaced and indented.</li></ul>
<p>Everything else is in <strong>Settings</strong>, or tap <strong>More settings</strong> at the bottom of Aa: brightness and warmth, how pages turn and where you tap, auto-scroll, speed reading and read aloud.</p>
<p>Change any of these, or turn your phone sideways, and the page keeps the word you were reading in view.</p>
<p>Change the text size now and watch the page count at the bottom update to match.</p>
<h2>Highlights, notes and words</h2>
<p>Press and hold a word until it is marked. Keep holding and drag to select more, or drag the round handles at either end afterwards. A small bar appears with four highlight colours, plus <strong>Note</strong>, <strong>Copy</strong>, <strong>Share</strong> and <strong>Define</strong>. Tap anywhere else to clear the selection. Tap a highlight later to change its colour, add a note or remove it.</p>
<p><strong>Copy</strong> adds where the words came from: the author, the book and the chapter. <strong>Share</strong> turns the words into a picture, in light, sepia or dark, ready to send or save to Photos.</p>
<p>The phone’s own menu stays hidden while you select. <strong>Define</strong> looks up the word you selected, and from there you can still reach the phone’s dictionary.</p>
<blockquote><p>Try it on this sentence: highlight it, then add a note saying what you think of it.</p></blockquote>
<p>Every word you define is saved in the <strong>Notes</strong> tab under Words, along with the sentence you found it in. The Notes tab also gathers the highlights, notes and bookmarks from every book, so you can find them without opening each one.</p>
<p>To keep them somewhere else, tap <strong>Export</strong> beside a book in the Notes tab, or <strong>Export highlights and notes</strong> in the book’s three dots. You get one document with every highlight, note and bookmark, grouped by chapter, to print, save as a PDF or paste into another app.</p>
<h2>Footnotes</h2>
<p>Books often tuck extra detail into footnotes.<a href="#note1"><sup>1</sup></a> Tap the small number and the note opens without losing your place.</p>
<hr>
<p>A row of stars like the one above marks a break in the story. Books you import keep their breaks, headings, <em>italics</em>, quotations and lists.</p>
<h2>Getting around</h2>
<p>The list icon at the top opens the contents. The note icon beside it opens this book’s highlights, notes and bookmarks. In very long books, like the Bible, the contents show the books first; tap one to see its chapters. The magnifying glass searches the whole book. The bookmark at the bottom marks the page you are on, and the bar above it lets you drag to anywhere in the book.</p>
<p>After any jump, a <strong>Back to where you were</strong> button appears, so a quick look ahead never costs you your place. Wherever you land, nothing moves until you press play.</p>
<h2>Read aloud</h2>
<p>Tap the speaker at the bottom to open the audio controls. Nothing plays yet: tap a word to choose where to start, then press <strong>play</strong>. Each word is marked as it is spoken and the page turns by itself. Tap another word while it plays to jump there. The arrows go back or forward a sentence, and the slider sets the speed. The controls stay on screen until you tap the speaker again to close them.</p>
<p>Read aloud skips footnote numbers and the notes themselves, pauses a little longer before a new heading, and reads Bible references in full: Rom. 8:28 is read as “Romans chapter 8 verse 28”, and 1 Cor. 10:31 as “First Corinthians chapter 10 verse 31”. Abbreviations like e.g. and Dr. are read as words. While it reads in Scroll, the page moves so the spoken word stays near the middle of the screen.</p>
<p>There are two kinds of voice, in Settings → Read aloud. <strong>Natural</strong> voices sound like a person reading and run on your phone; each one downloads once (about 60 MB) and then works offline. <strong>Lessac</strong> is a good place to start; tap <strong>Hear this voice</strong> to try others. <strong>iPhone</strong> voices start instantly but sound more robotic. To free up space, Settings → Storage has <strong>Remove all downloaded voices</strong>.</p>
<h2>Helpful extras</h2>
<ul><li><strong>Word-start emphasis</strong> bolds the first part of each word, which helps some readers move faster.</li><li><strong>Adaptive pacing</strong> slows Speed and Auto-scroll a little on long sentences and long words, and speeds up on easy stretches.</li><li><strong>Daily reading goal</strong> lives on the Stats tab. Pick a number of minutes and watch your streak grow.</li><li><strong>Your year in books</strong>, also on Stats, lists the books you finished each year, your longest streak, and a goal for how many books to finish this year.</li></ul>
<h2>How reading time is counted</h2>
<p>Tooz counts time while you turn pages, scroll, speed read or listen. Touching the page, highlighting, defining a word and writing a note all count as reading too.</p>
<ul><li>The clock stops when you switch to another app, lock the phone or close the book, and the page you were on when you closed it still counts.</li><li>If you don’t touch the screen for 5 minutes, Tooz assumes you may have stepped away and counts only as long as that stretch usually takes you. Change the limit to 3 or 10 minutes in Settings.</li><li>Auto-scroll and Speed pause after 10 minutes without a touch and ask <em>Still reading?</em></li></ul>
<h2>Your library</h2>
<p>Tap <strong>Add to library</strong> to open a file, paste a link or some text, or find free books. Twenty-eight classics and two Bibles are already waiting on your shelf; each downloads the first time you open it.</p>
<p>Books you have started sit at the top under <strong>Continue reading</strong>, and each tile fills with colour from left to right as you read.</p>
<p>The <strong>sort</strong> button beside the search bar orders the library by recently read, title or author. The <strong>filter</strong> button opens four sections: reading status, title, author and tags. Pick as many as you like: books matching any choice in a section are shown, and every section you use must match. Once you pick something, the other sections only offer choices that still have books.</p>
<p>To find words inside your books, type three letters or more and tap <strong>Search inside books</strong>. You see every book that has them, with each passage; tap one to open the book right there.</p>
<p>Start typing in the search bar and matching titles, authors and tags appear underneath; tap one to filter by it. Each filter shows as a coloured pill under the search bar; tap its ✕ to remove it. Filters clear when you close the app.</p>
<p>If a book is 98% read but not marked finished, Tooz asks whether you finished it when you come back to the library.</p>
<h2>Tags</h2>
<p>Tap the three dots on any book to change its title or author and to tag it. As you add tags, Tooz suggests some: the subjects the publisher or library gave the book, its form (poetry, sermons, letters, short stories), and topics drawn from the words in the book itself (download a free book first to see them). Your other tags are folded away underneath; tap to open them. Type a few letters to narrow the list. Filter by a tag to see those books together.</p>
<p>To rename a tag or delete it from every book at once, go to <strong>Settings → Tags</strong>.</p>
<h2>Finishing and archiving</h2>
<p>When you reach the end of a book and leave it, Tooz asks whether to keep it, archive it or delete it. Archiving removes the book itself but can keep your place, bookmarks, highlights and notes, along with an optional star rating and review. The date you finished is saved for you.</p>
<p>You can also archive a book from its three dots at any time. Unless you have reached the very end, Tooz asks whether you finished it; if not, it is kept as <em>Did not finish</em>. Archived books live in <strong>Settings → Archived books</strong>, where you can read your notes, add a book back to your library with everything you kept, or delete it for good.</p>
<p><strong>Start over from the beginning</strong>, also in the three dots, puts a book back to <em>Not started</em>.</p>
<h2>Keeping your library safe</h2>
<p>In Settings, <strong>Save backup</strong> keeps everything in one file, including your archive and your settings. <strong>Storage</strong> shows how much space Tooz uses and which books take the most. If you ever want a clean slate, <strong>Erase all data</strong> removes every book, note and setting from this device.</p>
<p>When Tooz is updated, a short <em>What’s new</em> note appears the next time you open it. You can read it again, and see the version number, in <strong>Settings → About</strong>.</p>
<p>That’s the tour. Close this book with the back arrow whenever you’re ready.</p>
<h2>Notes</h2>
<p id="note1">1. This is the footnote. Tap “Go to this note in the book” to jump here. In a list of notes like this one, tap the number at the start of a note to go back to where it was mentioned.</p>`;
function sampleDoc(){
  const d=new DOMParser().parseFromString(SAMPLE_HTML,'text/html'); const ctx=newCtx(true); walkHTML(d.body,ctx,'');
  const notes=resolveNotes(ctx, f=>ctx.anchors[f]);
  const chapters=ctx.blocks.filter(b=>/^h[1-3]$/.test(b.t)).map(b=>({t:ctx.words.slice(b.s,b.e).join(' '), i:b.s, d:0}));
  return {title:'Welcome to Tooz eReader (sample)', kind:'sample', words:ctx.words, ends:ctx.ends, blocks:ctx.blocks, wf:ctx.wf, notes, breaks:ctx.breaks, chapters};
}
const sampleText=(id,d)=>({id, words:d.words, ends:d.ends, blocks:d.blocks, wf:d.wf, notes:d.notes, breaks:d.breaks, images:null});

function touch(m){ m.mod=Date.now(); Store.put('meta',m).catch(()=>{}); }
function fetchText(meta){ if(meta.kind!=='sample') return null; return sampleText(meta.id, sampleDoc()); }

/* ---------- boot ---------- */
async function boot(){
  applyLook(); setWpm(S.wpm); asUI();
  await Store.open();
  try{ LIB=await Store.all('meta'); }catch(e){ LIB=[]; }
  LIB=LIB.filter(m=>m.id!=='__probe');
  const hadData=LIB.length>0 || LS.get('seeded',false);
  /* an older sample book is replaced by the current tour */
  for(const m of LIB){ if(m.kind==='sample' && m.sv!==SAMPLE_V){ try{ const d=sampleDoc(); await Store.put('texts',sampleText(m.id,d)); Object.assign(m,{title:d.title, count:d.words.length, chapters:d.chapters, pos:0, finished:false, bookmarks:[], highlights:[], sv:SAMPLE_V}); try{ localStorage.removeItem('rf.pos.'+m.id); }catch(e){} touch(m); }catch(e){} } }
  for(const m of LIB){ if(applySavedPos(m)) Store.put('meta',m).catch(()=>{}); }
  try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(e){}
  try{ if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')) navigator.serviceWorker.register('sw.js').catch(()=>{}); }catch(e){}
  let firstRun=null;
  if(!LS.get('seeded',false) && !LIB.length){ try{ const sm=await addDocPlain(sampleDoc()); sm.sv=SAMPLE_V; touch(sm); LS.set('seeded',true); firstRun=sm.id; }catch(e){} }
  await seedShelf(); migrateTags();
  renderLibrary(); renderWords();
  initBackups();
  const onHash=()=>{ if(location.hash==='#paste'){ try{ history.replaceState(null,'',location.pathname+location.search); }catch(e){} openPaste(true); } };
  onHash(); window.addEventListener('hashchange', onHash);
  if(document.fonts) document.fonts.ready.then(()=>{ if(R.mode==='speed'&&!$('#v-reader').hidden) showChunk(R.pos); });
  showView('library');
  /* the first time Tooz opens, the tutorial opens with it */
  checkUpdated(hadData && !firstRun);
  if(firstRun && !keepTutorial()) openDoc(firstRun);
  else if(LS.get('tutOpen',false) && !keepTutorial()){ LS.set('tutOpen',false); const sm=LIB.find(m=>m.kind==='sample'); if(sm) setTimeout(()=>tutorialPrompt(sm.id), 700); }
}
boot();
</script>
</body>
</html>
