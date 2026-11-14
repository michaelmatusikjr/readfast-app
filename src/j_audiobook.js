/* ---------- Listen offline: download a book's read-aloud audio (Nov 2026) ----------
   While the book is open, Tooz makes the audio with the chosen natural voice, a sentence at a time, and saves it as MP3
   parts of up to 10 minutes (never crossing a chapter start) in the phone's private storage: audiobooks/<book id>/.
   manifest.json records, for every sentence, its words and where it starts in its part, so saved audio highlights the
   words like live reading. Saved audio plays from one file per part, which keeps going with the screen locked.
   Parts can be shared as one MP3 per chapter (Save to Files, other audio apps) to listen with Tooz closed.
   The encoder and file writes run in mp3-worker.js. */
const AB={mf:null, mfFor:null, job:null, wake:null, w:null, id:0, cb:new Map()};
const AB_PART_MAX=600;   /* seconds of audio per saved part */
const sleepMs=ms=>new Promise(r=>setTimeout(r,ms));

function abWorker(){
  if(AB.w) return AB.w;
  const w=new Worker('mp3-worker.js',{type:'module'});
  w.onmessage=e=>{ const m=e.data; const c=AB.cb.get(m.id); if(!c) return; AB.cb.delete(m.id); if(m.type==='error') c.rej(new Error(m.msg)); else c.res(m); };
  w.onerror=e=>{ for(const c of AB.cb.values()) c.rej(new Error(e.message||'The audio saver stopped')); AB.cb.clear(); AB.w=null; };
  AB.w=w; return w;
}
function abCall(msg, transfer){ return new Promise((res,rej)=>{ const id=msg.id||++AB.id; AB.cb.set(id,{res,rej}); abWorker().postMessage(Object.assign({},msg,{id}), transfer||[]); }); }
function abPost(msg, transfer){ abWorker().postMessage(msg, transfer||[]); }

async function abDir(id, create){ const root=await navigator.storage.getDirectory(); const a=await root.getDirectoryHandle('audiobooks',{create:!!create}); return a.getDirectoryHandle(id,{create:!!create}); }
async function abFile(id, name){ return (await (await abDir(id)).getFileHandle(name)).getFile(); }
/* the open book's manifest (cached) */
async function abManifest(){
  if(!R.meta) return null;
  const id=R.meta.id;
  if(AB.mfFor===id) return AB.mf;
  let mf=null; try{ mf=JSON.parse(await (await abFile(id,'manifest.json')).text()); }catch(e){}
  AB.mf=mf; AB.mfFor=id; return mf;
}
function abSaveMf(id, mf){ return abCall({type:'write', book:id, name:'manifest.json', text:JSON.stringify(mf)}); }
/* saved audio usable now: same book, same words, same voice */
function abUsable(){ const mf=AB.mfFor===(R.meta&&R.meta.id)? AB.mf : null; return mf && mf.n===R.n && mf.voice===pipVoice() && S.ttsEngine!=='system' ? mf : null; }
function abPartAt(i){ const mf=abUsable(); if(!mf) return null; for(const p of mf.parts) if(i>=p.i && i<p.j) return p; return null; }
const abTopChapters=()=>(R.meta.chapters||[]).filter(c=>(c.d||0)===0);
function abChapterEnd(i){ for(const c of abTopChapters()) if(c.i>i) return c.i; return R.n; }
function abChapterIndex(i){ let k=0; abTopChapters().forEach((c,q)=>{ if(c.i<=i) k=q; }); return k; }
function abVoiceName(v){ for(const [,L] of PIP_VOICES) for(const [id,n] of L) if(id===v) return n; return v; }
const fmtHM=s=>{ s=Math.max(0,Math.round(s)); const h=Math.floor(s/3600), m=Math.round((s%3600)/60); return h? `${h} h ${m} m` : `${Math.max(1,m)} min`; };

/* ---- making the audio ---- */
async function abWakeOn(){ try{ if(navigator.wakeLock && !AB.wake) AB.wake=await navigator.wakeLock.request('screen'); if(AB.wake) AB.wake.addEventListener('release',()=>{ AB.wake=null; }); }catch(e){ AB.wake=null; } }
function abWakeOff(){ try{ AB.wake&&AB.wake.release(); }catch(e){} AB.wake=null; }
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible' && AB.job) abWakeOn(); });

