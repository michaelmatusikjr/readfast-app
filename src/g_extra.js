/* ---------- version and what's new ---------- */
const APP_VERSION='2026.11.13.7';
const WHATSNEW=[
  ['Settings, simplified','Aa now shows just the mode, text size, theme and a few fonts. Tap a heading underneath for more text options and page settings.'],
  ['Options where you use them','Choose a voice with the new voice button on the audio controls. In Scroll, auto-scroll has its own button at the bottom, with its options under ⋯. In Speed, the gear next to the speed slider holds the speed-reading options.'],
  ['App settings in one place','Settings now holds only app-wide things: light (dim, warmth and the night theme), reading stats, what the bottom line shows, backups, storage, tags and help.'],
  ['Taller bottom bars','The bars at the bottom of the screen are taller and reach the bottom edge, like other iPhone apps.']
];
function whatsNewSheet(){
  openSheet('What’s new in Tooz', `<p class="note" style="margin-top:0">Version ${APP_VERSION}</p>
    <div class="wn">${WHATSNEW.map(([h,t])=>`<div class="wn-i"><b>${h}</b><div class="small">${t}</div></div>`).join('')}</div>
    <button class="btn primary block" type="button" data-act="ok">Got it</button>`, { ok:closeSheet });
}
/* shown once after an update; never on the very first launch */
function checkUpdated(hadData){
  const seen=LS.get('seenVer','');
  LS.set('seenVer',APP_VERSION);
  if(hadData && seen!==APP_VERSION) setTimeout(()=>{ if($('#sheet').hidden && $('#v-reader').hidden) whatsNewSheet(); else toast('Tooz was updated', {label:'What’s new', fn:whatsNewSheet}, 8000); }, 900);
}

/* ---------- storage used ---------- */
const fmtBytes=n=>n<1024?Math.round(n)+' B':n<1048576?Math.round(n/1024)+' KB':n<1073741824?(n/1048576).toFixed(n<10485760?1:0)+' MB':(n/1073741824).toFixed(1)+' GB';
function sizeOf(x){
  if(x==null) return 0;
  if(x instanceof Blob) return x.size;
  if(ArrayBuffer.isView(x)) return x.byteLength;
  if(typeof x==='string') return x.length*2;
  if(Array.isArray(x)){ let n=0; for(const v of x) n+= typeof v==='string'? v.length*2+8 : typeof v==='number'? 8 : sizeOf(v); return n; }
  if(typeof x==='object'){ let n=0; for(const k in x) n+=sizeOf(x[k]); return n; }
  return 8;
}
async function bookBytes(id){
  const t=await Store.get('texts',id).catch(()=>null); if(!t) return 0;
  let n=0; for(const k of ['words','ends','blocks','wf','notes','breaks','chapters']) n+=sizeOf(t[k]);
  for(const f of (t.images&&t.images.files)||[]) n+= f.blob?f.blob.size:(f.data||'').length;
  for(const f of (t.font&&t.font.faces)||[]) n+= f.blob?f.blob.size:(f.data||'').length;
  return n;
}
async function storageSummary(){
  const el=$('#storeUse'); if(!el) return;
  try{
    if(navigator.storage&&navigator.storage.estimate){ const e=await navigator.storage.estimate(); el.innerHTML=`Tooz is using <b>${fmtBytes(e.usage||0)}</b> on this device${e.quota?' (space allowed: about '+fmtBytes(e.quota)+')':''}.`; }
    else el.textContent='This browser doesn’t report how much space Tooz uses. Tap below to add it up book by book.';
  }catch(err){ el.textContent='Couldn’t read storage use.'; }
}
async function storageSheet(){
  openSheet('Space used by each book','<p class="note">Adding it up…</p>');
  const have=LIB.filter(d=>!d.pending), notDl=LIB.length-have.length;
  const rows=[]; for(const d of have) rows.push({d, n:await bookBytes(d.id)});
  rows.sort((a,b)=>b.n-a.n);
  const total=rows.reduce((s,r)=>s+r.n,0);
  let other=0; try{ for(let k=0;k<localStorage.length;k++){ const key=localStorage.key(k); if(key.startsWith('rf.')) other+=(key.length+(localStorage.getItem(key)||'').length)*2; } }catch(e){}
  if($('#sheet').hidden) return;
  openSheet('Space used by each book', `
    <p class="note" style="margin-top:0">${rows.length} downloaded book${rows.length===1?'':'s'} use about <b>${fmtBytes(total)}</b>. Notes, highlights, settings, reading log and archive use about <b>${fmtBytes(other)}</b>.</p>
    <div class="list">${rows.map(r=>`<div class="li" style="cursor:default"><span class="grow" style="min-width:0"><b>${esc(r.d.title)}</b>${r.d.author?`<span class="small" style="display:block">${esc(r.d.author)}</span>`:''}</span><span class="small" style="font-family:var(--f-mono);white-space:nowrap">${fmtBytes(r.n)}</span></div>`).join('')}</div>
    ${notDl?`<p class="note">Not listed: ${notDl} book${notDl===1?'':'s'} on your shelf that ${notDl===1?'hasn’t':'haven’t'} been downloaded yet, so ${notDl===1?'it takes':'they take'} no space.</p>`:''}
    <p class="note">Sizes are estimates of the stored text, pictures and fonts. The phone’s own total (above, in Settings) also counts the app itself and the browser’s overhead, so it is usually larger.</p>`);
}

