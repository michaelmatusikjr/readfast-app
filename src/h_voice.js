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
  ['British',[['en_GB-jenny_dioco-medium','Jenny','female'],['en_GB-cori-medium','Cori','female'],['en_GB-alba-medium','Alba','female, Scottish'],['en_GB-alan-medium','Alan','male'],['en_GB-northern_english_male-medium','Northern','male']]]
];
const pipVoice=()=>S.pipVoice||'en_US-lessac-medium';
const PIP={w:null, ready:null, loading:null, lvoice:null, id:0, cb:new Map(), prog:{}, onprog:null};
function pipWorker(){
  if(PIP.w) return PIP.w;
  const w=new Worker('piper-worker.js',{type:'module'});
  w.onmessage=e=>{
    const m=e.data;
    if(m.type==='progress'){ const f=m.p.file||''; if(f.startsWith('http') && m.p.total){ PIP.prog[f]=[m.p.loaded||0,m.p.total]; if(PIP.onprog) PIP.onprog(progPct(PIP.prog)); } }
    else if(m.type==='ready'){ PIP.ready=m.voice; LS.set('pipReady.'+m.voice,true); const r=PIP.lres; PIP.loading=null; PIP.lres=PIP.lrej=null; r&&r(); }
    else if(m.type==='loaderror'){ const r=PIP.lrej; pipReset(); r&&r(new Error(m.msg)); }
    else if(m.id!=null){ const c=PIP.cb.get(m.id); if(!c) return; PIP.cb.delete(m.id); if(m.type==='error') c.rej(new Error(m.msg)); else c.res(m); }
  };
  w.onerror=e=>{ const r=PIP.lrej; pipReset(); r&&r(new Error(e.message||'The voice couldn’t start on this device.')); };
  PIP.w=w; return w;
}
function pipReset(){ try{ PIP.w&&PIP.w.terminate(); }catch(e){} PIP.w=null; PIP.ready=null; PIP.loading=null; PIP.lres=PIP.lrej=null; for(const c of PIP.cb.values()) c.rej(new Error('stopped')); PIP.cb.clear(); }
function pipLoad(voice, onprog){
  PIP.onprog=onprog||null;
  if(PIP.ready===voice) return Promise.resolve();
  if(PIP.loading && PIP.lvoice===voice) return PIP.loading;
  PIP.prog={}; PIP.lvoice=voice; PIP.ready=null;
  PIP.loading=new Promise((res,rej)=>{ PIP.lres=res; PIP.lrej=rej; }); PIP.loading.catch(()=>{});
  try{ pipWorker().postMessage({type:'load', voice}); }catch(e){ const r=PIP.lrej; pipReset(); r&&r(e); }
  return PIP.loading;
}
function pipCall(msg){ return new Promise((res,rej)=>{ const id=++PIP.id; PIP.cb.set(id,{res,rej}); pipWorker().postMessage(Object.assign({id},msg)); }); }
async function pipDownloaded(voice){
  if(LS.get('pipReady.'+voice,false)) return true;
  try{ const root=await navigator.storage.getDirectory(); const dir=await root.getDirectoryHandle('piper'); await dir.getFileHandle(voice+'.onnx'); return true; }catch(e){ return false; }
}
async function pipRemove(voice){
  try{ await pipCall({type:'remove', voice}); }catch(e){}
  LS.set('pipReady.'+voice,false); if(PIP.ready===voice) PIP.ready=null;
}
function wavInfo(buf){ const v=new DataView(buf); const sr=v.getUint32(24,true)||22050; return {sr, dur:Math.max(0,(buf.byteLength-44)/2/sr)}; }
function progPct(prog){ let a=0,t=0; for(const k in prog){ a+=prog[k][0]; t+=prog[k][1]; } return t? {pct:Math.min(100,Math.round(100*a/t)), a, t} : {pct:0,a:0,t:0}; }