async function abStart(){
  if(AB.job || !R.meta) return;
  if(S.ttsEngine==='system'){ toast('Choose a Natural voice to download a book’s audio.'); return; }
  const id=R.meta.id, voice=pipVoice();
  let mf=await abManifest();
  if(mf && (mf.voice!==voice || mf.n!==R.n)){ await abDelete(id); mf=null; }
  if(!mf) mf={v:1, voice, n:R.n, parts:[], at:0, done:false};
  AB.mf=mf; AB.mfFor=id;
  if(!(await natEnsure())){ abUI(); return; }
  const job={id, voice, run:true, made:0, spent:0, words:0};
  AB.job=job; abWakeOn(); abUI();
  try{ await abLoop(job); }
  catch(e){ if(job.run) toast('Downloading the audio stopped ('+String(e.message||e).replace(/\.+$/,'')+'). Tap Continue to pick up where it left off.', null, 7000); }
  abWakeOff(); if(AB.job===job) AB.job=null; abUI();
}
function abPause(){ if(AB.job){ AB.job.run=false; abPost({type:'abort'}); } abUI(); }
/* one sentence of audio; retried if live reading interrupted the voice */
async function abGen(text, voice){
  for(let t=0;;t++){
    try{ return await pipCall({type:'gen', text, voice, rate:1}); }
    catch(e){ if((e.message==='cancelled'||e.message==='stopped') && t<20){ await sleepMs(300); if(!VM(voice).ready) await pipLoad(voice); continue; } throw e; }
  }
}
async function abLoop(job){
  const mf=AB.mf;
  while(job.run && mf.at<R.n){
    if(!R.meta || R.meta.id!==job.id){ job.run=false; break; }
    const start=mf.at, end=abChapterEnd(start), k=mf.parts.reduce((m,p)=>Math.max(m,p.k+1),0), encId=++AB.id;
    let i=start, t=0, sr=0; const segs=[];
    while(job.run && i<end && t<AB_PART_MAX){
      /* reading aloud from a part that isn't saved yet gets the voice first */
      while(job.run && TTS.on && TTS.nat && !TTS.ab) await sleepMs(700);
      if(!R.meta || R.meta.id!==job.id) job.run=false;
      if(!job.run) break;
      const c=natChunkAt(i); if(c.j<=c.i) break;
      if(c.i>=end){ i=end; break; }
      if(c.text){
        const r=await abGen(c.text, job.voice);
        if(!job.run) break;
        const tp=wavTrimPad(r.wav, natPauseFor(c)); const s=new DataView(tp.buf).getUint32(24,true);
        if(!sr){ sr=s; abPost({type:'start', id:encId, sr}); }
        const pcm=new Int16Array(tp.buf.slice(44)); abPost({type:'pcm', id:encId, data:pcm}, [pcm.buffer]);
        segs.push([c.i, c.j, +t.toFixed(3), +tp.sdur.toFixed(3), c.cum.map(x=>+x.toFixed(3))]);
        t+=tp.dur; job.made+=tp.dur; job.spent+=r.ms/1000; job.words+=c.j-c.i;
      }
      i=Math.min(c.j,end); mf.prog=i; abUI();
    }
    if(!job.run){ abPost({type:'abort'}); break; }
    if(!segs.length){ mf.at= i>start? i : end; continue; }
    const res=await abCall({type:'end', id:encId, book:job.id, name:'p'+k+'.mp3'});
    mf.parts.push({k, i:start, j:i, dur:+t.toFixed(3), size:res.size||0, sr, segs});
    mf.at=i; mf.done=i>=R.n; await abSaveMf(job.id, mf); abUI();
  }
  if(job.run && mf.at>=R.n){ mf.done=true; await abSaveMf(job.id, mf); toast('This book’s audio is downloaded. It keeps playing with the screen locked.', null, 6000); }
}
async function abDelete(id){
  if(AB.job && AB.job.id===id) abPause();
  try{ const root=await navigator.storage.getDirectory(); const a=await root.getDirectoryHandle('audiobooks'); await a.removeEntry(id,{recursive:true}); }catch(e){}
  if(AB.mfFor===id){ AB.mf=null; }
}
async function abDeleteAll(){
  if(AB.job) abPause();
  let n=0; try{ const root=await navigator.storage.getDirectory(); const a=await root.getDirectoryHandle('audiobooks'); for await (const [k] of a.entries()) n++; await root.removeEntry('audiobooks',{recursive:true}); }catch(e){}
  AB.mf=null; AB.mfFor=null; return n;
}
async function abTotalSize(){
  let t=0; try{ const root=await navigator.storage.getDirectory(); const a=await root.getDirectoryHandle('audiobooks');
    for await (const [, d] of a.entries()) if(d.kind==='directory') for await (const [, f] of d.entries()) if(f.kind==='file') t+=(await f.getFile()).size; }catch(e){}
  return t;
}