/* ---------- search inside every book ---------- */
const FTX=new Map(); /* id -> {s: lower-case text, o: word start offsets} */
async function ftIndex(d){
  if(FTX.has(d.id)) return FTX.get(d.id);
  const t=(R.meta&&R.meta.id===d.id&&R.text)||await Store.get('texts',d.id).catch(()=>null)||fetchText(d); if(!t||!t.words) return null;
  const o=new Int32Array(t.words.length); let s=''; const parts=[];
  let len=0; for(let k=0;k<t.words.length;k++){ o[k]=len; const w=(t.words[k]||'').toLowerCase(); parts.push(w); len+=w.length+1; }
  s=parts.join(' ');
  const x={s,o,t}; FTX.set(d.id,x); return x;
}
const normQ=q=>q.toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
function wordAt(o,pos){ let lo=0,hi=o.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(o[m]<=pos) lo=m; else hi=m-1; } return lo; }
const FT_PER_BOOK=25;
async function searchAllBooks(q){
  q=normQ(q); if(q.length<3) return;
  const books=LIB.filter(d=>!d.pending), skipped=LIB.length-books.length;
  openSheet('Search inside books', `<p class="note">Searching ${books.length} book${books.length===1?'':'s'} for “${esc(q)}”…</p>`);
  const res=[]; let total=0;
  for(const d of books){
    const x=await ftIndex(d); if(!x) continue;
    const s=x.s.replace(/[’‘]/g,"'").replace(/[“”]/g,'"'); /* same length as x.s */
    const hits=[]; let p=s.indexOf(q), n=0;
    while(p>=0){ n++; if(hits.length<FT_PER_BOOK) hits.push(wordAt(x.o,p)); p=s.indexOf(q,p+q.length); }
    if(n){ total+=n; res.push({d,x,hits,n}); }
    await new Promise(r=>setTimeout(r,0));
  }
  if($('#sheet').hidden) return;
  res.sort((a,b)=>b.n-a.n);
  const snipOf=(x,i)=>{ const a=Math.max(0,i-8), b=Math.min(x.t.words.length-1,i+14); return (a>0?'…':'')+esc(joinWords(x.t,a,b))+(b<x.t.words.length-1?'…':''); };
  const reEsc=x=>esc(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'\\s+');
  const rx=new RegExp(q.split("'").map(reEsc).join("(?:&#39;|[’‘])"),'gi');
  const mark=h=>h.replace(rx,m=>'<mark>'+m+'</mark>');
  openSheet('Search inside books', `
    <p class="note" style="margin-top:0">${total?`“${esc(q)}” appears ${total.toLocaleString()} time${total===1?'':'s'} in ${res.length} book${res.length===1?'':'s'}.`:`“${esc(q)}” doesn’t appear in any downloaded book.`}</p>
    ${res.map(r=>`<div class="nbook"><div class="nbook-h"><b>${esc(r.d.title)}</b><span class="small">${r.n.toLocaleString()} match${r.n===1?'':'es'}</span></div>${r.hits.map(i=>`<button class="hlrow ftrow" type="button" data-act="go" data-id="${r.d.id}" data-i="${i}"><span class="bar" style="background:var(--accent)"></span><div class="grow"><div class="t">${mark(snipOf(r.x,i))}</div><div class="where">${esc(chapterName(r.d,i))}${chapterName(r.d,i)?' · ':''}${pctOf(r.d,i)}%</div></div></button>`).join('')}${r.n>r.hits.length?`<p class="note" style="margin:4px 0 0">Showing the first ${r.hits.length} of ${r.n.toLocaleString()}. Open the book and use its search for the rest.</p>`:''}</div>`).join('')}
    ${skipped?`<p class="note">Not searched: ${skipped} book${skipped===1?'':'s'} on your shelf that ${skipped===1?'hasn’t':'haven’t'} been downloaded yet.</p>`:''}`, {
    go:async(b)=>{ closeSheet(); const id=b.dataset.id, i=+b.dataset.i; if(await openDoc(id)!==false){ R.returnTo='library'; goTo(i,true); } }
  });
}

