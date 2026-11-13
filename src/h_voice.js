/* ---------- natural voices (Piper, run on the phone) ----------
   Speech is made in a background worker (piper-worker.js) so the page stays responsive; the next sentences are
   prepared while the current one plays. Audio plays through an <audio> element so it isn't silenced by the ring switch. */
const NAT={audio:null};
/* Kokoro voices were tried and removed (Nov 2026); clear anything they left on the phone */
(async()=>{ try{
  if(LS.get('kokGone',false)) return;
  for(const k of ['kokReady','kokReady.wasm','kokReady.webgpu']) localStorage.removeItem('rf.'+k);
  if(window.caches){ await caches.delete('kokoro-voices'); await caches.delete('transformers-cache'); }
  LS.set('kokGone',true);
}catch(e){} })();
/* one <audio> element, unlocked by the first tap so later sentences can play on their own */
const SILENT_WAV='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
function natAudio(){
  if(!NAT.audio){ NAT.audio=new Audio(); NAT.audio.preload='auto'; NAT.audio.setAttribute('playsinline',''); }
  return NAT.audio;
}
function natUnlock(){ const a=natAudio(); try{ a.src=SILENT_WAV; const p=a.play(); p&&p.catch(()=>{}); }catch(e){} }
/* ---------- Piper (the default natural voice): fast enough for phones ----------
   piper-worker.js (built from src/piper) runs Piper voices with onnxruntime-web. Each voice downloads once
   from Hugging Face (about 60 MB) and is kept in the phone's private file storage, so it works offline. */