/* ---- playing saved audio ---- */
function abPlayFrom(i, seq){
  const p=abPartAt(i); if(!p) return false;
  TTS.ab=true; abPlayPart(p, i, seq); return true;
}
async function abPlayPart(p, i, seq){
  let f=null; try{ f=await abFile(R.meta.id, 'p'+p.k+'.mp3'); }catch(e){}
  if(!TTS.on || seq!==TTS.seq) return;
  if(!f){ TTS.ab=false; R.pos=i; natStart(); return; }
  if(NAT.abUrl) URL.revokeObjectURL(NAT.abUrl);
  const url=NAT.abUrl=URL.createObjectURL(f), a=natAudio();
  let s=0; while(s+1<p.segs.length && p.segs[s+1][0]<=i) s++;
  const t0=p.segs[s][2];
  a.onended=null; a.src=url; a.preservesPitch=true; a.defaultPlaybackRate=a.playbackRate=natRate();
  ttsMark(p.segs[s][0]); natMedia();
  const go=()=>{ if(seq!==TTS.seq) return; try{ if(t0>0) a.currentTime=t0; }catch(e){} a.playbackRate=natRate();
    a.play().catch(()=>{ if(seq===TTS.seq && TTS.on){ ttsStop(); toast('Couldn’t play the audio. Tap play to try again.'); } }); };
  if(t0>0 && a.readyState<1) a.addEventListener('loadedmetadata', go, {once:true}); else go();
  clearInterval(TTS.kt);
  TTS.kt=setInterval(()=>{
    if(seq!==TTS.seq){ clearInterval(TTS.kt); return; }
    const ct=a.currentTime;
    if(ct+0.05<p.segs[s][2]){ s=0; while(s+1<p.segs.length && p.segs[s+1][2]<=ct) s++; }
    while(s+1<p.segs.length && p.segs[s+1][2]<=ct){ const g=p.segs[s], ms=(p.segs[s+1][2]-g[2])*1000/natRate(); recordStats(Math.max(300,ms), g[1]-g[0]); ttsLearn(g[1]-g[0], ms); s++; }
    const g=p.segs[s], f=Math.min(1,Math.max(0,(ct-g[2])/(g[3]||1))), cum=g[4];
    let k=0; while(k+1<cum.length && cum[k+1]<=f) k++;
    const w=g[0]+k; if(R.wf && (R.wf[w]&F_N)) return;
    if(w!==TTS.cur) ttsMark(w);
  },150);
  a.onended=()=>{
    clearInterval(TTS.kt);
    if(seq!==TTS.seq || !TTS.on) return;
    const g=p.segs[p.segs.length-1]; recordStats(Math.max(300,(p.dur-g[2])*1000/natRate()), g[1]-g[0]);
    if(p.j>=R.n){ ttsStop(); toast('Finished reading aloud'); return; }
    const nx=abPartAt(p.j);
    if(nx){ abPlayPart(nx, p.j, seq); return; }
    TTS.ab=false; R.pos=p.j;
    if(natReady()){ TTS.knext=p.j; natFill(seq); natPlayNext(seq); } else natStart();   /* not saved yet: carry on live */
  };
}