/* ---------- export highlights, notes and bookmarks ---------- */
function exportSheet(src){
  openSheet('Export highlights and notes', `
    <p class="note" style="margin-top:0">Save every highlight, note and bookmark from “${esc(src.title)}” as a document.</p>
    <button class="btn primary block" type="button" data-act="html">Document for reading or printing (.html)</button>
    <button class="btn block" type="button" data-act="txt">Plain text (.txt)</button>
    <p class="note">The .html file opens in Safari or Files and can be printed or saved as a PDF from the share button. Plain text pastes cleanly into Notes or an email.</p>`, {
    html:()=>exportBook(src,'html'), txt:()=>exportBook(src,'txt')
  });
}
/* src is a library book or an archived record */
async function exportData(src){
  const arch=!!src.kept; const items=[];
  if(arch){
    for(const h of src.kept.highlights||[]) items.push({kind:'h', i:h.s, q:h.noteOnly?'':h.q, note:h.note||'', c:h.c, at:h.at});
    for(const b of src.kept.bookmarks||[]) items.push({kind:'b', i:b.i, q:b.q||'', name:b.name||'', at:b.at});
  } else {
    await bookSnips(src);
    for(const h of src.highlights||[]) items.push({kind:'h', i:h.s, q:snip(src,h.s,h.e), note:h.note||'', c:h.c, at:h.at});
    for(const b of src.bookmarks||[]) items.push({kind:'b', i:b.i, q:snip(src,b.i,b.i+11), name:b.name||'', at:b.at});
  }
  items.sort((a,b)=>a.i-b.i);
  const ch=i=>arch?'':chapterName(src,i);
  const groups=[]; for(const it of items){ const c=ch(it.i); if(!groups.length || groups[groups.length-1].c!==c) groups.push({c, L:[]}); groups[groups.length-1].L.push(it); }
  return {items, groups, pct:i=>src.count?pctOf(src,i):null};
}
async function exportBook(src, fmt){
  const {items, groups, pct}=await exportData(src);
  const nH=items.filter(x=>x.kind==='h'&&x.q).length, nN=items.filter(x=>x.note).length, nB=items.filter(x=>x.kind==='b').length;
  const day=new Date().toLocaleDateString([], {month:'long', day:'numeric', year:'numeric'});
  const sum=`${nH} highlight${nH===1?'':'s'}, ${nN} note${nN===1?'':'s'}, ${nB} bookmark${nB===1?'':'s'}`;
  const where=it=>{ const p=pct(it.i); return [p!=null?p+'%':'', it.at?fmtDay(it.at):''].filter(Boolean).join(' · '); };
  let out, type, ext;
  if(fmt==='txt'){
    const L=[src.title, src.author?'by '+src.author:'', 'Exported from Tooz eReader on '+day+' · '+sum, ''];
    for(const g of groups){ if(g.c) L.push('', '== '+g.c+' ==', '');
      for(const it of g.L){
        if(it.kind==='b') L.push('[Bookmark] '+(it.name||'Bookmark')+(it.q?' — '+it.q+'…':''));
        else { if(it.q) L.push('“'+it.q+'”'); if(it.note) L.push('Note: '+it.note); }
        const w=where(it); if(w) L.push('('+w+')'); L.push(''); } }
    out=L.filter((x,k)=>x!==''||L[k-1]!=='').join('\n'); type='text/plain'; ext='txt';
  } else {
    const body=groups.map(g=>(g.c?`<h2>${esc(g.c)}</h2>`:'')+g.L.map(it=> it.kind==='b'
      ? `<p class="bm">🔖 <b>${esc(it.name||'Bookmark')}</b>${it.q?' — '+esc(it.q)+'…':''}<span class="w">${esc(where(it))}</span></p>`
      : `<div class="h c${it.c||1}">${it.q?`<blockquote>${esc(it.q)}</blockquote>`:''}${it.note?`<p class="n"><b>Note:</b> ${esc(it.note)}</p>`:''}<span class="w">${esc(where(it))}</span></div>`).join('')).join('');
    out=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(src.title)} — highlights and notes</title><style>
body{font:17px/1.55 Georgia,serif;max-width:680px;margin:0 auto;padding:28px 20px;color:#222;background:#fff}h1{font-size:1.6em;margin:0 0 4px}.by{color:#555;margin:0}.meta{color:#777;font:13px system-ui,sans-serif;margin:6px 0 26px}
h2{font:600 15px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#7a5a2f;margin:30px 0 10px;border-bottom:1px solid #e6dccb;padding-bottom:4px}
.h{border-left:4px solid #f2d26b;padding:2px 0 2px 14px;margin:0 0 18px;break-inside:avoid}.c2{border-color:#9fd39a}.c3{border-color:#9cc3ef}.c4{border-color:#f1a7c0}
blockquote{margin:0}.n{margin:6px 0 0;font-family:system-ui,sans-serif;font-size:15px}.w{display:block;color:#888;font:12px system-ui,sans-serif;margin-top:4px}.bm{font-family:system-ui,sans-serif;font-size:15px;margin:0 0 16px}
@media (prefers-color-scheme:dark){body{background:#151515;color:#ddd}.by{color:#aaa}h2{color:#d8b77d;border-color:#333}}
</style></head><body><h1>${esc(src.title)}</h1>${src.author?`<p class="by">${esc(src.author)}</p>`:''}<p class="meta">Exported from Tooz eReader on ${day} · ${sum}</p>${body||'<p>Nothing saved yet.</p>'}</body></html>`;
    type='text/html'; ext='html';
  }
  const name=(src.title||'Book').replace(/[^\w\s-]/g,'').replace(/\s+/g,' ').trim().slice(0,50)+' - highlights.'+ext;
  const file=new File([out], name, {type});
  closeSheet();
  try{ if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file]}); return; } }catch(err){ if(err&&err.name==='AbortError') return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(file); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('Exported '+sum);
}

/* ---------- year in books ---------- */
function finishedRecords(){
  const seen=new Set(), out=[];
  const add=(id,title,author,at,rating)=>{ const k=id+'|'+new Date(at).toDateString(); if(seen.has(k)) return; seen.add(k); out.push({id,title,author,at,rating:rating||0}); };
  for(const a of ARCH.list()) if(a.status==='finished' && a.finishedAt) add(a.id,a.title,a.author,a.finishedAt,a.rating);
  let undated=0;
  for(const d of LIB){
    for(const h of d.history||[]) if(h.status==='finished' && h.finishedAt) add(d.id,d.title,d.author,h.finishedAt,h.rating);
    if(d.finished && d.kind!=='sample'){ if(d.finishedAt) add(d.id,d.title,d.author,d.finishedAt,0); else undated++; }
  }
  out.sort((a,b)=>b.at-a.at);
  return {list:out, undated};
}
function longestStreak(st, met){
  const keys=Object.keys(st).filter(met).sort(); let best=0, run=0, prev=null;
  for(const k of keys){ const t=new Date(k+'T12:00:00').getTime(); run= prev!=null && Math.round((t-prev)/86400000)===1 ? run+1 : 1; prev=t; if(run>best) best=run; }
  return best;
}
function yearHTML(st, met){
  const {list, undated}=finishedRecords(); const yr=new Date().getFullYear();
  const byYear=new Map(); for(const r of list){ const y=new Date(r.at).getFullYear(); if(!byYear.has(y)) byYear.set(y,[]); byYear.get(y).push(r); }
  const thisYear=(byYear.get(yr)||[]).length, goal=S.yearGoal||0;
  const start=new Date(yr,0,1), dayOfYear=Math.floor((Date.now()-start)/86400000)+1, daysIn=((yr%4===0&&yr%100!==0)||yr%400===0)?366:365;
  const pace=goal?Math.round(goal*dayOfYear/daysIn*10)/10:0;
  const best=longestStreak(st, met);
  const years=[...byYear.keys()].sort((a,b)=>b-a);
  return `<div class="chart" id="yearBox">
      <div class="topbar" style="padding:0"><h2>${yr} in books</h2><span class="val" style="font-family:var(--f-mono);color:var(--accent)">${thisYear}${goal?' / '+goal:''}</span></div>
      ${goal?`<p class="note" style="margin:6px 0 0">${thisYear} of ${goal} books finished${thisYear>=goal?' · goal reached':thisYear>=pace?' · on pace':' · '+Math.max(1,Math.ceil(pace-thisYear))+' behind pace'}</p><div class="goalbar"><i style="width:${Math.min(100,Math.round(100*thisYear/goal))}%"></i></div>`:'<p class="note" style="margin:6px 0 0">Set a goal for the number of books to finish this year.</p>'}
      <div class="chips" id="yearChips" style="margin-top:10px">${[0,6,12,24,36,52].map(v=>`<button class="chip" type="button" data-ygoal="${v}" aria-pressed="${goal===v}">${v?v+' books':'Off'}</button>`).join('')}</div>
      <div class="tiles" style="margin-top:12px"><div class="tile"><div class="v">${best}</div><div class="k">Longest streak (days)</div></div><div class="tile"><div class="v">${list.length}</div><div class="k">Books finished, all time</div></div></div>
      ${years.length?years.map(y=>{ const L=byYear.get(y); return `<details class="tdet yr"${y===yr?' open':''}><summary>${y} <span>· ${L.length} book${L.length===1?'':'s'}</span></summary><div class="list">${L.map(r=>`<div class="li" style="cursor:default"><span class="grow" style="min-width:0"><b>${esc(r.title)}</b><span class="small" style="display:block">${r.author?esc(r.author)+' · ':''}${fmtDay(r.at)}${r.rating?' · <span style="color:var(--accent)">'+starsTxt(r.rating)+'</span>':''}</span></span></div>`).join('')}</div></details>`; }).join(''):'<p class="note">Books you finish, in your library or archive, are listed here by year.</p>'}
      ${undated?`<p class="note">Not counted by year: ${undated} book${undated===1?'':'s'} marked finished before Tooz recorded finish dates.</p>`:''}
    </div>`;
}