const PIP_VOICES=[
  ['American',[['en_US-lessac-medium','Lessac','female, clear'],['en_US-amy-medium','Amy','female'],['en_US-kristin-medium','Kristin','female'],['en_US-hfc_female-medium','Hannah','female'],['en_US-ryan-medium','Ryan','male'],['en_US-joe-medium','Joe','male'],['en_US-john-medium','John','male'],['en_US-norman-medium','Norman','male, deep'],['en_US-bryce-medium','Bryce','male'],['en_US-hfc_male-medium','Henry','male']]],
  ['British',[['en_GB-jenny_dioco-medium','Jenny','female'],['en_GB-cori-medium','Cori','female'],['en_GB-alba-medium','Alba','female, Scottish'],['en_GB-alan-medium','Alan','male'],['en_GB-northern_english_male-medium','Northern','male']]],
  /* Supertonic 3 (test, Nov 2026): one shared model (about 100 MB) plus a tiny file per voice; see src/supertonic */
  ['Supertonic (test)',[1,2,3,4,5].map(n=>['st-F'+n,'Supertonic '+n,'female']).concat([1,2,3,4,5].map(n=>['st-M'+n,'Supertonic '+(n+5),'male']))]
];
const pipVoice=()=>S.pipVoice||'en_US-lessac-medium';
/* one manager per voice engine; both workers answer the same messages (load, gen, cancel) */
const vmake=file=>({file, w:null, ready:null, loading:null, lvoice:null, id:0, cb:new Map(), prog:{}, onprog:null});
const PIP=vmake('piper-worker.js'), STV=vmake('supertonic-worker.js');
const isST=v=>/^st-/.test(v||'');
const VM=v=>isST(v)?STV:PIP;
const engVoice=v=>isST(v)?v.slice(3):v;   /* the name the worker knows the voice by */
function pipWorker(M){
  M=M||PIP;
  if(M.w) return M.w;
  const w=new Worker(M.file,{type:'module'});
  w.onmessage=e=>{
    const m=e.data;
    if(m.type==='progress'){ const f=m.p.file||''; if(f.startsWith('http') && m.p.total){ M.prog[f]=[m.p.loaded||0,m.p.total]; if(M.onprog) M.onprog(progPct(M.prog)); } }
    else if(m.type==='ready'){ const v=M.lvoice; M.ready=v; LS.set('pipReady.'+v,true); const r=M.lres; M.loading=null; M.lres=M.lrej=null; r&&r(); }
    else if(m.type==='loaderror'){ const r=M.lrej; pipReset(M); r&&r(new Error(m.msg)); }
    else if(m.id!=null){ const c=M.cb.get(m.id); if(!c) return; M.cb.delete(m.id); if(m.type==='error') c.rej(new Error(m.msg)); else c.res(m); }
  };
  w.onerror=e=>{ const r=M.lrej; pipReset(M); r&&r(new Error(e.message||'The voice couldn’t start on this device.')); };
  M.w=w; return w;
}
function pipReset(M){ M=M||PIP; try{ M.w&&M.w.terminate(); }catch(e){} M.w=null; M.ready=null; M.loading=null; M.lres=M.lrej=null; for(const c of M.cb.values()) c.rej(new Error('stopped')); M.cb.clear(); }
function pipLoad(voice, onprog){
  const M=VM(voice);
  M.onprog=onprog||null;
  if(M.ready===voice) return Promise.resolve();
  if(M.loading && M.lvoice===voice) return M.loading;
  M.prog={}; M.lvoice=voice; M.ready=null;
  M.loading=new Promise((res,rej)=>{ M.lres=res; M.lrej=rej; }); M.loading.catch(()=>{});
  try{ pipWorker(M).postMessage({type:'load', voice:engVoice(voice)}); }catch(e){ const r=M.lrej; pipReset(M); r&&r(e); }
  return M.loading;
}
function pipCall(msg){ const M=VM(msg.voice); return new Promise((res,rej)=>{ const id=++M.id; M.cb.set(id,{res,rej}); pipWorker(M).postMessage(Object.assign({id},msg,{voice:engVoice(msg.voice)})); }); }
async function pipDownloaded(voice){
  if(LS.get('pipReady.'+voice,false)) return true;
  try{ const root=await navigator.storage.getDirectory();
    if(isST(voice)){ const dir=await root.getDirectoryHandle('supertonic-w8'); await dir.getFileHandle('onnx__vocoder.onnx'); await dir.getFileHandle('voice_styles__'+engVoice(voice)+'.json'); return true; }
    const dir=await root.getDirectoryHandle('piper'); await dir.getFileHandle(voice+'.onnx'); return true; }catch(e){ return false; }
}
function stClearReady(){ try{ for(let k=localStorage.length-1;k>=0;k--){ const key=localStorage.key(k); if(key && key.startsWith('rf.pipReady.st-')) localStorage.removeItem(key); } }catch(e){} }
/* the first Supertonic copy (Nov 13) came out garbled; forget it once so the new one downloads with progress showing */
if(!LS.get('stW8',false)){ stClearReady(); LS.set('stW8',true); }
async function pipRemove(voice){
  /* close the voice first so its file isn't in use, then delete it here (Safari doesn't support the library's own delete) */
  if(isST(voice)){
    /* Supertonic voices share one model, so removing the download removes the model and every Supertonic voice */
    pipReset(STV);
    try{ const root=await navigator.storage.getDirectory(); for(const d of ['supertonic','supertonic-w8']) try{ await root.removeEntry(d,{recursive:true}); }catch(e){} }catch(e){}
    stClearReady(); return;
  }
  if(PIP.ready===voice || PIP.lvoice===voice) pipReset(PIP);
  try{ const root=await navigator.storage.getDirectory(); const dir=await root.getDirectoryHandle('piper');
    for(const name of [voice+'.onnx', voice+'.onnx.json']){ try{ await dir.removeEntry(name); }catch(e){} } }catch(e){}
  LS.set('pipReady.'+voice,false);
}
function wavInfo(buf){ const v=new DataView(buf); const sr=v.getUint32(24,true)||22050; return {sr, dur:Math.max(0,(buf.byteLength-44)/2/sr)}; }
function progPct(prog){ let a=0,t=0; for(const k in prog){ a+=prog[k][0]; t+=prog[k][1]; } return t? {pct:Math.min(100,Math.round(100*a/t)), a, t} : {pct:0,a:0,t:0}; }