/* ---- the Listen offline section of the Voice sheet ---- */
function abSectionHTML(){ return `<div class="panel-sec"><div class="group"><div class="set"><div class="hd"><b>Listen offline</b></div><div id="abSec" class="desc" style="color:var(--ink)">Checking…</div></div></div></div>`; }
async function abUI(){
  const el=$('#abSec'); if(!el || !R.meta) return;
  if(S.ttsEngine==='system'){ el.innerHTML=`<p class="note" style="margin:0">Downloading a book’s audio needs a <b>Natural</b> voice (iPhone voices can’t be saved).</p>`; return; }
  const mf=await abManifest(), voice=pipVoice(), job=AB.job && AB.job.id===R.meta.id ? AB.job : null;
  const wordsLeft=w=>Math.max(0,R.n-w);
  const kbps=48, mbPerHour=kbps*3600/8/1000;
  const estSecs=w=> job && job.words>200 ? wordsLeft(w)*(job.made/job.words) : wordsLeft(w)/155*60;
  const doneSecs=mf? mf.parts.reduce((a,p)=>a+p.dur,0) : 0, doneBytes=mf? mf.parts.reduce((a,p)=>a+(p.size||0),0) : 0;
  const btn=(act,label,cls)=>`<button class="btn${cls?' '+cls:''}" type="button" data-act="${act}" style="margin:8px 8px 0 0">${label}</button>`;
  let h='';
  if(job){
    const at=mf.prog||mf.at, pct=Math.floor(100*at/R.n), ch=currentChapter(at);
    const speed=job.spent>0? job.made/job.spent : 0;
    const left= speed>0? estSecs(at)/speed : 0;
    h=`<div>Making this book’s audio with <b>${esc(abVoiceName(voice))}</b>… ${pct}%${ch?' · '+esc(ch.t):''}</div>
      <div class="goalbar" style="margin:8px 0"><i style="width:${pct}%"></i></div>
      <div class="small muted">${speed? `This phone makes speech ${speed.toFixed(1)}× faster than it plays${left? ' · about '+fmtHM(left)+' to go':''}.` : 'Starting…'} Keep Tooz open; the screen stays on by itself. You can listen while it works.</div>
      ${btn('abpause','Pause')}`;
  } else if(mf && mf.voice!==voice){
    h=`<div>This book’s audio is saved with <b>${esc(abVoiceName(mf.voice))}</b> (${fmtHM(doneSecs)}). It plays when that voice is chosen.</div>
      ${btn('abstart','Download again with '+esc(abVoiceName(voice))+' (replaces it)')}${btn('abdel','Remove','danger')}`;
  } else if(mf && mf.n!==R.n){
    h=`<div>The saved audio no longer matches this book’s text.</div>${btn('abstart','Download again')}${btn('abdel','Remove','danger')}`;
  } else if(mf && mf.done){
    h=`<div>Downloaded with <b>${esc(abVoiceName(mf.voice))}</b> · ${fmtHM(doneSecs)} · ${fmtBytes(doneBytes)}. It plays with the screen locked.</div>
      ${btn('abshare','Save as audio files')}${btn('abdel','Remove','danger')}`;
  } else if(mf && mf.parts.length){
    const pct=Math.floor(100*mf.at/R.n);
    h=`<div>${pct}% downloaded with <b>${esc(abVoiceName(mf.voice))}</b> (${fmtHM(doneSecs)}, ${fmtBytes(doneBytes)}).</div>
      ${btn('abstart','Continue downloading','primary')}${btn('abshare','Save as audio files')}${btn('abdel','Remove','danger')}`;
  } else {
    const secs=wordsLeft(0)/155*60;
    h=`<div>Save this book’s audio on this phone so it plays with the screen locked, and so you can save it as audio files to play in other apps.</div>
      <div class="small muted" style="margin-top:6px">With <b>${esc(abVoiceName(voice))}</b>: about ${fmtHM(secs)} of listening, about ${Math.round(secs/3600*mbPerHour+1)} MB. The phone makes the audio while Tooz is open (the screen stays on by itself); it picks up where it left off if you leave.</div>
      ${btn('abstart','Download this book’s audio','primary')}`;
  }
  el.innerHTML=h;
}
const AB_ACTS={
  abstart:()=>{ abStart(); },
  abpause:()=>{ abPause(); },
  abdel:()=>openSheet('Remove this book’s saved audio?', `<p class="note" style="margin-top:0">The book, your place and your notes stay. You can download the audio again any time.</p>
    <button class="btn danger block" type="button" data-act="yes">Remove saved audio</button><button class="btn block" type="button" data-act="no">Cancel</button>`,
    { no:openVoiceSheet, yes:async()=>{ if(TTS.on && TTS.ab) ttsStop(); await abDelete(R.meta.id); toast('Saved audio removed'); openVoiceSheet(); } }),
  abshare:()=>abShareSheet()
};