const natSize=()=>'about 60 MB';
const natReady=()=> PIP.ready===pipVoice();
async function natDownloaded(){ return pipDownloaded(pipVoice()); }
function natLoad(prog){ return pipLoad(pipVoice(), prog); }
async function natGen(text){
  const r=await pipCall({type:'gen', text, voice:pipVoice()});
  const {dur}=wavInfo(r.wav); return {url:URL.createObjectURL(new Blob([r.wav],{type:'audio/wav'})), dur, ms:r.ms};
}
const natRate=()=> S.ttsRate||1;   /* speed is applied on playback, with the pitch kept */
async function natRemove(){ await pipRemove(pipVoice()); }
/* removes every downloaded voice; returns how many */
async function natRemoveAll(){
  let n=0; try{ const root=await navigator.storage.getDirectory(); const dir=await root.getDirectoryHandle('piper'); for await (const [name] of dir.entries()) if(name.endsWith('.onnx')) n++; }catch(e){}
  pipReset();
  try{ const root=await navigator.storage.getDirectory(); await root.removeEntry('piper',{recursive:true}); }catch(e){}
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
  const inline=!!$('#kokState') && !$('#sheet').hidden;
  let ui=null; const prog=p=>{ if(had) return; if(inline){ const el=$('#kokState'); if(el) el.innerHTML=`Downloading the voice (${natSize()})… ${p.t?p.pct+'% · '+fmtBytes(p.a)+' of '+fmtBytes(p.t):''}<div class="goalbar"><i style="width:${p.pct}%"></i></div>`; return; } if(!ui) ui=natProgressUI(); ui(p); };
  if(had) toast('Starting the natural voice…');
  try{ await natLoad(prog); if(ui && $('#kokBar')) closeSheet(); if(inline) natStateUI(); return true; }
  catch(e){ if(ui && $('#kokBar')) closeSheet();
    toast('The natural voice couldn’t load ('+String(e.message||e).replace(/\.+$/,'')+'). Check your connection and try again.', null, 7000); return false; }
}
/* chunks: one or two sentences, with each word's share of the audio by length (plus a little for pauses) */
function natChunkAt(i){
  let j=i, len=0; while(j<R.n && len<55){ j++; len++; if(len>=6 && isSentEnd(j-1)) break; }
  let text=''; const wt=[];
  for(let k=i;k<j;k++){
    if(R.wf && (R.wf[k]&F_N)){ wt.push(0); continue; }
    if(k>i && !glued(k)) text+=' ';
    const w=R.words[k]; text+=w;
    wt.push(w.replace(/[^\p{L}\p{N}]/gu,'').length+1 + (/[,;:—–]$/.test(w)?3:0) + (/[.!?]["”’)]*$/.test(w)?6:0));
  }
  const tot=wt.reduce((a,b)=>a+b,0)||1; let acc=0; const cum=wt.map(x=>{ const c=acc/tot; acc+=x; return c; });
  return {i,j,text:text.trim(),cum};
}
function natFill(seq){
  while(TTS.on && seq===TTS.seq && TTS.kq.length<3 && TTS.knext<R.n){
    const c=natChunkAt(TTS.knext); TTS.knext=c.j;
    c.p= !c.text ? Promise.resolve(c) : natGen(c.text).then(r=>{ c.url=r.url; c.dur=r.dur; return c; });
    c.p.catch(()=>{});
    TTS.kq.push(c);
  }
}
function natClear(){
  clearInterval(TTS.kt); TTS.kt=0;
  for(const c of TTS.kq||[]) if(c.url) URL.revokeObjectURL(c.url);
  TTS.kq=[];
  try{ PIP.w && PIP.w.postMessage({type:'cancel'}); }catch(e){}
  const a=NAT.audio; if(a){ a.onended=null; try{ a.pause(); }catch(e){} }
}
function natSpeakFrom(i, seq){
  natClear(); TTS.knext=i; natFill(seq); natPlayNext(seq);
}
async function natPlayNext(seq){
  if(!TTS.on || seq!==TTS.seq) return;
  const c=TTS.kq[0];
  if(!c){ ttsStop(); toast('Finished reading aloud'); return; }
  if(!c.url && c.text) ttsMark(c.i);
  try{ await c.p; }catch(e){ if(seq===TTS.seq && TTS.on && e.message!=='cancelled' && e.message!=='stopped'){ ttsStop(); toast('The natural voice stopped: '+e.message); } return; }
  if(!TTS.on || seq!==TTS.seq) return;
  TTS.kq.shift(); natFill(seq);
  if(!c.url){ natPlayNext(seq); return; }
  const a=natAudio(); a.src=c.url; a.preservesPitch=true; a.defaultPlaybackRate=a.playbackRate=natRate(); ttsMark(c.i);
  clearInterval(TTS.kt);
  TTS.kt=setInterval(()=>{
    if(seq!==TTS.seq){ clearInterval(TTS.kt); return; }
    const f=a.duration? a.currentTime/a.duration : 0; let k=0; while(k+1<c.cum.length && c.cum[k+1]<=f) k++;
    if(R.wf && (R.wf[c.i+k]&F_N)) return;
    if(c.i+k!==TTS.cur) ttsMark(c.i+k);
  },100);
  a.onended=()=>{ clearInterval(TTS.kt); URL.revokeObjectURL(c.url); if(seq===TTS.seq && TTS.on){ recordStats(Math.max(300,c.dur*1000/natRate()), c.j-c.i); natPlayNext(seq); } };
  try{ await a.play(); }catch(e){ if(seq===TTS.seq){ ttsStop(); toast('Couldn’t play the voice. Tap the speaker to try again.'); } }
}
async function natStart(){
  natUnlock(); /* must happen during the tap */
  const seq=TTS.seq;
  if(!natReady()){ const ok=await natEnsure(); if(!ok){ if(TTS.on) ttsStop(); return; } }
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
    const url=r.url, a=natAudio(); a.onended=()=>URL.revokeObjectURL(url); a.src=url; a.preservesPitch=true; a.defaultPlaybackRate=a.playbackRate=natRate(); a.play().catch(()=>{});
    const dur=r.dur/natRate(), x=dur/(r.ms/1000);
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
  const DESC={natural:'Natural-sounding voices that run on this phone. Each voice downloads once (about 60 MB), then works offline.',
    system:'The voices your iPhone lets web apps use. They start instantly but sound more robotic.'};
  let h=`<div class="panel-sec"><h3>Read aloud</h3><div class="group">
    <div class="set"><div class="hd"><label>Voice type</label></div><div class="seg" data-set="ttsEngine" data-type="seg">
      <button type="button" data-v="natural" aria-pressed="${e==='natural'}">Natural</button><button type="button" data-v="system" aria-pressed="${e==='system'}">iPhone</button></div>
      <div class="desc">${DESC[e]}</div></div>
    ${pRange('ttsRate','Speaking speed',0.5,2,0.05)}`;
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
  h+=`<div class="desc" style="padding:0 2px 6px">Tap the speaker at the bottom of the page for the audio controls.</div></div></div>`;
  return h;
}
async function natStateUI(){
  const el=$('#kokState'); if(!el) return;
  const have=natReady() || await natDownloaded();
  el.innerHTML= have ? `This voice is downloaded. <button class="linkbtn" type="button" data-act="kokdel">Remove download</button>` : `Not downloaded yet. It downloads the first time you play it (Wi-Fi recommended). <button class="linkbtn" type="button" data-act="kokget">Download now</button>`;
}