const natSize=()=> isST(pipVoice())? 'about 100 MB, shared by all Supertonic voices' : 'about 60 MB';
const natReady=()=> VM(pipVoice()).ready===pipVoice();
async function natDownloaded(){ return pipDownloaded(pipVoice()); }
function natLoad(prog){ return pipLoad(pipVoice(), prog); }
async function natGen(text, padMs){
  const rate=natRate();
  const r=await pipCall({type:'gen', text, voice:pipVoice(), rate});
  const t=wavTrimPad(r.wav, (padMs||0)/rate);
  return {url:URL.createObjectURL(new Blob([t.buf],{type:'audio/wav'})), dur:t.dur, sdur:t.sdur, ms:r.ms, raw:wavInfo(r.wav).dur, rate};
}
const natRate=()=> S.ttsRate||1;   /* speed is given to the voice when it makes the speech (Nov 13), so its timing stays natural */
/* pauses between stretches at normal speed (ms); the voice's own silence at each end is trimmed off first, so every gap is exact */
const NAT_PAUSE={sent:350, clause:180, cap:120, para:700, headBefore:1100, headAfter:800};
function natPauseFor(c){
  if(c.ends==='block'){ return c.pauseAfter>=1100? NAT_PAUSE.headBefore : c.pauseAfter>=700? NAT_PAUSE.headAfter : NAT_PAUSE.para; }
  return NAT_PAUSE[c.ends]||NAT_PAUSE.sent;
}
/* cut the silence the voice leaves at the start and end, then add our own pause at the end (16-bit mono WAV) */
function wavTrimPad(buf, padMs){
  const v=new DataView(buf); const sr=v.getUint32(24,true)||22050;
  const n=Math.floor((buf.byteLength-44)/2), x=new Int16Array(buf,44,n), th=400;
  let a=0; while(a<n && Math.abs(x[a])<th) a++;
  let b=n-1; while(b>a && Math.abs(x[b])<th) b--;
  if(a>=b){ a=0; b=n-1; }
  a=Math.max(0,a-Math.round(sr*0.03)); b=Math.min(n-1,b+Math.round(sr*0.06));
  const speech=b-a+1, pad=Math.round(sr*padMs/1000), out=new ArrayBuffer(44+(speech+pad)*2);
  new Uint8Array(out,0,44).set(new Uint8Array(buf,0,44));
  const o=new DataView(out); o.setUint32(4,36+(speech+pad)*2,true); o.setUint32(40,(speech+pad)*2,true);
  new Int16Array(out,44,speech).set(x.subarray(a,b+1));
  return {buf:out, sdur:speech/sr, dur:(speech+pad)/sr};
}
async function natRemove(){ await pipRemove(pipVoice()); }
/* removes every downloaded voice; returns how many */
async function natRemoveAll(){
  let n=0; try{ const root=await navigator.storage.getDirectory(); const dir=await root.getDirectoryHandle('piper'); for await (const [name] of dir.entries()) if(name.endsWith('.onnx')) n++; }catch(e){}
  try{ const root=await navigator.storage.getDirectory(); const dir=await root.getDirectoryHandle('supertonic-w8'); for await (const [name] of dir.entries()) if(name.startsWith('voice_styles__')) n++; }catch(e){}
  pipReset(PIP); pipReset(STV);
  try{ const root=await navigator.storage.getDirectory(); await root.removeEntry('piper',{recursive:true}); }catch(e){}
  try{ const root=await navigator.storage.getDirectory(); for(const d of ['supertonic','supertonic-w8']) try{ await root.removeEntry(d,{recursive:true}); }catch(e){} }catch(e){}
  try{ for(let k=localStorage.length-1;k>=0;k--){ const key=localStorage.key(k); if(key && key.startsWith('rf.pipReady.')) localStorage.removeItem(key); } }catch(e){}
  return n;
}

