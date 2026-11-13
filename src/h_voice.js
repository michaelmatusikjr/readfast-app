/* ---------- natural voice (Kokoro, runs on the phone) ----------
   The Kokoro voice model (Apache 2.0) is downloaded once from Hugging Face and kept on the device
   by the browser (Cache Storage: "transformers-cache" and "kokoro-voices"), so it works offline after that.
   Speech is made in a background worker so the page stays responsive; the next sentences are prepared
   while the current one plays. Audio plays through an <audio> element so it isn't silenced by the ring switch. */
const KOK_URL='https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const KOK_MODEL='onnx-community/Kokoro-82M-v1.0-ONNX';
const KOK_SIZE='about 90 MB';
const KOK_VOICES=[
  ['Best',[['af_heart','Heart','US · female'],['af_bella','Bella','US · female']]],
  ['Very good',[['af_nicole','Nicole','US · female, soft'],['bf_emma','Emma','UK · female'],['am_michael','Michael','US · male'],['am_fenrir','Fenrir','US · male'],['am_puck','Puck','US · male'],['af_aoede','Aoede','US · female'],['af_kore','Kore','US · female'],['af_sarah','Sarah','US · female']]],
  ['Good',[['bm_fable','Fable','UK · male'],['bm_george','George','UK · male'],['bf_isabella','Isabella','UK · female'],['af_alloy','Alloy','US · female'],['af_nova','Nova','US · female'],['af_sky','Sky','US · female']]]
];
const KOK={w:null, ready:false, loading:null, id:0, cb:new Map(), audio:null, prog:{}, onprog:null};
const KOK_WORKER=`
import { KokoroTTS } from '${KOK_URL}';
let tts=null, busy=false; const jobs=[];
const post=(m,t)=>self.postMessage(m,t||[]);
async function run(){
  if(busy) return; busy=true;
  while(jobs.length){
    const j=jobs.shift();
    try{ const t0=performance.now(); const a=await tts.generate(j.text,{voice:j.voice,speed:j.speed}); const d=a.audio;
      post({type:'audio',id:j.id,audio:d,sr:a.sampling_rate,ms:performance.now()-t0},[d.buffer]); }
    catch(err){ post({type:'error',id:j.id,msg:String(err&&err.message||err)}); }
  }
  busy=false;
}
self.onmessage=async e=>{
  const m=e.data;
  if(m.type==='load'){
    try{
      if(!tts) tts=await KokoroTTS.from_pretrained('${KOK_MODEL}',{dtype:'q8',device:'wasm',
        progress_callback:p=>post({type:'progress',p:{status:p.status,file:p.file,loaded:p.loaded,total:p.total}})});
      post({type:'ready'});
    }catch(err){ post({type:'loaderror',msg:String(err&&err.message||err)}); }
  } else if(m.type==='gen'){ jobs.push(m); run(); }
  else if(m.type==='cancel'){ for(let k=jobs.length-1;k>=0;k--){ const j=jobs[k]; jobs.splice(k,1); post({type:'error',id:j.id,msg:'cancelled'}); } }
};`;
function kokWorker(){
  if(KOK.w) return KOK.w;
  const w=new Worker(URL.createObjectURL(new Blob([KOK_WORKER],{type:'text/javascript'})),{type:'module'});
  w.onmessage=e=>{
    const m=e.data;
    if(m.type==='progress'){ if(m.p.file&&m.p.total){ KOK.prog[m.p.file]=[m.p.loaded||0,m.p.total]; } if(KOK.onprog) KOK.onprog(kokPct()); }
    else if(m.type==='ready'){ KOK.ready=true; LS.set('kokReady',true); const r=KOK.lres; KOK.lres=KOK.lrej=null; r&&r(); }
    else if(m.type==='loaderror'){ const r=KOK.lrej; kokReset(); r&&r(new Error(m.msg)); }
    else if(m.id!=null){ const c=KOK.cb.get(m.id); if(!c) return; KOK.cb.delete(m.id); if(m.type==='error') c.rej(new Error(m.msg)); else c.res(m); }
  };
  w.onerror=e=>{ const r=KOK.lrej; kokReset(); r&&r(new Error(e.message||'The voice couldn’t start on this device.')); };
  KOK.w=w; return w;
}
function kokReset(){ try{ KOK.w&&KOK.w.terminate(); }catch(e){} KOK.w=null; KOK.ready=false; KOK.loading=null; KOK.lres=KOK.lrej=null; for(const c of KOK.cb.values()) c.rej(new Error('stopped')); KOK.cb.clear(); }
function kokPct(){ let a=0,t=0; for(const k in KOK.prog){ a+=KOK.prog[k][0]; t+=KOK.prog[k][1]; } return t? {pct:Math.min(100,Math.round(100*a/t)), a, t} : {pct:0,a:0,t:0}; }
function kokLoad(onprog){
  KOK.onprog=onprog||null;
  if(KOK.ready) return Promise.resolve();
  if(KOK.loading) return KOK.loading;
  KOK.prog={};
  KOK.loading=new Promise((res,rej)=>{ KOK.lres=res; KOK.lrej=rej; });
  KOK.loading.catch(()=>{});
  try{ kokWorker().postMessage({type:'load'}); }catch(e){ const r=KOK.lrej; kokReset(); r&&r(e); }
  return KOK.loading;
}
function kokGen(text, voice, speed){
  return new Promise((res,rej)=>{ const id=++KOK.id; KOK.cb.set(id,{res,rej}); kokWorker().postMessage({type:'gen',id,text,voice,speed}); });
}
async function kokDownloaded(){
  if(LS.get('kokReady',false)) return true;
  try{ const c=await caches.open('transformers-cache'); const ks=await c.keys(); return ks.some(r=>r.url.includes('Kokoro-82M')&&r.url.includes('model_quantized')); }catch(e){ return false; }
}
async function kokRemove(){
  kokReset(); LS.set('kokReady',false);
  try{ const c=await caches.open('transformers-cache'); for(const r of await c.keys()) if(r.url.includes('Kokoro-82M')) await c.delete(r); }catch(e){}
  try{ await caches.delete('kokoro-voices'); }catch(e){}
}
/* one <audio> element, unlocked by the first tap so later sentences can play on their own */
const SILENT_WAV='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
function kokAudio(){
  if(!KOK.audio){ KOK.audio=new Audio(); KOK.audio.preload='auto'; KOK.audio.setAttribute('playsinline',''); }
  return KOK.audio;
}
function kokUnlock(){ const a=kokAudio(); try{ a.src=SILENT_WAV; const p=a.play(); p&&p.catch(()=>{}); }catch(e){} }
function wavURL(f32, sr){
  const n=f32.length, buf=new ArrayBuffer(44+n*2), v=new DataView(buf);
  const ws=(o,s)=>{ for(let k=0;k<s.length;k++) v.setUint8(o+k,s.charCodeAt(k)); };
  ws(0,'RIFF'); v.setUint32(4,36+n*2,true); ws(8,'WAVE'); ws(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); ws(36,'data'); v.setUint32(40,n*2,true);
  for(let k=0;k<n;k++){ const s=Math.max(-1,Math.min(1,f32[k])); v.setInt16(44+k*2, s<0?s*0x8000:s*0x7FFF, true); }
  return URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
}
/* the "getting the voice ready" sheet, shown only while the model downloads or loads */
function kokProgressUI(){
  let shown=false, last=-1;
  return p=>{
    if(!shown){ shown=true; openSheet('Getting the natural voice ready', `<p class="note" style="margin-top:0">Downloading the voice to this phone (${KOK_SIZE}). This happens once; after that it works offline.</p>
      <div class="goalbar"><i id="kokBar" style="width:0%"></i></div><p class="note" id="kokTxt">Starting…</p>
      <button class="btn block" type="button" data-act="bg">Keep going in the background</button>`, { bg:closeSheet }); }
    if(p.pct===last) return; last=p.pct;
    const bar=$('#kokBar'), t=$('#kokTxt'); if(bar) bar.style.width=p.pct+'%';
    if(t) t.textContent= p.t ? `${p.pct}% · ${fmtBytes(p.a)} of ${fmtBytes(p.t)}` : 'Starting…';
  };
}
/* ready the model: shows progress only if it has to download */
async function kokEnsure(){
  if(KOK.ready) return true;
  const had=await kokDownloaded();
  let ui=null; const prog=p=>{ if(!had && !ui) ui=kokProgressUI(); if(ui) ui(p); };
  if(had) toast('Starting the natural voice…');
  try{ await kokLoad(prog); if(ui && $('#kokBar')) closeSheet(); return true; }
  catch(e){ if(ui && $('#kokBar')) closeSheet(); toast('The natural voice couldn’t load ('+String(e.message||e).replace(/\.+$/,'')+'). Check your connection and try again.', null, 7000); return false; }
}
/* chunks: one or two sentences, with each word's share of the audio by length (plus a little for pauses) */
function kokChunkAt(i){
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
function kokFill(seq){
  while(TTS.on && seq===TTS.seq && TTS.kq.length<3 && TTS.knext<R.n){
    const c=kokChunkAt(TTS.knext); TTS.knext=c.j;
    c.p= !c.text ? Promise.resolve(c) : kokGen(c.text, S.kokVoice||'af_heart', S.ttsRate||1).then(r=>{ c.url=wavURL(r.audio,r.sr); c.dur=r.audio.length/r.sr; return c; });
    c.p.catch(()=>{});
    TTS.kq.push(c);
  }
}
function kokClear(){
  clearInterval(TTS.kt); TTS.kt=0;
  for(const c of TTS.kq||[]) if(c.url) URL.revokeObjectURL(c.url);
  TTS.kq=[];
  try{ KOK.w && KOK.w.postMessage({type:'cancel'}); }catch(e){}
  const a=KOK.audio; if(a){ a.onended=null; try{ a.pause(); }catch(e){} }
}
function kokSpeakFrom(i, seq){
  kokClear(); TTS.knext=i; kokFill(seq); kokPlayNext(seq);
}
async function kokPlayNext(seq){
  if(!TTS.on || seq!==TTS.seq) return;
  const c=TTS.kq[0];
  if(!c){ ttsStop(); toast('Finished reading aloud'); return; }
  if(!c.url && c.text) ttsMark(c.i);
  try{ await c.p; }catch(e){ if(seq===TTS.seq && TTS.on && e.message!=='cancelled' && e.message!=='stopped'){ ttsStop(); toast('The natural voice stopped: '+e.message); } return; }
  if(!TTS.on || seq!==TTS.seq) return;
  TTS.kq.shift(); kokFill(seq);
  if(!c.url){ kokPlayNext(seq); return; }
  const a=kokAudio(); a.src=c.url; ttsMark(c.i);
  clearInterval(TTS.kt);
  TTS.kt=setInterval(()=>{
    if(seq!==TTS.seq){ clearInterval(TTS.kt); return; }
    const f=a.duration? a.currentTime/a.duration : 0; let k=0; while(k+1<c.cum.length && c.cum[k+1]<=f) k++;
    if(R.wf && (R.wf[c.i+k]&F_N)) return;
    if(c.i+k!==TTS.cur) ttsMark(c.i+k);
  },100);
  a.onended=()=>{ clearInterval(TTS.kt); URL.revokeObjectURL(c.url); if(seq===TTS.seq && TTS.on){ recordStats(Math.max(300,c.dur*1000), c.j-c.i); kokPlayNext(seq); } };
  try{ await a.play(); }catch(e){ if(seq===TTS.seq){ ttsStop(); toast('Couldn’t play the voice. Tap the speaker to try again.'); } }
}
async function kokStart(){
  kokUnlock(); /* must happen during the tap */
  const seq=TTS.seq;
  if(!KOK.ready){ const ok=await kokEnsure(); if(!ok){ if(TTS.on) ttsStop(); return; } }
  if(!TTS.on) return;
  TTS.seq++; kokSpeakFrom(R.pos, TTS.seq);
}
/* sample: also reports how fast this phone makes speech */
async function kokPreview(){
  kokUnlock();
  if(!KOK.ready && !(await kokEnsure())) return;
  const out=$('#kokSpeed'); if(out) out.textContent='Making a sample…';
  try{
    const r=await kokGen('This is how your books will sound when Tooz reads them aloud.', S.kokVoice||'af_heart', S.ttsRate||1);
    const dur=r.audio.length/r.sr, url=wavURL(r.audio,r.sr), a=kokAudio(); a.onended=()=>URL.revokeObjectURL(url); a.src=url; a.play().catch(()=>{});
    const x=dur/(r.ms/1000);
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
  const nat=S.ttsEngine!=='system';
  let h=`<div class="panel-sec"><h3>Read aloud</h3><div class="group">
    <div class="set"><div class="hd"><label>Voice type</label></div><div class="seg" data-set="ttsEngine" data-type="seg">
      <button type="button" data-v="kokoro" aria-pressed="${nat}">Natural</button><button type="button" data-v="system" aria-pressed="${!nat}">iPhone</button></div>
      <div class="desc">${nat?`Natural voices run on this phone after a one-time download (${KOK_SIZE}). They sound much more like a person reading.`:'The voices your iPhone lets web apps use. They start instantly but sound more robotic.'}</div></div>
    ${pRange('ttsRate','Speaking speed',0.5,2,0.05)}`;
  if(nat){
    h+=`<div class="set"><div class="hd"><label for="o_kvoice">Voice</label></div><select class="input" id="o_kvoice" data-set="kokVoice" data-type="text">${KOK_VOICES.map(([g,L])=>`<optgroup label="${g}">${L.map(([id,n,d])=>`<option value="${id}"${(S.kokVoice||'af_heart')===id?' selected':''}>${n} — ${d}</option>`).join('')}</optgroup>`).join('')}</select>
      <button class="btn" type="button" data-act="vprev" style="margin-top:8px">${ICON.speaker} Hear this voice</button>
      <div class="desc" id="kokSpeed">The first sample also shows how quickly this phone can make speech.</div>
      <div class="desc" id="kokState"></div></div>`;
  } else {
    const vs=systemVoices(lang);
    const grp=[['Best quality',[]],['Standard',[]],['Novelty and older voices',[]]];
    for(const v of vs) grp[voiceTier(v)][1].push(v);
    for(const g of grp) g[1].sort((a,b)=>a.name.localeCompare(b.name));
    const opt=v=>`<option value="${esc(v.voiceURI)}"${v.voiceURI===S.ttsVoice?' selected':''}>${esc(voiceLabel(v).replace(/\s*\([A-Z]{2}\)$/,''))}</option>`;
    h+=`<div class="set"><div class="hd"><label for="o_voice">Voice</label></div><select class="input" id="o_voice" data-set="ttsVoice" data-type="text"><option value="">Default</option>${grp.filter(g=>g[1].length).map(([l,L])=>`<optgroup label="${l}">${L.map(opt).join('')}</optgroup>`).join('')}</select>
      <button class="btn" type="button" data-act="vprev" style="margin-top:8px">${ICON.speaker} Hear this voice</button>
      <div class="desc">iPhone only shares some of its voices with web apps, so voices you download in iPhone Settings may not appear here. For a more natural voice, choose <b>Natural</b> above.</div></div>`;
  }
  h+=`<div class="desc" style="padding:0 2px 6px">Tap the speaker at the bottom of the page to start.</div></div></div>`;
  return h;
}
async function kokStateUI(){
  const el=$('#kokState'); if(!el) return;
  const have=KOK.ready || await kokDownloaded();
  el.innerHTML= have ? `Downloaded to this phone. <button class="linkbtn" type="button" data-act="kokdel">Remove download</button>` : `Not downloaded yet. It downloads the first time you play it (Wi-Fi recommended). <button class="linkbtn" type="button" data-act="kokget">Download now</button>`;
}