/* ---- saving as audio files: one MP3 per chapter ---- */
async function abChapterFiles(){
  const mf=await abManifest(); if(!mf) return [];
  const chs=abTopChapters(), groups=new Map();
  for(const p of [...mf.parts].sort((a,b)=>a.i-b.i)){ const q=abChapterIndex(p.i); if(!groups.has(q)) groups.set(q,[]); groups.get(q).push(p); }
  const clean=s=>String(s||'').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
  const out=[];
  for(const [q, parts] of groups){
    const title=chs[q]? chs[q].t : (q? 'Part '+(q+1) : 'Start');
    const name=`${String(q+1).padStart(2,'0')} ${clean(title)||'Chapter'} - ${clean(R.meta.title)}.mp3`;
    out.push({q, title, name, parts, size:parts.reduce((a,p)=>a+(p.size||0),0), dur:parts.reduce((a,p)=>a+p.dur,0)});
  }
  return out;
}
async function abFileFor(g){ const blobs=[]; for(const p of g.parts) blobs.push(await abFile(R.meta.id,'p'+p.k+'.mp3')); return new File(blobs, g.name, {type:'audio/mpeg'}); }
async function abShareSheet(){
  const list=await abChapterFiles();
  if(!list.length){ toast('Nothing saved yet'); return; }
  const files=new Array(list.length).fill(null);
  const row=(g,k)=>`<div class="hlrow"><div class="grow"><div class="t">${esc(g.title)}</div><div class="where">${fmtHM(g.dur)} · ${fmtBytes(g.size)}</div></div><button class="btn" type="button" data-act="one" data-k="${k}">Save</button></div>`;
  openSheet('Save as audio files', `<p class="note" style="margin-top:0">One MP3 file per chapter. Choose <b>Save to Files</b> in the share menu, then play them in the Files app or any audio app — even with Tooz closed.</p>
    <button class="btn primary block" type="button" data-act="all">Save all ${list.length} file${list.length===1?'':'s'} (${fmtBytes(list.reduce((a,g)=>a+g.size,0))})</button>
    <div id="abPrep" class="small muted" style="margin:8px 0"></div>${list.map(row).join('')}`, {
    all:async(b)=>{
      /* iPhone only lets the share menu open straight after a tap, so files are gathered first and a second tap shares them */
      if(b.dataset.ready){ shareFiles(files.filter(Boolean)); return; }
      $('#abPrep').textContent='Getting the files ready…';
      for(let k=0;k<list.length;k++) if(!files[k]) files[k]=await abFileFor(list[k]);
      b.dataset.ready='1'; b.textContent='Share all '+list.length+' files'; $('#abPrep').textContent='Ready. Tap again to choose where to save them.';
    },
    one:async(b)=>{
      const k=+b.dataset.k;
      if(files[k] && b.dataset.ready){ shareFiles([files[k]]); return; }
      b.textContent='…'; files[k]=await abFileFor(list[k]); b.dataset.ready='1'; b.textContent='Share';
    }
  });
}
async function shareFiles(fs){
  try{
    if(navigator.canShare && navigator.canShare({files:fs})){ await navigator.share({files:fs, title:R.meta.title}); return; }
  }catch(e){ if(e && e.name==='AbortError') return; }
  /* no share menu: download them one by one */
  for(const f of fs){ const a=document.createElement('a'); a.href=URL.createObjectURL(f); a.download=f.name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000); }
}