/* the "getting the voice ready" sheet, shown only while the model downloads or loads */
function natProgressUI(){
  let shown=false, last=-1;
  return p=>{
    if(!shown){ shown=true; openSheet('Getting the natural voice ready', `<p class="note" style="margin-top:0">Downloading the voice to this phone (${natSize()}). This happens once; after that it works offline.</p>
      <div class="goalbar"><i id="kokBar" style="width:0%"></i></div><p class="note" id="kokTxt">Starting…</p>
      <button class="btn block" type="button" data-act="bg">Keep going in the background</button>`, { bg:closeSheet }); }
    if(p.pct===last) return; last=p.pct;
    const bar=$('#kokBar'), t=$('#kokTxt'); if(bar) bar.style.width=p.pct+'%';
    if(t) t.textContent= p.t ? `${p.pct}% · ${fmtBytes(p.a)} of ${fmtBytes(p.t)}` : 'Starting…';
  };
}
/* ready the model: shows progress only if it has to download */
async function natEnsure(){
  if(natReady()) return true;
  const had=await natDownloaded();
  /* in the Reading options panel, show the download right there; elsewhere use a small sheet */
  const inline=!!$('#kokState') && $('#kokState').offsetParent!==null;
  let ui=null; const prog=p=>{ if(had) return; if(inline){ const el=$('#kokState'); if(el) el.innerHTML=`Downloading the voice (${natSize()})… ${p.t?p.pct+'% · '+fmtBytes(p.a)+' of '+fmtBytes(p.t):''}<div class="goalbar"><i style="width:${p.pct}%"></i></div>`; return; } if(!ui) ui=natProgressUI(); ui(p); };
  if(had) toast('Starting the natural voice…');
  try{ await natLoad(prog); if(ui && $('#kokBar')) closeSheet(); if(inline) natStateUI(); return true; }
  catch(e){ if(ui && $('#kokBar')) closeSheet();
    toast('The natural voice couldn’t load ('+String(e.message||e).replace(/\.+$/,'')+'). Check your connection and try again.', null, 7000); return false; }
}
/* chunks: one or two sentences, with each word's share of the audio by length (plus a little for pauses) */
/* one sentence at a time (a long one is cut at a comma or dash), so every pause between sentences is the same */
function natChunkAt(i){ return speechChunk(i,40,1); }
function natFill(seq){
  while(TTS.on && seq===TTS.seq && TTS.kq.length<4 && TTS.knext<R.n){
    const c=natChunkAt(TTS.knext); TTS.knext=c.j; if(c.j<=c.i) break;
    c.p= !c.text ? Promise.resolve(c) : natGen(c.text, natPauseFor(c)).then(r=>{ c.url=r.url; c.dur=r.dur; c.sdur=r.sdur; return c; });
    c.p.catch(()=>{});
    TTS.kq.push(c);
  }
}
/* after a speed change, remake the sentences already prepared at the old speed (the one playing finishes as it is) */
function natRateChanged(){
  clearTimeout(NAT.rt);
  NAT.rt=setTimeout(()=>{
    if(!TTS.on || !TTS.nat) return;
    if(TTS.ab){ if(NAT.audio){ NAT.audio.preservesPitch=true; NAT.audio.defaultPlaybackRate=NAT.audio.playbackRate=natRate(); } return; }   /* saved audio: just play it faster */
    if(!TTS.kq) return;
    const rate=natRate(); if(!TTS.kq.length) return;
    const first=TTS.kq[0];
    for(const c of TTS.kq) if(c.url) URL.revokeObjectURL(c.url);
    TTS.kq=[]; TTS.knext=first.i;
    for(const M of [PIP,STV]) try{ M.w && M.w.postMessage({type:'cancel'}); }catch(e){}
    natFill(TTS.seq);
  },450);
}
function natClear(){
  clearInterval(TTS.kt); TTS.kt=0;
  for(const c of TTS.kq||[]) if(c.url) URL.revokeObjectURL(c.url);
  TTS.kq=[];
  for(const M of [PIP,STV]) try{ M.w && M.w.postMessage({type:'cancel'}); }catch(e){}
  const a=NAT.audio; if(a){ a.onended=null; try{ a.pause(); }catch(e){} }
}
function natSpeakFrom(i, seq){
  natClear();
  if(abPlayFrom(i, seq)) return;   /* this part of the book is downloaded: play the saved audio */
  TTS.ab=false; TTS.knext=i; natFill(seq); natPlayNext(seq);
}
/* lock-screen and headphone controls */
function natMedia(sub){
  if(!('mediaSession' in navigator) || !R.meta) return;
  try{
    const ch=currentChapter(R.pos);
    navigator.mediaSession.metadata=new MediaMetadata({title:(ch&&ch.t)||R.meta.title, artist:R.meta.author||'', album:R.meta.title});
    if(!NAT.msSet){ NAT.msSet=true;
      const h={play:()=>{ if(!TTS.on && TTS.mode) ttsPlayPause(); }, pause:()=>{ if(TTS.on) ttsPlayPause(); },
        previoustrack:()=>ttsSkip(-1), nexttrack:()=>ttsSkip(1), seekbackward:()=>ttsSkip(-1), seekforward:()=>ttsSkip(1)};
      for(const k in h) try{ navigator.mediaSession.setActionHandler(k,h[k]); }catch(e){}
    }
  }catch(e){}
}
async function natPlayNext(seq){
  if(!TTS.on || seq!==TTS.seq) return;
  const c=TTS.kq[0];
  if(!c){ ttsStop(); toast('Finished reading aloud'); return; }
  if(abPartAt(c.i)){ natSpeakFrom(c.i, seq); return; }   /* reached a downloaded part */
  if(!c.url && c.text) ttsMark(c.i);
  try{ await c.p; }catch(e){
    if(e.message==='cancelled' || e.message==='stopped'){ if(seq===TTS.seq && TTS.on && TTS.kq[0]!==c) natPlayNext(seq); return; }   /* replaced after a speed change */
    if(seq===TTS.seq && TTS.on){ ttsStop(); toast('The natural voice stopped: '+e.message); } return; }
  if(!TTS.on || seq!==TTS.seq) return;
  if(TTS.kq[0]!==c){ if(c.url) URL.revokeObjectURL(c.url); natPlayNext(seq); return; }
  TTS.kq.shift(); natFill(seq);
  if(!c.url){ natPlayNext(seq); return; }
  const a=natAudio(); a.src=c.url; a.defaultPlaybackRate=a.playbackRate=1; ttsMark(c.i); natMedia();
  clearInterval(TTS.kt);
  TTS.kt=setInterval(()=>{
    if(seq!==TTS.seq){ clearInterval(TTS.kt); return; }
    const f=c.sdur? Math.min(1,a.currentTime/c.sdur) : a.duration? a.currentTime/a.duration : 0;   /* the pause at the end isn't speech */ let k=0; while(k+1<c.cum.length && c.cum[k+1]<=f) k++;
    if(R.wf && (R.wf[c.i+k]&F_N)) return;
    if(c.i+k!==TTS.cur) ttsMark(c.i+k);
  },100);
  a.onended=()=>{ clearInterval(TTS.kt); URL.revokeObjectURL(c.url); if(seq===TTS.seq && TTS.on){ const ms=c.dur*1000; recordStats(Math.max(300,ms), c.j-c.i); ttsLearn(c.j-c.i, ms); natPlayNext(seq); } };
  try{ await a.play(); }catch(e){ if(seq===TTS.seq){ ttsStop(); toast('Couldn’t play the voice. Tap the speaker to try again.'); } }
}
async function natStart(){
  natUnlock(); /* must happen during the tap */
  const seq=TTS.seq;
  await abManifest();
  if(!abPartAt(R.pos) && !natReady()){ const ok=await natEnsure(); if(!ok){ if(TTS.on) ttsStop(); return; } }
  if(!TTS.on) return;
  TTS.seq++; natSpeakFrom(R.pos, TTS.seq);
}
/* sample: also reports how fast this phone makes speech */
async function natPreview(){
  natUnlock();
  if(!natReady() && !(await natEnsure())) return;
  const out=$('#kokSpeed'); if(out) out.textContent='Making a sample…';
  try{
    const r=await natGen('This is how your books will sound when Tooz reads them aloud.');
    const url=r.url, a=natAudio(); a.onended=()=>URL.revokeObjectURL(url); a.src=url; a.defaultPlaybackRate=a.playbackRate=1; a.play().catch(()=>{});
    const dur=r.raw, x=dur/(r.ms/1000);
    const el=$('#kokSpeed'); if(el) el.textContent=`Made ${dur.toFixed(1)} seconds of speech in ${(r.ms/1000).toFixed(1)} seconds — ${x>=1.3?'fast enough for smooth reading.':x>=0.9?'just about fast enough; expect an occasional short pause.':'slower than real time on this phone, so there will be pauses between sentences.'}`;
  }catch(e){ const el=$('#kokSpeed'); if(el) el.textContent='Couldn’t make a sample: '+e.message; }
}
/* iPhone voices, without the duplicates: one entry per voice name (the same voice is often listed once per region) */
function systemVoices(lang){
  const vs=ttsVoices().filter(v=>(v.lang||'').toLowerCase().startsWith(lang));
  const want=(document.documentElement.lang||navigator.language||'en-US').toLowerCase();
  const by=new Map();
  for(const v of vs){
    const key=voiceLabel(v).replace(/\s*\([A-Z]{2}\)/,'').replace(/ · online$/,'').toLowerCase();
    const score=(v.lang||'').toLowerCase()===want?2:(v.localService!==false?1:0);
    const cur=by.get(key); if(!cur || score>cur.s || (v.voiceURI===S.ttsVoice)) by.set(key,{v,s:v.voiceURI===S.ttsVoice?9:score});
  }
  return [...by.values()].map(x=>x.v);
}
function voiceSectionHTML(lang){
  const e=S.ttsEngine==='system'?'system':'natural';
  const DESC={natural:'Natural-sounding voices that run on this phone. Each voice downloads once (about 60 MB), then works offline. Supertonic voices (by Supertone, OpenRAIL-M license) are a test: they share one larger download (about 100 MB).',
    system:'The voices your iPhone lets web apps use. They start instantly but sound more robotic.'};
  let h=`<div class="panel-sec"><div class="group">
    <div class="set"><div class="hd"><label>Voice type</label></div><div class="seg" data-set="ttsEngine" data-type="seg">
      <button type="button" data-v="natural" aria-pressed="${e==='natural'}">Natural</button><button type="button" data-v="system" aria-pressed="${e==='system'}">iPhone</button></div>
      <div class="desc">${DESC[e]}</div></div>
`;
  const prev=`<button class="btn" type="button" data-act="vprev" style="margin-top:8px">${ICON.speaker} Hear this voice</button>`;
  if(e==='natural'){
    h+=`<div class="set"><div class="hd"><label for="o_pvoice">Voice</label></div><select class="input" id="o_pvoice" data-set="pipVoice" data-type="text">${PIP_VOICES.map(([g,L])=>`<optgroup label="${g}">${L.map(([id,n,d])=>`<option value="${id}"${pipVoice()===id?' selected':''}>${n} — ${d}</option>`).join('')}</optgroup>`).join('')}</select>
      ${prev}<div class="desc" id="kokSpeed">The first sample also shows how quickly this phone can make speech.</div>
      <div class="desc" id="kokState"></div></div>`;
  } else {
    const vs=systemVoices(lang);
    const grp=[['Best quality',[]],['Standard',[]],['Novelty and older voices',[]]];
    for(const v of vs) grp[voiceTier(v)][1].push(v);
    for(const g of grp) g[1].sort((a,b)=>a.name.localeCompare(b.name));
    const opt=v=>`<option value="${esc(v.voiceURI)}"${v.voiceURI===S.ttsVoice?' selected':''}>${esc(voiceLabel(v).replace(/\s*\([A-Z]{2}\)$/,''))}</option>`;
    h+=`<div class="set"><div class="hd"><label for="o_voice">Voice</label></div><select class="input" id="o_voice" data-set="ttsVoice" data-type="text"><option value="">Default</option>${grp.filter(g=>g[1].length).map(([l,L])=>`<optgroup label="${l}">${L.map(opt).join('')}</optgroup>`).join('')}</select>
      ${prev}<div class="desc">iPhone only shares some of its voices with web apps, so voices you download in iPhone Settings may not appear here. For a more natural voice, choose <b>Natural</b> above.</div></div>`;
  }
  h+=`</div></div>`;
  return h;
}
async function natStateUI(){
  const el=$('#kokState'); if(!el) return;
  const have=natReady() || await natDownloaded();
  el.innerHTML= have ? `This voice is downloaded. <button class="linkbtn" type="button" data-act="kokdel">Remove download</button>` : `Not downloaded yet. It downloads the first time you play it (Wi-Fi recommended). <button class="linkbtn" type="button" data-act="kokget">Download now</button>`;
}
