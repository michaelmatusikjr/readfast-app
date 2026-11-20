
/* ====================================================================
   Reader. One position (R.pos, a word index) is shared by every mode:
   Pages (paginated), Scroll (continuous, optional auto-scroll), Speed (one word at a time).
   ==================================================================== */
const R={ meta:null, text:null, words:[], ends:new Set(), n:0, pos:0, wf:null, blocks:[], notes:new Map(), breaks:new Set(), SEC:[], mode:null,
  playing:false, timer:null, t0:0, runWords:0, lastNav:true, wake:null, lastSave:0, imgUrls:[], imgList:[], imgAt:new Map(), imgBefore:new Map(), imgAfter:new Map(), imgEnd:[],
  bookFamily:null, backPos:null, chrome:true, sIdx:null, lastSearch:'' };
const el={ wl:$('#wl'), wp:$('#wp'), wr:$('#wr'), word:$('#word'), stage:$('#stage'), ctx:$('#context'), scrub:$('#scrub'), pos:$('#posLabel'), left:$('#leftLabel'), play:$('#playBtn') };
const pgView=$('#pagesView'), pgFlow=$('#pgFlow'), scView=$('#scrollView'), scFlow=$('#scFlow');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

/* ---------- speed-reading engine (one word at a time) ---------- */
/*@@OLD:885-910@@*/
/*@@OLD:912-1022@@*/
/*@@OLD:1023-1057@@*/
/*@@OLD:1058-1080@@*/
/*@@OLD:1082-1102@@*/
/*@@OLD:1104-1113@@*/
/* speed */
/*@@OLD:1124-1127@@*/

/* Quiet Speed: fade chrome while a word is playing; a tap or move brings it back. First tap on a control still works. */
function syncSpeedPlaying(){
  const on=!!(R.mode==='speed' && R.playing);
  const v=$('#v-reader'), sp=$('#speedView');
  if(v) v.classList.toggle('speed-playing', on);
  if(sp) sp.classList.toggle('speed-playing', on);
  if(R.mode==='speed'){
    const pt=$('#pauseTools'), h=$('#stageHint');
    if(pt) pt.style.visibility='';
    if(h) h.style.visibility='';
  }
  if(!on){
    if(v) v.classList.remove('speed-awake');
    if(sp) sp.classList.remove('speed-awake');
    clearTimeout(syncSpeedPlaying._t);
  }
}
function wakeSpeedChrome(){
  const v=$('#v-reader'); if(!v || !v.classList.contains('speed-playing')) return;
  v.classList.add('speed-awake');
  const sp=$('#speedView'); if(sp) sp.classList.add('speed-awake');
  clearTimeout(syncSpeedPlaying._t);
  syncSpeedPlaying._t=setTimeout(()=>{
    v.classList.remove('speed-awake');
    const sp2=$('#speedView'); if(sp2) sp2.classList.remove('speed-awake');
  }, 2500);
}
setPlayUI=(function(orig){ return function(){ orig(); syncSpeedPlaying(); }; })(setPlayUI);
{ const host=$('#v-reader'); if(host) for(const ev of ['pointerdown','touchstart','mousemove']) host.addEventListener(ev, wakeSpeedChrome, {passive:true}); }

/* after dragging the faded background text in Speed mode, rebuild it around the word under the guide line */
function speedBrowseRebuild(){
  if(!R.spans || R.winA==null) return; const line=$('#scrollLine'); if(!line) return;
  const y=line.getBoundingClientRect().top; let best=null, bd=1e9;
  for(const s of R.spans){ const r=s.getBoundingClientRect(); const d=Math.abs((r.top+r.bottom)/2-y); if(d<bd){ bd=d; best=s; } }
  if(!best) return; const w=+best.dataset.i;
  if(w>R.winA+150 && w<R.winB-150) return;
  const keep=R.pos; R.pos=w; buildScrollText(); R.pos=keep;
  const box=$('#scrollText'); box.querySelectorAll('.cur').forEach(x=>x.classList.remove('cur'));
  const c=(keep>=R.winA&&keep<R.winB)?R.spans[keep-R.winA]:null; if(c){ c.classList.add('cur'); } R.curSpan=c||null;
}
/* adaptive pacing: a little slower on long sentences and long or unusual words, a little faster on easy stretches */
let diffCache={s:-1,e:-1,f:1};
function difficulty(i){
  if(!S.adaptive || i<0 || i>=R.n) return 1;
  if(!(i>=diffCache.s && i<=diffCache.e)){
    const s=sentStart(i), e=sentEndIdx(i); const len=e-s+1;
    let chars=0; for(let k=s;k<=e;k++) chars+=R.words[k].replace(/[^\p{L}\p{N}]/gu,'').length;
    const avg=chars/Math.max(1,len);
    let f=1; if(len>30) f+=0.12; else if(len>20) f+=0.06; else if(len<8) f-=0.05;
    if(avg>5.6) f+=0.08; else if(avg<4.2) f-=0.07;
    diffCache={s,e,f};
  }
  const core=(R.words[i]||'').replace(/[^\p{L}\p{N}]/gu,'');
  let w=0; if(core.length>=12) w=0.2; else if(core.length>=9) w=0.08; else if(core.length<=3) w=-0.05;
  if(/\d/.test(core)) w+=0.1;
  return clamp(diffCache.f+w, 0.82, 1.35);
}

/* ---------- book structure helpers ---------- */
function blockAt(i){ const B=R.blocks; let lo=0, hi=B.length-1; while(lo<=hi){ const m=(lo+hi)>>1; if(B[m].e<=i) lo=m+1; else if(B[m].s>i) hi=m-1; else return m; } return Math.min(Math.max(0,lo),B.length-1); }
function secAt(i){ const A=R.SEC; let lo=0, hi=A.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(A[m][0]<=i) lo=m; else hi=m-1; } return lo; }
const MAXSEC=6000, TARGETSEC=3500, MINSEC=800;
function buildSections(){
  const n=R.n, B=R.blocks; const starts=new Set([0]);
  const snap=(i)=>B.length? B[blockAt(i)].s : i;
  for(const s of (R.text.secs||[])) if(s>0&&s<n) starts.add(snap(s));
  for(const c of (R.meta.chapters||[])) if((c.d||0)===0 && c.i>0 && c.i<n) starts.add(snap(c.i));
  const arr=[...starts].sort((a,b)=>a-b); const out=[];
  for(let k=0;k<arr.length;k++){
    let a=arr[k]; const b=k+1<arr.length?arr[k+1]:n; if(b<=a) continue;
    while(b-a>MAXSEC){ const bi=blockAt(a+TARGETSEC); let cut=B[bi].s; if(cut<=a+MINSEC) cut=B[bi].e; if(cut>=b||cut<=a) break; out.push([a,cut]); a=cut; }
    out.push([a,b]);
  }
  R.SEC=out.length?out:[[0,n]];
}
const glued=(k)=>!!(R.wf && (R.wf[k]&F_GLUE));
/* Speed mode and dashes: a dash standing alone joins the word before it; "this—that" shows as "this—" then "that"; both pause like a comma */
const DASH_TOK=/^(?:[—–]+|-{2,})['"”’»)\]]*$/;
const isDashTok=(k)=>DASH_TOK.test(R.words[k]||'');
function dashParts(k){
  const w=R.words[k]; if(!w || !/[^—–-](?:[—–]+|-{2,})[^—–-]/.test(w)) return null;
  const p=w.match(/.*?(?:[—–]+|-{2,})|.+$/g).filter(Boolean);
  if(p.length>1 && /^(?:[—–]+|-{2,})$/.test(p[0])){ p[1]=p[0]+p[1]; p.shift(); }
  return p.length>1? p : null;
}
function speedText(s,e,first){ let t=''; for(let k=s;k<=e&&k<R.n;k++){ if(k>s && !glued(k) && !isDashTok(k)) t+=' '; t+= (k===s&&first!=null)? first : R.words[k]; } return t; }
/* hyphenated words get a little longer on screen */
function hyphenSlow(w){ const n=(w.match(/\p{L}-(?=\p{L})/gu)||[]).length; return n? Math.min(.8, .35+.15*(n-1)) : 0; }
function textOf(s,e){ let t=''; for(let k=s;k<=e&&k<R.n;k++){ if(k>s && !(R.wf && (R.wf[k]&F_GLUE))) t+=' '; t+=R.words[k]; } return t.replace(/(?:[—–]|-{2,})$/,''); }   /* a highlight ends before a trailing dash */

/* ---------- rendering a section as book text ---------- */
function figHTML(idx){ const a=R.imgList[idx]; const src=R.imgUrls[a.f]; if(!src) return ''; return `<figure data-img="${idx}"><img src="${src}" alt="${esc(a.alt||'Illustration')}"></figure>`; }
function wsHTML(w){
  const m=w.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}][\p{L}\p{N}'’\-]*)([\s\S]*)$/u); if(!m) return esc(w);
  const core=m[2]; const k=core.length<=3?1:core.length<=5?2:Math.ceil(core.length*0.42);
  return esc(m[1])+'<b class="ws">'+esc(core.slice(0,k))+'</b>'+esc(core.slice(k)+m[3]);
}
function blockHTML(blk,s,e,cont){
  const t=blk.t; const tag=/^h[1-6]$/.test(t)?t:'p';
  let cls=(cont?'cont ':'')+(t==='li'?'bli':t==='pre'?'pre':t==='cap'?'cap':''); /* 'bli', not 'li': that class styles the app's menu rows */ if(blk.q) cls+=(cls?' ':'')+'bq'; if(blk.g) cls+=(cls?' ':'')+'gap'; if(blk.l && tag!=='p') cls+=(cls?' ':'')+'hl';
  let h='<'+tag+(cls?' class="'+cls+'"':'')+'>';
  const wf=R.wf, W=R.words, ws=S.wordStart && t!=='pre';
  for(let k=s;k<e;k++){
    const f=wf?(wf[k]|0):0; let c='';
    if(f){ if(f&F_I)c+=' i'; if(f&F_B)c+=' b'; if(f&F_C)c+=' c'; if(f&F_U)c+=' u'; if(f&F_N)c+=' n'; else { if(f&F_P)c+=' p'; if(f&F_S)c+=' s'; } }
    if(R.back && R.back.has(k) && !(f&F_N)) c+=' nb';
    const sp=(k<e-1 && !(wf && (wf[k+1]&F_GLUE)))?' ':'';
    /* a dash at the end of a word sits just outside the word, so a highlight can stop before it */
    const dm=(f&(F_C|F_N|F_P|F_S))?null:/^(.*[^—–\-\s])((?:[—–]|-{2,})["”’)\]]*)$/.exec(W[k]);
    const core=dm?dm[1]:W[k];
    h+=(c?'<w class="'+c.slice(1)+'">':'<w>')+(ws&&!(f&(F_C|F_N|F_P|F_S))?wsHTML(core):esc(core))+(dm?'':sp)+'</w>'+(dm?'<wd'+(c?' class="'+c.slice(1)+'"':'')+'>'+esc(dm[2])+sp+'</wd>':'');
  }
  return h+'</'+tag+'>';
}
/* ---------- Scroll mode: the "previously read" tear (Nov 16) ----------
   When the reader leaves (even briefly) in Scroll mode, the first word of the topmost line in view is saved; the text
   is then drawn torn apart just before it, with "Previously read" in the gap, and the gap is centred on return. */
let SEC_TEAR=false;   /* true while drawing Scroll mode's sections */
function tearEdge(seed, top){
  /* a ragged paper edge: page colour above (top page) or below (bottom page), with a strip of torn fibres along it */
  let x=seed*9301+49297; const rnd=()=>((x=(x*9301+49297)%233280)/233280);
  const N=72, pts=[]; let drift=0;
  for(let k=0;k<=N;k++){ drift+= (rnd()-0.5)*3; drift*=0.85; pts.push([k*400/N, 11+drift+Math.sin(k*0.3+seed)*2.4+(rnd()-0.5)*3.6]); }
  const line=(dy,j)=>pts.map(([px,py],k)=>`${k?'L':'M'}${px.toFixed(1)},${(top? py+dy+(rnd()-0.5)*j : 24-py-dy-(rnd()-0.5)*j).toFixed(1)}`).join(' ');
  const pg= top? `${line(0,0)} L400,0 L0,0 Z` : `${line(0,0)} L400,24 L0,24 Z`;
  const fib= top? `${line(4.2,2.6)} L400,0 L0,0 Z` : `${line(4.2,2.6)} L400,24 L0,24 Z`;
  return `<svg class="te ${top?'te-top':'te-bot'}" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path class="fib" d="${fib}"/><path class="pg" d="${pg}"/></svg>`;
}
function tearHTML(t){
  const up='<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 5v14M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return `<div class="tear" data-tear="${t}" role="note" aria-label="Previously read: everything above">${tearEdge(t%997+3,true)}<div class="tear-mid">${up}<span>Previously read</span>${up}</div>${tearEdge(t%991+7,false)}</div>`;
}
function sectionHTML(k){
  const [a,b]=R.SEC[k]; const B=R.blocks; let h='';
  const tear= SEC_TEAR && R.tear!=null && R.tear>=a && R.tear<b ? R.tear : -1;
  for(let bi=blockAt(a); bi<B.length && B[bi].s<b; bi++){
    const blk=B[bi]; if(blk.e<=a) continue;
    const bef=R.imgBefore.get(bi); if(bef && blk.s>=a) h+=bef.map(figHTML).join('');
    if(R.breaks.has(blk.s) && blk.s>a) h+='<hr class="brk">';
    const s0=Math.max(blk.s,a), e0=Math.min(blk.e,b);
    if(tear>=0 && tear===s0) h+=tearHTML(tear)+blockHTML(blk, s0, e0);
    else if(tear>s0 && tear<e0) h+=blockHTML(blk, s0, tear)+tearHTML(tear)+blockHTML(blk, tear, e0, true);   /* the paragraph carries on below the tear */
    else h+=blockHTML(blk, s0, e0);
    const aft=R.imgAfter.get(bi); if(aft && blk.e<=b) h+=aft.map(figHTML).join('');
  }
  if(b>=R.n && R.imgEnd.length) h+=R.imgEnd.map(figHTML).join('');
  return `<div class="sec" data-k="${k}">${h}</div>`;
}
async function decodeImgs(sec){
  const imgs=[...sec.getElementsByTagName('img')]; if(!imgs.length) return;
  await Promise.race([ Promise.all(imgs.map(im=>im.decode?im.decode().catch(()=>{}):Promise.resolve())), sleep(2500) ]);
}
/* builds section k and puts it in container; 'prepend' keeps the reader's place by adjusting scrollEl */
async function renderSec(container, k, where, scrollEl){
  const tmp=document.createElement('div'); SEC_TEAR=(container===scFlow); try{ tmp.innerHTML=sectionHTML(k); } finally{ SEC_TEAR=false; }
  const sec=tmp.firstElementChild;
  sec._k=k; sec._a=R.SEC[k][0]; sec._b=R.SEC[k][1]; sec._ws=sec.getElementsByTagName('w');
  decorate(sec);
  await decodeImgs(sec);
  if(where==='replace') container.replaceChildren(sec);
  else if(where==='append') container.appendChild(sec);
  else { const h0=scrollEl.scrollHeight, t0=scrollEl.scrollTop; container.insertBefore(sec, container.firstElementChild); scrollEl.scrollTop=t0+(scrollEl.scrollHeight-h0); }
  return sec;
}
function hostEl(){ return R.mode==='pages'?pgFlow : R.mode==='scroll'?scFlow : null; }
function wordEl(i){ const h=hostEl(); if(!h) return null; for(const sec of h.children){ if(i>=sec._a && i<sec._b) return sec._ws[i-sec._a]||null; } return null; }
function idxOf(node){ const w=node&&node.closest?node.closest('w'):null; if(!w) return null; const sec=w.closest('.sec'); if(!sec||!sec._ws) return null; const k=Array.prototype.indexOf.call(sec._ws, w); return k<0?null:sec._a+k; }
/* the dash shown after a word: highlighted only when the highlight carries on past it */
function dashOf(w){ const d=w&&w.nextElementSibling; return d&&d.tagName==='WD'?d:null; }
function decorate(sec){
  sec.querySelectorAll('w.hl1,w.hl2,w.hl3,w.hl4,w.hn,wd.hl1,wd.hl2,wd.hl3,wd.hl4,wd.hn,wd.tsel').forEach(x=>x.classList.remove('hl1','hl2','hl3','hl4','hn','tsel'));
  const a=sec._a, b=sec._b;
  for(const h of (R.meta.highlights||[])){
    if(h.e<a || h.s>=b) continue;
    for(let k=Math.max(h.s,a); k<=Math.min(h.e,b-1); k++){ const w=sec._ws[k-a]; if(w){ w.classList.add('hl'+h.c); if(h.note) w.classList.add('hn'); const d=k<h.e&&dashOf(w); if(d){ d.classList.add('hl'+h.c); if(h.note) d.classList.add('hn'); } } }
  }
  sec.querySelectorAll('w.tts,w.ttssent,w.ttspick').forEach(x=>x.classList.remove('tts','ttssent','ttspick'));
  if(TTS.on && TTS.sentA!=null){ for(let k=Math.max(TTS.sentA,a); k<=Math.min(TTS.sentB,b-1); k++){ const w=sec._ws[k-a]; if(w) w.classList.add('ttssent'); } }
  if(TTS.on && TTS.cur>=a && TTS.cur<b){ const w=sec._ws[TTS.cur-a]; if(w) w.classList.add('tts'); }
  if(TTS.pick!=null && TTS.pick>=a && TTS.pick<b){ const w=sec._ws[TTS.pick-a]; if(w) w.classList.add('ttspick'); }
  if(typeof TS!=='undefined' && TS.on) for(let k=Math.max(TS.a,a); k<=Math.min(TS.b,b-1); k++){ const w=sec._ws[k-a]; if(w){ w.classList.add('tsel'); const d=k<TS.b&&dashOf(w); if(d) d.classList.add('tsel'); } }
}
function redecorate(){ const h=hostEl(); if(h) for(const sec of h.children) if(sec._ws) decorate(sec); }

/* ---------- Pages mode ---------- */
const P={k:-1, page:0, pages:1, g:null, busy:false, rangeEnd:0};
function pgGeom(){
  const W=pgView.clientWidth, H=pgView.clientHeight; const mx=marginPx(W);
  const two=S.twoCol && W>H*1.1 && W>=640;
  /* the text block is centred; the Margins setting alone decides how wide it is */
  const gap= two ? Math.max(36, Math.round(mx*1.2)) : mx*2;
  const inner=Math.max(120, W-2*mx); const cw= two? (inner-gap)/2 : inner;
  return {W,H,mx,gap,inner,cw,two,colsPer:two?2:1,stride:inner+gap,left:Math.round((W-inner)/2)};
}
function pgApplyGeom(){
  const g=pgGeom(); P.g=g;
  const clip=$('#pgClip'); clip.style.left=g.left+'px'; clip.style.width=g.inner+'px';
  for(const f of [pgFlow, $('#pgMeasure')]){ f.style.width=g.inner+'px'; f.style.columnCount=g.two?'2':'1'; f.style.columnGap=g.gap+'px'; }
  document.documentElement.style.setProperty('--pageH', clip.clientHeight+'px');
  pcSync();
}
/* whole-book page numbers: each section's page count is measured in the background for the current
   text settings; sections not measured yet are estimated from the ones that are */
const PC={sig:'', counts:[], token:0, fontGen:0};
function pcSync(){
  if(!R.meta) return; /* the book closed while openDoc was still entering its mode (Back mid-open): nothing to count */
  const g=P.g; const sig=[R.meta.id,R.SEC.length,g.W,g.H,g.two,S.size,S.lineH,S.margin,S.para,S.justify,S.hyphen,S.boldText,S.wordStart,S.font,R.bookFamily,S.focus,PC.fontGen].join('|');
  if(sig===PC.sig && PC.counts.length===R.SEC.length) return;
  /* Keep the last measured counts as a fallback so bookPages().total does not
     drop to a rough estimate while pcRun remesures the new layout. */
  PC.prev=(PC.counts && PC.counts.length===R.SEC.length)?PC.counts.slice():null;
  PC.sig=sig; PC.counts=new Array(R.SEC.length).fill(0);
  if(P.k>=0 && P.pages) PC.counts[P.k]=P.pages;
  pcRun();
}
async function pcRun(){
  const tok=++PC.token; const m=$('#pgMeasure'); const g=P.g; const here=secAt(R.pos);
  await sleep(250);
  const order=[...R.SEC.keys()].sort((a,b)=>Math.abs(a-here)-Math.abs(b-here));
  let t=performance.now(), n=0;
  for(const k of order){
    if(tok!==PC.token || R.mode!=='pages') return;
    if(PC.counts[k]) continue;
    m.innerHTML=sectionHTML(k);
    const imgs=[...m.getElementsByTagName('img')];
    if(imgs.length){ await Promise.race([Promise.all(imgs.map(im=>im.decode?im.decode().catch(()=>{}):0)), sleep(800)]); if(tok!==PC.token || R.mode!=='pages') return; }
    const cols=Math.max(1,Math.round((m.scrollWidth+g.gap)/(g.cw+g.gap)));
    if(!PC.counts[k]) PC.counts[k]=Math.max(1,Math.ceil(cols/g.colsPer));
    if(performance.now()-t>10){ m.innerHTML=''; await sleep(40); t=performance.now(); if(++n%6===0 && tok===PC.token) updateChrome(); }
  }
  m.innerHTML='';
  if(tok===PC.token){
    if(P.k>=0 && P.pages) PC.counts[P.k]=P.pages;
    PC.prev=null;
    updateChrome();
  }
}
function bookPages(){
  const nOf=k=>PC.counts[k]||(PC.prev&&PC.prev[k])||0;
  let kw=0, kp=0;
  for(let k=0;k<R.SEC.length;k++) if(nOf(k)){ kw+=R.SEC[k][1]-R.SEC[k][0]; kp+=nOf(k); }
  const wpp=kp? kw/kp : 280; let before=0, total=0;
  for(let k=0;k<R.SEC.length;k++){ const n=nOf(k)||Math.max(1,Math.round((R.SEC[k][1]-R.SEC[k][0])/wpp)); if(k<P.k) before+=n; total+=n; }
  return {page:before+P.page+1, total};
}
function pgMeasure(){ const g=P.g; const cols=Math.max(1,Math.round((pgFlow.scrollWidth+g.gap)/(g.cw+g.gap))); const sec=pgFlow.firstElementChild; P.cols=sec?Math.min(cols, Math.max(1,sec.getClientRects().length)):cols; /* columns the text really fills */ P.pages=Math.max(1,Math.ceil(cols/g.colsPer)); if(P.k>=0) PC.counts[P.k]=P.pages; }
function pgPageOfEl(w){
  if(!w) return 0; const fr=pgFlow.getBoundingClientRect(); const rr=w.getClientRects(); const r=rr.length?rr[0]:w.getBoundingClientRect();
  return clamp(Math.floor((r.left-fr.left+2)/P.g.stride),0,P.pages-1); /* both rects move together, so the shift cancels out */
}
function pgFirstWord(page){
  const sec=pgFlow.firstElementChild; if(!sec||!sec._ws.length) return sec?sec._a:0;
  const ws=sec._ws; let lo=0, hi=ws.length-1, ans=ws.length-1;
  if(page<=0) return sec._a;
  while(lo<=hi){ const m=(lo+hi)>>1; if(pgPageOfEl(ws[m])>=page){ ans=m; hi=m-1; } else lo=m+1; }
  return sec._a+ans;
}
async function pgLoad(k){ pgClearPin();

  pgFlow.style.columnCount=P.g.two?'2':'1';
  await renderSec(pgFlow,k,'replace'); P.k=k; pgMeasure();
  /* in the two-page layout, a chapter that fills only one column is set across the full width instead of sitting on the left */
  if(P.g.two && P.cols===1) pgFlow.style.columnCount='1';
}
const pgShift=()=>0;
function pgClearPin(){ if(pgFlow) pgFlow.querySelectorAll('.ttspin-sp').forEach(el=>el.remove()); }
function pgPinWord(i){
  pgClearPin();
  const w=wordEl(i); if(!w) return;
  if(P.topWord===i) return;
  const sp=document.createElement('div');
  sp.className='ttspin-sp';
  sp.setAttribute('aria-hidden','true');
  w.parentNode.insertBefore(sp, w);
  pgMeasure();
  let p=pgPageOfEl(w); if(p==null) return;
  while(p>0 && pgFirstWord(p-1)===i) p--;
  pgSet(p, false);
}
function pgSet(page, anim){
  P.page0=P.page; P.page=clamp(page,0,P.pages-1);
  const slide = anim && S.turn==='slide', from=P.page0;
  pgFlow.classList.toggle('anim-slide', slide);
  if(slide && from!=null && from!==P.page) pgEdge(P.page>from);
  pgFlow.style.transform=`translateX(${-P.page*P.g.stride+pgShift()}px)`;
  P.topWord = P.page>0 ? pgFirstWord(P.page) : (pgFlow.firstElementChild ? pgFlow.firstElementChild._a : R.pos);
  P.rangeEnd = P.page<P.pages-1 ? pgFirstWord(P.page+1) : (pgFlow.firstElementChild?pgFlow.firstElementChild._b:R.n);
}
async function pgShow(i, keepPos){
  const k=secAt(i);
  if(P.k!==k || !pgFlow.firstElementChild) await pgLoad(k);
  let w=wordEl(i); if(!w){ await new Promise(r=>requestAnimationFrame(r)); w=wordEl(i); }
  let p=pgPageOfEl(w); while(p>0 && pgFirstWord(p-1)===i) p--; /* a picture-only page belongs before its word */
  pgSet(p, false);
  if(!keepPos) R.pos=i; updateChrome();
}
/* the Style's soft edge shadow during a sliding page turn (CSS only shows it where the Style gives it a shade) */
let pgEdgeT=0;
function pgEdge(fwd){
  const c=$('#pgClip'); if(!c) return;
  c.classList.remove('turning'); c.classList.toggle('turn-back', !fwd); void c.offsetWidth; c.classList.add('turning');
  clearTimeout(pgEdgeT); pgEdgeT=setTimeout(()=>c.classList.remove('turning','turn-back'), 700);
}
/* with reduced motion a sliding page turn becomes a short fade */
const turnFades=()=>S.turn==='fade' || (S.turn==='slide' && reducedMotion());
async function pgFade(fn){
  if(S.turn==='none'){ await fn(); return; }
  pgFlow.classList.add('fade'); await sleep(130); await fn(); pgFlow.classList.remove('fade');
}
async function pgTurn(d){
  if(P.busy || R.mode!=='pages') return; pgClearPin(); R.anchor=null;
  if(!TS.edge) selClear();
  if(d>0){
    if(P.page<P.pages-1){ if(turnFades()) await pgFade(()=>pgSet(P.page+1,false)); else pgSet(P.page+1,true); }
    else if(P.k<R.SEC.length-1){ P.busy=true; try{ await pgFade(async()=>{ await pgLoad(P.k+1); pgSet(0,false); }); } finally{ P.busy=false; } }
    else { R.meta.finished=true; saveProgress(true); toast('You’ve reached the end of “'+R.meta.title+'”'); return; }
  } else {
    if(P.page>0){ if(turnFades()) await pgFade(()=>pgSet(P.page-1,false)); else pgSet(P.page-1,true); }
    else if(P.k>0){ P.busy=true; try{ await pgFade(async()=>{ await pgLoad(P.k-1); pgSet(P.pages-1,false); }); } finally{ P.busy=false; } }
    else return;
  }
  R.pos=pgFirstWord(P.page); afterMove(); if(S.focus && !hasSelection() && !TS.edge) setChrome(false);
  if(TTS.on) ttsRestart();
}
let pgPt=null;
pgView.addEventListener('pointerdown',e=>{ if(e.button>0) return; pgPt={x:e.clientX,y:e.clientY,t:performance.now()}; });
pgView.addEventListener('pointercancel',()=>{ pgPt=null; });
pgView.addEventListener('pointerup',e=>{
  const p=pgPt; pgPt=null; if(!p) return;
  const dx=e.clientX-p.x, dy=e.clientY-p.y, dt=performance.now()-p.t;
  if(hasSelection() || performance.now()-(TS.clearedAt||0)<600) return;
  if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.3 && dt<900){ pgTurn(dx<0?1:-1); return; }
  if(Math.abs(dx)<12 && Math.abs(dy)<12 && dt<450) readerTap(e);
});

/* ---------- Scroll mode (+ auto-scroll) ---------- */
const SC={busy:false, auto:false, wasAuto:false, raf:0, last:0, acc:0, pxps:0, mT:0, pauseUntil:0, t0:0, passed:new WeakSet(), ticking:false, lastSave:0, lastClock:0};
function scTopOf(w){ return w.getBoundingClientRect().top - scView.getBoundingClientRect().top + scView.scrollTop; }
/* scShow places the anchor word this many px below the clip top; scPos samples at the same offset so open/close is a round trip. */
const SC_ANCHOR_PAD=10;
/* Extra padding at the end of the scroll flow so a short last screen can
   still place the anchor word SC_ANCHOR_PAD below the clip top. Used when
   the read-aloud pill shrinks the clip at max scroll. */
function scEndPad(){ return parseFloat(scFlow.style.paddingBottom)||0; }
function scSetEndPad(px){
  const n=Math.max(0, Math.round(px));
  scFlow.style.paddingBottom=n?n+'px':'';
}
function scPlaceAnchor(i){
  const w=wordEl(i); if(!w) return;
  const desired=Math.max(0, scTopOf(w)-SC_ANCHOR_PAD);
  const max=Math.max(0, scView.scrollHeight-scView.clientHeight);
  if(desired>max){
    scSetEndPad(scEndPad()+(desired-max)+2);
    scView.scrollTop=Math.max(0, scTopOf(w)-SC_ANCHOR_PAD);
  }else{
    if(scEndPad() && desired+8<max){
      scSetEndPad(0);
      const d2=Math.max(0, scTopOf(w)-SC_ANCHOR_PAD);
      const max2=Math.max(0, scView.scrollHeight-scView.clientHeight);
      if(d2>max2) scSetEndPad((d2-max2)+2);
    }
    scView.scrollTop=Math.max(0, scTopOf(w)-SC_ANCHOR_PAD);
  }
}
/* Place word i at the sample point without clearing existing end pad.
   Used when the read-aloud clip changes so firstVis can be restored after a reflow. */
function scKeepWord(i){
  const w=wordEl(i); if(!w || !scView) return;
  const desired=Math.max(0, scTopOf(w)-SC_ANCHOR_PAD);
  const max=Math.max(0, scView.scrollHeight-scView.clientHeight);
  if(desired>max) scSetEndPad(scEndPad()+(desired-max)+2);
  scView.scrollTop=Math.max(0, scTopOf(w)-SC_ANCHOR_PAD);
}

async function scShow(i, keepPos){
  SC.busy=true; SC.userScrolled=false; /* the place stays exactly on word i until the reader scrolls */
  try{
    scFlow.replaceChildren(); scSetEndPad(0); await renderSec(scFlow, secAt(i), 'append');
    const w=wordEl(i); scView.scrollTop=w?Math.max(0, scTopOf(w)-SC_ANCHOR_PAD):0;
  } finally{ SC.busy=false; }
  await scEnsure();
  scPlaceAnchor(i);
  if(R.tearCenter){ R.tearCenter=false; tearCenterNow(); await scEnsure(); tearCenterNow(); }
  if(!keepPos) R.pos=i; updateChrome();
}
/* put the middle of the tear in the middle of the screen */
function tearCenterNow(){
  const t=scFlow.querySelector('.tear'); if(!t) return;
  const r=t.getBoundingClientRect(), v=scView.getBoundingClientRect();
  scView.scrollTop+= (r.top+r.height/2)-(v.top+v.height/2);
}
/* leaving the book or the app: the first line in view is where reading picks up, so the tear goes just before it */
function tearMark(){
  if(R.mode!=='scroll' || !R.meta || scView.hidden) return;
  if(TTS.on) return;   /* reading aloud carries on in the background; the place moves by itself */
  const v=scView.getBoundingClientRect(), old=scFlow.querySelector('.tear');
  if(old){ const r=old.getBoundingClientRect(); if(r.bottom>v.top+8 && r.top<v.bottom-8){ R.tearShow=true; return; } }   /* still on screen: it stays put */
  const t=scPos();
  if(t>0 && t<R.n){ R.tear=t; LS.set('tear.'+R.meta.id, t); R.tearShow=true; }
}
function tearShowOnReturn(){
  if(!R.tearShow) return; R.tearShow=false;
  if(R.mode!=='scroll' || !R.meta || R.tear==null || TTS.on || SC.auto) return;
  R.tearCenter=true; scShow(R.tear);
}
async function scEnsure(){
  if(SC.busy) return; SC.busy=true;
  try{
    const vh=scView.clientHeight||600;
    for(let guard=0; guard<4; guard++){
      const first=scFlow.firstElementChild, last=scFlow.lastElementChild; if(!first) break;
      if(scView.scrollTop+vh*2.5>scView.scrollHeight && last._k<R.SEC.length-1){ await renderSec(scFlow,last._k+1,'append'); continue; }
      if(scView.scrollTop<vh*1.5 && first._k>0){ await renderSec(scFlow,first._k-1,'prepend',scView); continue; }
      break;
    }
    while(scFlow.children.length>5){
      const cur=secAt(R.pos), first=scFlow.firstElementChild, last=scFlow.lastElementChild;
      if(cur-first._k > last._k-cur){ const h0=scView.scrollHeight, t0=scView.scrollTop; first.remove(); scView.scrollTop=t0-(h0-scView.scrollHeight); }
      else last.remove();
    }
  } finally{ SC.busy=false; }
}
/* the word at a given screen height */
function wordAtY(y){
  for(const sec of scFlow.children){
    const r=sec.getBoundingClientRect(); if(r.bottom<y) continue;
    const ws=sec._ws; if(!ws.length) return sec._a;
    let lo=0, hi=ws.length-1, ans=hi;
    while(lo<=hi){ const m=(lo+hi)>>1; const rr=ws[m].getBoundingClientRect(); if(rr.bottom>y){ ans=m; hi=m-1; } else lo=m+1; }
    return sec._a+ans;
  }
  const last=scFlow.lastElementChild; return last?Math.max(last._a,last._b-1):R.pos;
}
function scPos(){ return wordAtY(scView.getBoundingClientRect().top+SC_ANCHOR_PAD+1); }
scView.addEventListener('scroll',()=>{
  if(SC.ticking || R.mode!=='scroll') return; SC.ticking=true;
  requestAnimationFrame(async()=>{
    SC.ticking=false; if(R.mode!=='scroll') return;
    if(!SC.busy) await scEnsure();
    /* only the reader's own scrolling (or auto-scroll) moves the place; text reflowing after a rotation or a settings change doesn't */
    if(SC.auto || (R.anchor==null && SC.userScrolled && (SC.touching || performance.now()-(SC.gestureAt||0)<2500))) R.pos=scPos();
    updateChrome();
    const now=performance.now();
    if(now-SC.lastSave>2500){ SC.lastSave=now; saveProgress(); }
    if(now-SC.lastClock>3000){ SC.lastClock=now; noteProgress(); }
    if(S.focus && !SC.auto && R.chrome && SC.userScrolled && !hasSelection() && performance.now()-(SC.stopT||0)>500) setChrome(false);
  });
},{passive:true});
let scPt=null;
scView.addEventListener('pointerdown',e=>{ SC.wasAuto=SC.auto; if(SC.auto) asStop(); scPt={x:e.clientX,y:e.clientY,t:performance.now()}; if(e.pointerType==='mouse'){ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; } });
scView.addEventListener('pointerup',e=>{
  const p=scPt; scPt=null; if(!p) return;
  if(hasSelection() || performance.now()-(TS.clearedAt||0)<600) return;
  if(Math.abs(e.clientX-p.x)<12 && Math.abs(e.clientY-p.y)<12 && performance.now()-p.t<450) readerTap(e);
});
scView.addEventListener('touchstart',()=>{ SC.touching=true; },{passive:true});
scView.addEventListener('touchmove',()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; },{passive:true});
scView.addEventListener('touchend',()=>{ SC.touching=false; if(SC.userScrolled) SC.gestureAt=performance.now(); },{passive:true});
scView.addEventListener('touchcancel',()=>{ SC.touching=false; },{passive:true});
scView.addEventListener('wheel',()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; },{passive:true});
scView.addEventListener('keydown',()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; });
function asUI(){
  const bar=$('#asBar'); bar.hidden=!(R.mode==='scroll' && S.autoScroll && !TTS.mode); $('#rAs').hidden=R.mode!=='scroll';
  $('#asPlay').innerHTML=SC.auto?ICON.pause:ICON.play; $('#asPlay').setAttribute('aria-label',SC.auto?'Pause auto-scroll':'Start auto-scroll');
  $('#asWpm').value=S.scrollWpm; $('#asLabel').innerHTML=`${S.scrollWpm} <small>wpm</small>`;
}
function asStart(){ R.anchor=null; if(TTS.mode) ttsModeOff();
  if(R.mode!=='scroll') return;
  selClear(); SC.auto=true; SC.t0=performance.now(); SC.last=SC.t0; SC.acc=0; SC.mT=0; SC.pauseUntil=0; SC.passed=new WeakSet();
  const lineY=asLineY(); scFlow.querySelectorAll('figure,h1,h2,h3,h4').forEach(x=>{ if(x.getBoundingClientRect().top<lineY+4) SC.passed.add(x); });
  resetClock(); requestWake(); asUI(); if(S.focus) setChrome(false);
  cancelAnimationFrame(SC.raf); SC.raf=requestAnimationFrame(asLoop);
}
function asStop(keepChrome){
  if(!SC.auto) return; SC.auto=false; SC.stopT=performance.now(); cancelAnimationFrame(SC.raf); releaseWake(); asUI(); noteProgress(); saveProgress(true);
  if(!keepChrome) setChrome(true);
}
function asLineY(){ const r=scView.getBoundingClientRect(); return r.top+r.height*0.33; }
function asLoop(now){
  if(!SC.auto) return;
  const dt=Math.min(0.1,(now-SC.last)/1000); SC.last=now;
  if(now-SC.mT>450) asMeasure(now);
  if(now>=SC.pauseUntil){
    SC.acc+=SC.pxps*dt; const whole=Math.floor(SC.acc);
    if(whole>=1){ const before=scView.scrollTop; scView.scrollTop=before+whole; SC.acc-=whole;
      if(scView.scrollTop===before && scFlow.lastElementChild && scFlow.lastElementChild._k>=R.SEC.length-1){ asStop(); toast('You’ve reached the end of “'+R.meta.title+'”'); R.meta.finished=true; saveProgress(true); return; } }
  }
  SC.raf=requestAnimationFrame(asLoop);
}
function asMeasure(now){
  SC.mT=now; const lineY=asLineY(); const i=wordAtY(lineY);
  const tops=[]; for(let k=Math.max(0,i-30); k<Math.min(R.n,i+30); k++){ const w=wordEl(k); if(w){ const r=w.getClientRects(); if(r.length) tops.push(r[0].top); } }
  let lines=0, prev=-1e9, first=null, lastT=null;
  tops.sort((a,b)=>a-b).forEach(t=>{ if(t-prev>4){ lines++; if(first===null) first=t; lastT=t; } prev=t; });
  const lh=parseFloat(getComputedStyle(scFlow).fontSize)*S.lineH;
  const lineH=lines>1? (lastT-first)/(lines-1) : lh;
  const wpl=tops.length/Math.max(1,lines);
  const pxPerWord=Math.max(1,Math.min(lineH, lineH/Math.max(1,wpl)));
  let wpm=S.scrollWpm;
  if(S.asRamp){ const s=(now-SC.t0)/1000; if(s<5) wpm*=0.6+0.4*s/5; }
  wpm/=difficulty(i);
  SC.pxps=wpm/60*pxPerWord;
  if(S.asPauses){
    for(const x of scFlow.querySelectorAll('figure,h1,h2,h3,h4')){
      if(SC.passed.has(x)) continue; const t=x.getBoundingClientRect().top;
      if(t<lineY){ SC.passed.add(x); if(t>lineY-scView.clientHeight*0.6) SC.pauseUntil=now+(x.tagName==='FIGURE'?3000:1800); }
    }
  }
}
$('#asPlay').onclick=()=>{ SC.auto?asStop():asStart(); };
$('#asWpm').addEventListener('input',e=>{ S.scrollWpm=+e.target.value; saveSettings(); asUI(); });
$('#asDown').onclick=()=>{ S.scrollWpm=clamp(S.scrollWpm-10,60,700); saveSettings(); asUI(); };
$('#asUp').onclick=()=>{ S.scrollWpm=clamp(S.scrollWpm+10,60,700); saveSettings(); asUI(); };

/* ---------- taps on the page ---------- */
function hasSelection(){ if(TS.on) return true; const s=getSelection(); return !!(s && !s.isCollapsed && s.toString().trim()); }
function readerTap(e){
  const t=e.target;
  /* A middle tap never closes the read-aloud pill; it only picks a word or toggles the bars. */
  if(TTS.mode){ const w=t.closest&&t.closest('w'); const i=w?idxOf(w):null; if(i!=null && !(R.wf && (R.wf[i]&F_N))){ ttsPickWord(i); return; } }
  const fig=t.closest&&t.closest('figure');
  if(fig){
    let mid=true;
    if(R.mode==='pages'){ const r=pgView.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width; mid = S.tapZones==='anywhere' ? false : (x>=0.27 && x<=0.73); if(S.tapZones==='anywhere' && x>=0.3 && x<=0.7 && (e.clientY-r.top)/r.height>0.25 && (e.clientY-r.top)/r.height<0.75) mid=true; }
    if(mid){ showImage(R.imgList[+fig.dataset.img]); return; }
  }
  const w=t.closest&&t.closest('w');
  if(w && w.classList.contains('nb')){ goTo(R.back.get(idxOf(w)), true); return; }
  if(w && w.classList.contains('n')){ openFootnote(idxOf(w)); return; }
  if(w && /\bhl[1-4]\b/.test(w.className)){ const h=hlAt(idxOf(w)); if(h){ openHlMenu(h); return; } }
  if(R.mode==='pages'){
    const r=pgView.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
    if(S.tapZones==='anywhere'){ if(y<0.12) toggleChrome(); else if(x<0.3) pgTurn(-1); else pgTurn(1); }
    else { if(x<0.27) pgTurn(-1); else if(x>0.73) pgTurn(1); else toggleChrome(); }
  } else if(R.mode==='scroll'){
    /* a tap pauses auto-scroll; after that taps only show or hide the controls. Play restarts it. */
    if(S.autoScroll){ if(SC.wasAuto) setChrome(true); else toggleChrome(); }
    else toggleChrome();
  }
}
/* picture viewer: the one place zooming is allowed. Pinch, double-tap or scroll-wheel to zoom, drag to move. */
function showImage(a){
  if(!a || $('#imgOverlay')) return;
  const ov=document.createElement('div'); ov.id='imgOverlay';
  ov.innerHTML=`<img src="${R.imgUrls[a.f]}" alt="${esc(a.alt||'Illustration')}" draggable="false"><button class="icon-btn" id="imgClose" type="button" aria-label="Close picture">${ICON.close}</button><div id="imgHint">Pinch or double-tap to zoom</div>`;
  const img=ov.firstElementChild; const opened=performance.now();
  let sc=1, tx=0, ty=0, st=null, moved=false, lastTap=0, tapT=null; const pts=new Map();
  const apply=(ease)=>{ img.classList.toggle('ease',!!ease); img.style.transform=`translate(${tx}px,${ty}px) scale(${sc})`; };
  const limit=()=>{ const mx=Math.max(0,(img.offsetWidth*sc-ov.clientWidth)/2), my=Math.max(0,(img.offsetHeight*sc-ov.clientHeight)/2); tx=clamp(tx,-mx,mx); ty=clamp(ty,-my,my); };
  const close=()=>{ clearTimeout(tapT); ov.remove(); };
  const begin=()=>{ const p=[...pts.values()]; st={sc,tx,ty, x:p[0].x, y:p[0].y, d:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0, mx:p.length>1?(p[0].x+p[1].x)/2:p[0].x, my:p.length>1?(p[0].y+p[1].y)/2:p[0].y}; };
  /* zoom so the point under the finger stays put */
  const zoomAt=(nsc,cx,cy)=>{ const ox=cx-ov.clientWidth/2, oy=cy-ov.clientHeight/2; const k=nsc/sc; tx=ox-(ox-tx)*k; ty=oy-(oy-ty)*k; sc=nsc; if(sc<=1.01){ sc=1; tx=0; ty=0; } limit(); };
  ov.addEventListener('pointerdown',e=>{ if(e.target.closest('#imgClose')) return; try{ ov.setPointerCapture(e.pointerId); }catch(_){} pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(pts.size===1) moved=false; else moved=true; begin(); });
  ov.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId)||!st) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); const p=[...pts.values()];
    if(p.length>=2){ const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y), mx=(p[0].x+p[1].x)/2, my=(p[0].y+p[1].y)/2; sc=st.sc; tx=st.tx+(mx-st.mx); ty=st.ty+(my-st.my); zoomAt(clamp(st.sc*d/Math.max(1,st.d),1,6), mx, my); moved=true; apply(); }
    else{ const dx=p[0].x-st.x, dy=p[0].y-st.y; if(Math.abs(dx)+Math.abs(dy)>8) moved=true; if(sc>1){ tx=st.tx+dx; ty=st.ty+dy; limit(); apply(); } }
  });
  const up=e=>{
    if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if(pts.size){ begin(); return; }
    st=null; if(moved || e.type==='pointercancel' || performance.now()-opened<420) return;
    const now=performance.now();
    if(now-lastTap<320){ clearTimeout(tapT); lastTap=0; if(sc>1){ sc=1; tx=0; ty=0; } else zoomAt(2.5, e.clientX, e.clientY); apply(true); }
    else{ lastTap=now; tapT=setTimeout(()=>{ if(sc===1) close(); },330); }
  };
  ov.addEventListener('pointerup',up); ov.addEventListener('pointercancel',up);
  ov.addEventListener('wheel',e=>{ e.preventDefault(); zoomAt(clamp(sc*(e.deltaY<0?1.15:0.87),1,6), e.clientX, e.clientY); apply(); },{passive:false});
  ov.querySelector('#imgClose').onclick=close;
  document.body.appendChild(ov);
}
/* everywhere else, pinch and double-tap zoom are off */
for(const t of ['gesturestart','gesturechange','gestureend']) document.addEventListener(t,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{ if(e.touches.length>1) e.preventDefault(); },{passive:false});

/* ---------- moving around ---------- */
function setChrome(on){
  if(R.mode==='speed') on=true; /* Speed keeps the top bar; quiet-Speed fades it while playing */
  const was=R.chrome;
  R.chrome=on;
  const v=$('#v-reader');
  v.classList.toggle('chrome-off',!on);
  for(const id of ['rTop','rFoot']){
    const el=$('#'+id); if(!el) continue;
    if(on) el.removeAttribute('inert'); else el.setAttribute('inert','');
  }
  const foot=$('#rFoot');
  if(foot) v.style.setProperty('--rfoot-h', Math.round(foot.getBoundingClientRect().height)+'px');
  /* Insets are fixed; toggling the overlay bars must not relayout or repaginate.
     Exception: with the read-aloud pill open, the reserved strip follows the pill (anchored on the first visible word). */
  if(TTS.mode && R.mode!=='speed') requestAnimationFrame(()=>ttsReserveSync());
  if(was && !on && R.mode && R.mode!=='speed') maybeHintBar();
}
function maybeHintBar(){
  if(LS.get('hintBar', false)) return;
  LS.set('hintBar', 1);
  const el=$('#barHint'); if(!el) return;
  el.hidden=false;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){
    el.style.opacity='0.7';
    setTimeout(()=>{ el.style.opacity=''; el.hidden=true; }, 900);
  } else {
    el.classList.add('on');
    let done=false;
    const hide=()=>{ if(done) return; done=true; el.classList.remove('on'); el.hidden=true; el.removeEventListener('animationend', hide); };
    el.addEventListener('animationend', hide);
    setTimeout(hide, 1600);
  }
}
function toggleChrome(){ setChrome(!R.chrome); }
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab') return;
  if($('#v-reader').hidden || R.chrome) return;
  if($('#sheet') && !$('#sheet').hidden) return;
  setChrome(true);
}, true);
function stopActivity(){ if(R.playing) pause(); if(SC.auto) asStop(true); if(TTS.on) ttsStop(); }
function setBack(prev){ if(prev==null) return; R.backPos=prev; $('#backPill').hidden=false; clearTimeout(R.backT); R.backT=setTimeout(()=>{ $('#backPill').hidden=true; }, 6000); }
$('#backGo').onclick=()=>{ const p=R.backPos; if(p==null) return; $('#backPill').hidden=true; R.backPos=null; goTo(p,'back'); };
$('#backX').onclick=()=>{ $('#backPill').hidden=true; R.backPos=null; };
/* Endnotes: the number in front of each note leads back to where it was cited.
   R.backTo: a link inside a note that points at its reference (the book's own back-link). R.back: a plain note number. */
function buildBacklinks(){
  R.back=new Map(); R.backTo=new Map();
  const norm=w=>String(w||'').replace(/[\[\]().:,]/g,'');
  /* only a link that points backwards (from the notes to the text) is a back-link; the note numbers in the text keep opening the note */
  for(const [ref,t] of R.notes){ if(t<ref && (R.notes.has(t) || (R.wf && (R.wf[t]&F_N)))) R.backTo.set(ref,t); }
  for(const [ref,t] of R.notes){
    if(R.backTo.has(ref) || t<=ref) continue;
    const num=norm(R.words[ref]); if(!num) continue;
    for(let k=t;k<Math.min(R.n,t+3);k++){ if(R.wf && (R.wf[k]&F_N)) break; if(norm(R.words[k])===num){ if(!R.back.has(k)) R.back.set(k,ref); break; } }
  }
}
async function goTo(i, jump){
  if(!R.meta || !R.mode) return;
  pendingRelay=false; clearTimeout(relayT);
  R.anchor=null;
  const prev=R.pos; stopActivity(); selClear();
  R.pos=clamp(i|0,0,R.n-1); R.lastNav=true;
  if(R.meta.finished&&R.pos<R.n-1) R.meta.finished=false;
  if(jump && jump!=='back' && Math.abs(prev-R.pos)>30) setBack(prev);
  if(jump) setChrome(true);
  await MODES[R.mode].show(R.pos);
  saveProgress(true); resetClock(); updateChrome();
}
function afterMove(){ const now=performance.now(); if(now-R.lastSave>1500) saveProgress(); noteProgress(); updateChrome(); }
const MODES={
  pages:{
    async enter(){ pgView.hidden=false; pgApplyGeom(); P.k=-1; await pgShow(R.pos); },
    leave(){ PC.token++; $('#pgMeasure').innerHTML=''; pgView.hidden=true; pgFlow.replaceChildren(); P.k=-1; },
    show:(i)=>pgShow(i),
    async relayout(){ /* keep the top-left word until a page is turned, so repeated changes never drift */ if(R.anchor==null) R.anchor=(P.topWord!=null && P.k>=0)? P.topWord : R.pos; const i=R.anchor; pgApplyGeom(); P.k=-1; await pgShow(i, true); if(P.topWord!==i) pgPinWord(i); }
  },
  scroll:{
    async enter(){ scView.hidden=false; SC.userScrolled=false; asUI(); await scShow(R.pos); },
    leave(){ asStop(true); scView.hidden=true; scFlow.replaceChildren(); $('#asBar').hidden=true; },
    show:(i)=>scShow(i),
    async relayout(){ if(R.anchor==null) R.anchor=scPos(); await scShow(R.anchor, true); }
  },
  speed:{
    async enter(){ while(R.pos>0 && glued(R.pos)) R.pos--; $('#speedView').hidden=false; el.scrub.max=Math.max(1,R.n-1); setWpm(S.wpm); await new Promise(r=>requestAnimationFrame(r)); buildScrollText(); enableManualScroll(); showPaused(); positionLine(); syncScroll(true); },
    leave(){ if(R.playing) pause(); $('#speedView').hidden=true; $('#scrollText').innerHTML=''; R.spans=null; R.curSpan=null; R.winA=R.winB=null; },
    show(i){ while(i>0 && glued(i)) i--; R.pos=i; showPaused(); syncScroll(true); },
    relayout(){ showChunk(R.pos); positionLine(); syncScroll(true); }
  }
};
async function switchMode(m){
  if(!MODES[m]) m='pages'; R.anchor=null;
  if(m===R.mode) return;
  const keepTts=!!(TTS.mode && m!=='speed' && R.mode!=='speed');
  if(TTS.mode && !keepTts) ttsModeOff(true);
  if(R.playing) pause(); if(SC.auto) asStop(true); if(TTS.on && !keepTts) ttsStop();
  selClear();
  if(R.mode) MODES[R.mode].leave();
  R.mode=m; S.mode=m; saveSettings(); $('#rAs').hidden=m!=='scroll';
  $('#v-reader').dataset.mode=m; $('#v-reader').classList.toggle('overlay', !!S.focus && !TTS.mode); setChrome(true);
  await MODES[m].enter(); updateChrome(); resetClock();
  if(keepTts){
    if(TTS.on && TTS.cur>=0) ttsMark(TTS.cur);
    else if(TTS.pick!=null) ttsPickMark(TTS.pick);
    ttsBarUI();
  }
}
let relayT=null;
let pendingRelay=false;
function relayoutSoon(){ clearTimeout(relayT); relayT=setTimeout(async()=>{ if(!R.mode || $('#v-reader').hidden) return; if(hasSelection()){ holdPlace(); pendingRelay=true; return; } pendingRelay=false; pinApp(); applyLook(); try{ await MODES[R.mode].relayout(); if(R.mode==='pages') pgCheckAnchor(); }catch(e){ console.error(e); } updateChrome(); },140); }
/* after a rotation the page area can settle a moment later (the notch insets): if the anchor word isn't on screen, lay out once more */
function pgCheckAnchor(){ setTimeout(async()=>{ if(R.mode!=='pages' || R.anchor==null || $('#v-reader').hidden) return; const w=wordEl(R.anchor); if(!w) return; const c=$('#pgClip').getBoundingClientRect(), r=w.getBoundingClientRect(); if(r.left<c.left-2 || r.right>c.right+2){ pgApplyGeom(); P.k=-1; await pgShow(R.anchor, true); } }, 400); }
function firstVisibleWord(){ if(R.mode==='pages' && P.topWord!=null && P.k>=0) return P.topWord; if(R.mode==='scroll') return scPos(); return R.pos; }
function holdPlace(force){ if(!R.mode || !R.meta || R.mode==='speed') return; if(!force && R.anchor!=null) return; R.anchor=firstVisibleWord(); }
/* iPhone can leave the whole app scrolled up after a rotation, hiding the top bar */
function pinApp(){ if(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop){ window.scrollTo(0,0); document.documentElement.scrollTop=0; document.body.scrollTop=0; } }
window.addEventListener('resize', ()=>{ holdPlace(); pinApp(); relayoutSoon(); fitAaSheetForWord(); });
window.addEventListener('orientationchange', ()=>{ holdPlace(); relayoutSoon(); setTimeout(()=>{ pinApp(); relayoutSoon(); }, 500); });
window.addEventListener('scroll', pinApp, {passive:true});
try{ let rbSize=''; new ResizeObserver(()=>{ const rb=document.getElementById('rBody'); if(!rb) return; const k=rb.clientWidth+'x'+rb.clientHeight; if(k!==rbSize){ const prev=rbSize; rbSize=k; if(prev && !/^0x|x0$/.test(prev) && !/^0x|x0$/.test(k)){ holdPlace(); relayoutSoon(); } } }).observe(document.getElementById('rBody')); }catch(e){}
/* a font that finishes downloading changes line breaks, so lay the pages out again */
try{ document.fonts.addEventListener('loadingdone', ()=>{ PC.fontGen++; if(R.mode) relayoutSoon(); }); }catch(e){}
function fontsReady(ms){ try{ return Promise.race([document.fonts.ready, sleep(ms||1500)]); }catch(e){ return Promise.resolve(); } }

/* ---------- reading clock (time left, stats) ---------- */
const CLK={pos:0,t:0,saveT:0,lastAct:0,maxGap:0,touch:0};
function resetClock(){ CLK.pos=R.pos; CLK.t=performance.now(); CLK.lastAct=CLK.t; CLK.maxGap=0; }
/* any touch, key or scroll in a book is a sign you're reading; the longest quiet stretch decides how a page is counted */
function markActivity(){ const now=performance.now(); if(CLK.lastAct) CLK.maxGap=Math.max(CLK.maxGap, now-CLK.lastAct); CLK.lastAct=now; CLK.touch=now; }
const idleMs=()=>(S.idleMins||5)*60000;
const usualWpm=()=>S.measuredWpm||230;
/* Reading time for a stretch: never more than about twice what those words usually take you,
   and if you went quiet for longer than the idle limit, only the time they usually take. */
function creditFor(dt, dw, quiet){ const exp=dw/usualWpm()*60000; return quiet? Math.min(dt, exp) : Math.min(dt, exp*2); }
function noteProgress(){
  if(!R.meta || R.mode==='speed') return;
  if(TTS.on){ resetClock(); return; } /* read-aloud time is counted as each sentence finishes */
  const now=performance.now(), dw=R.pos-CLK.pos, dt=now-CLK.t;
  if(dw<=0){ if(dw<0) resetClock(); return; }
  if(dt<1200) return;
  if(dt>4*3600000 || dt/dw<40){ resetClock(); return; } /* left open for hours, or skimming */
  const quiet=Math.max(CLK.maxGap, now-CLK.lastAct)>idleMs();
  recordStats(creditFor(dt,dw,quiet), dw);
  const w=dw/(dt/60000);
  if(!quiet && !(R.mode==='scroll'&&SC.auto) && w>60 && w<1200){ S.measuredWpm=S.measuredWpm?Math.round(S.measuredWpm*0.85+w*0.15):Math.round(w); if(now-CLK.saveT>20000){ CLK.saveT=now; saveSettings(); } }
  resetClock();
}
function readWpm(){ return TTS.mode&&R.mode!=='speed'? ttsWpmNow() : R.mode==='speed'?S.wpm : (R.mode==='scroll'&&S.autoScroll)?S.scrollWpm : (S.measuredWpm||230); }
function chapterEnd(i){ const c=R.meta.chapters||[]; for(const ch of c){ if(ch.i>i) return ch.i; } return R.n; }
function infoText(){
  const wpm=readWpm(), pct=Math.round(100*R.pos/Math.max(1,R.n-1));
  if(S.info===1) return `${pct}% · ${fmtMins((R.n-R.pos)/wpm)} left in book`;
  if(S.info===2) return `Location ${(R.pos+1).toLocaleString()} of ${R.n.toLocaleString()}`;
  const left=fmtMins((chapterEnd(R.pos)-R.pos)/wpm)+' left in chapter';
  if(R.mode==='pages'){ const bp=bookPages(); return `Page ${bp.page} of ${bp.total} · ${left}`; }
  return `${pct}% · ${left}`;
}
let scrubbing=false;
function bookmarkHere(){
  const bm=R.meta.bookmarks||[]; let a=R.pos, b=R.pos+1;
  if(R.mode==='pages'){ a=pgFirstWord(P.page); b=P.rangeEnd; }
  else if(R.mode==='scroll'){ a=R.pos; b=wordAtY(scView.getBoundingClientRect().bottom-4)+1; }
  return bm.find(x=>x.i>=a && x.i<Math.max(b,a+1));
}
function updateChrome(){
  if(!R.meta) return;
  const ch=currentChapter(R.pos); $('#rSub').textContent=ch?ch.t:(KIND[R.meta.kind]||'');
  const foot=$('#rFoot'), vr=$('#v-reader');
  if(foot && vr) vr.style.setProperty('--rfoot-h', Math.round(foot.getBoundingClientRect().height)+'px');
  if(R.mode==='speed'||!R.mode) return;
  const sc=$('#rScrub'); sc.max=Math.max(1,R.n-1); if(!scrubbing) sc.value=R.pos;
  const info=infoText(); $('#rInfo').textContent=info; $('#runFoot').textContent=info; $('#runHead').textContent=ch?ch.t:R.meta.title;
  $('#rMark').classList.toggle('on', !!bookmarkHere());
  $('#rAs').hidden=R.mode!=='scroll'; $('#rAs').classList.toggle('on', !!S.autoScroll && !TTS.mode); $('#rAs').setAttribute('aria-label',S.autoScroll?'Close auto-scroll controls':'Auto-scroll');
  $('#rTts').classList.toggle('on', !!TTS.mode); $('#rTts').innerHTML=ICON.speaker; $('#rTts').setAttribute('aria-label',TTS.mode?'Close read-aloud controls':'Read aloud');
  $('#v-reader').classList.toggle('overlay', !!S.focus && !TTS.mode && R.mode!=='speed');
  ttsBarUI();
}
$('#rInfo').onclick=()=>{ S.info=(S.info+1)%3; saveSettings(); updateChrome(); };
$('#rScrub').addEventListener('input',e=>{ scrubbing=true; const i=+e.target.value; const ch=currentChapter(i); $('#rInfo').textContent=`Go to ${Math.round(100*i/Math.max(1,R.n-1))}%`+(ch?' · '+ch.t:''); });
$('#rScrub').addEventListener('change',e=>{ scrubbing=false; goTo(+e.target.value, true); });
$('#rMark').onclick=()=>{
  const ex=bookmarkHere(); const bm=R.meta.bookmarks||(R.meta.bookmarks=[]);
  if(ex){ bm.splice(bm.indexOf(ex),1); toast('Bookmark removed'); }
  else { const ch=currentChapter(R.pos); bm.push({i:R.pos, name:ch?ch.t:'', at:Date.now()}); bm.sort((a,b)=>a.i-b.i); toast('Bookmarked', {label:'See all', fn:()=>openToc('hls')}); }
  touch(R.meta); updateChrome();
};

/* ---------- open / close a book ---------- */
const loadedFonts=new Set();
async function loadBookFont(text){
  R.bookFamily=null; if(!text.font || !text.font.faces || !window.FontFace) return;
  const name='tooz-book-'+text.id;
  if(!loadedFonts.has(name)){
    let ok=0;
    for(const f of text.font.faces){
      try{ const src=f.blob? await f.blob.arrayBuffer() : (f.data? await dataURLToBlob(f.data).arrayBuffer() : null); if(!src) continue;
        const w=/bold/i.test(f.w)?'700':/^\d+$/.test(f.w)?f.w:'400';
        const ff=new FontFace(name, src, {weight:w, style:/italic|oblique/i.test(f.st)?'italic':'normal'}); await ff.load(); document.fonts.add(ff); ok++; }catch(e){}
    }
    if(!ok) return; loadedFonts.add(name);
  }
  R.bookFamily=name;
}
/* Words joined by a dash ("26:8—“Yes,", "me—and") become two words, so each side can be selected,
   highlighted and read on its own. Older books are converted once: every saved position, highlight,
   bookmark, chapter, paragraph, note and picture is moved to its new word number. */
function splitDashWord(w){
  if(!w || !/[^—–\s-](?:[—–]+|-{2,})[^—–\s-]/.test(w)) return null;
  const p=w.match(/.*?(?:[—–]+|-{2,})(?=[^—–-])|.+$/g).filter(Boolean);
  return p.length>1? p : null;
}
/* renumber everything that points at word numbers after the words change; meta[flag] marks positions already converted */
function remapWords(text, meta, words, wf, WF, M, MI, flag){
  text.words=words; if(WF||wf.some(x=>x)) text.wf=Uint8Array.from(wf);
  if(text.ends) text.ends=text.ends.map(MI);
  if(text.blocks) text.blocks=text.blocks.map(b=>Object.assign({},b,{s:M(b.s), e:M(b.e)}));
  if(text.chapters) text.chapters=text.chapters.map(c=>Object.assign({},c,{i:M(c.i)}));
  if(text.notes) text.notes=text.notes.map(([a,b])=>[M(a),M(b)]);
  if(text.breaks) text.breaks=text.breaks.map(M);
  if(text.secs) text.secs=text.secs.map(M);
  if(text.images && text.images.at) text.images.at=text.images.at.map(a=>Object.assign({},a,{i:M(a.i)}));
  if(meta){
    meta.count=words.length;
    if(meta.chapters) meta.chapters=meta.chapters.map(c=>Object.assign({},c,{i:M(c.i)}));
    if(meta[flag]) return;   /* positions already use the new word numbers (e.g. restored from the archive) */
    if(typeof meta.pos==='number') meta.pos=M(meta.pos);
    if(Array.isArray(meta.highlights)) meta.highlights=meta.highlights.map(h=>Object.assign({},h,{s:M(h.s), e:MI(h.e)}));
    if(Array.isArray(meta.bookmarks)) meta.bookmarks=meta.bookmarks.map(b=>Object.assign({},b,{i:M(b.i)}));
    const lp=LS.get('pos.'+meta.id,null); if(lp && typeof lp.pos==='number'){ lp.pos=M(lp.pos); LS.set('pos.'+meta.id,lp); }
    meta[flag]=1;
  }
}
/* the dash split also cut number ranges ("3:7–" + "8"); join them back into one word so Speed mode shows "3:7–8" */
function rangeJoinText(text, meta){
  if(text.rangeJoin) return false;
  const W=text.words, WF=text.wf&&text.wf.length===W.length?text.wf:null, n=W.length;
  text.rangeJoin=1;
  const join=(prev,k)=>WF && (WF[k]&F_GLUE) && /\d[–-]$/.test(prev) && /^\d/.test(W[k]);
  let any=false; for(let k=1;k<n;k++){ if(join(W[k-1],k)){ any=true; break; } }
  if(!any){ if(meta) meta.rangeJoin=1; return true; }
  const map=new Int32Array(n+1), words=[], wf=[];
  for(let k=0;k<n;k++){
    if(words.length && join(words[words.length-1],k)){ map[k]=words.length-1; words[words.length-1]+=W[k]; continue; }
    map[k]=words.length; words.push(W[k]); wf.push(WF?WF[k]:0);
  }
  map[n]=words.length;
  const M=i=>(i==null||i<0)?i: i>=n? words.length+(i-n) : map[i];
  remapWords(text, meta, words, wf, WF, M, M, 'rangeJoin');
  return true;
}
function dashSplitText(text, meta){
  if(text.dashSplit) return false;
  const W=text.words, WF=text.wf&&text.wf.length===W.length?text.wf:null, n=W.length;
  let any=false; for(let k=0;k<n;k++){ if(splitDashWord(W[k])){ any=true; break; } }
  text.dashSplit=1; if(!any){ if(meta) meta.dashSplit=1; return true; }
  const map=new Int32Array(n+1), words=[], wf=[];
  for(let k=0;k<n;k++){
    map[k]=words.length; const parts=splitDashWord(W[k])||[W[k]]; const f=WF?WF[k]:0;
    parts.forEach((pt,q)=>{ words.push(pt); wf.push(q? (f|F_GLUE)&~F_N : f); });
  }
  map[n]=words.length;
  const M=i=>(i==null||i<0)?i: i>=n? words.length+(i-n) : map[i];
  const MI=i=>(i==null||i<0)?i: i>=n-1? (i>=n? words.length+(i-n) : words.length-1) : map[i+1]-1;   /* inclusive end */
  remapWords(text, meta, words, wf, WF, M, MI, 'dashSplit');
  return true;
}
async function openDoc(id){
  const meta=LIB.find(x=>x.id===id); if(!meta){ toast('That document couldn’t be found.'); return false; }
  if(meta.pending){ if(!await fetchShelfBook(meta)) return false; }
  R.anchor=null; LS.set('tutOpen', meta.kind==='sample');
  let text=await Store.get('texts',id).catch(()=>null);
  if(!text){ text=fetchText(meta); if(!text){ toast('That document’s text is missing. Delete it and add the file again.', null, 6000); return false; } Store.put('texts',text).catch(()=>{}); }
  if(R.meta){ stopActivity(); saveProgress(true); if(R.mode) MODES[R.mode].leave(); R.mode=null; }
  let fixed=false;
  if(!text.dashSplit && dashSplitText(text, meta)) fixed=true;
  if(!text.rangeJoin && rangeJoinText(text, meta)) fixed=true;
  if(fixed){ Store.put('texts',text).catch(()=>{}); touch(meta); }
  applySavedPos(meta);
  R.meta=meta; R.text=text; R.words=text.words; R.n=text.words.length; R.ends=new Set(text.ends);
  R.wf=(text.wf && text.wf.length===R.n)? text.wf : null;
  R.blocks=deriveBlocks(text, meta.chapters);
  R.notes=new Map(text.notes||[]); R.breaks=new Set(text.breaks||[]); buildBacklinks();
  if(!Array.isArray(meta.highlights)) meta.highlights=[]; if(!Array.isArray(meta.bookmarks)) meta.bookmarks=[];
  (R.imgUrls||[]).forEach(u=>{ if(u&&u.startsWith('blob:')) try{ URL.revokeObjectURL(u); }catch(e){} });
  R.imgUrls=[]; R.imgList=[]; R.imgAt=new Map(); R.imgBefore=new Map(); R.imgAfter=new Map(); R.imgEnd=[];
  if(text.images){
    R.imgUrls=text.images.files.map(f=>f.blob?URL.createObjectURL(f.blob):(f.data||'')); R.imgList=text.images.at;
    R.imgList.forEach((a,idx)=>{
      if(!R.imgAt.has(a.i)) R.imgAt.set(a.i,[]); R.imgAt.get(a.i).push(idx);
      if(a.i>=R.n){ R.imgEnd.push(idx); return; }
      const bi=blockAt(a.i); const m=(a.i<=R.blocks[bi].s)?R.imgBefore:R.imgAfter;
      if(!m.has(bi)) m.set(bi,[]); m.get(bi).push(idx);
    });
  }
  buildSections(); R.sIdx=null; R.backPos=null; $('#backPill').hidden=true; diffCache={s:-1,e:-1,f:1};
  R.pos=clamp(meta.pos,0,R.n-1); // keep finished status when reopening
  R.tear=LS.get('tear.'+meta.id,null); if(R.tear!=null && !(R.tear>0 && R.tear<R.n)) R.tear=null;
  R.tearCenter= R.tear!=null && Math.abs(R.tear-R.pos)<400; R.tearShow=false;
  R.lastNav=false; R.playing=false; R.hasPlayed=false;
  meta.lastRead=Date.now(); touch(meta);
  $('#rTitle').textContent=meta.title;
  document.documentElement.lang=(text.lang||'en').split(/[^a-zA-Z-]/)[0]||'en';
  const big=R.n>15000;
  if(big){ progress('Opening “'+meta.title+'” ('+R.n.toLocaleString()+' words)…', null); await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,40))); }
  await loadBookFont(text);
  showView('reader'); applyLook(); setChrome(true);
  await new Promise(r=>requestAnimationFrame(r));
  await fontsReady(1500);
  if(R.meta!==meta) return false; /* Back (or another book) while this one was still loading: don't lay out a closed book */
  try{ await switchMode(S.mode); }
  catch(e){ if(R.meta===meta){ console.error(e); toast('Something went wrong opening this book.', null, 6000); } }
  finally{ if(big && $('#toastMsg').textContent.startsWith('Opening')) $('#toast').hidden=true; }
  resetClock(); updateChrome();
  if(typeof guideScreen==='function') requestAnimationFrame(()=>guideScreen()); /* the Guide flies to its spot in the reader */
  return true;
}
/* the page you were on when you closed the book: count it, up to the time it usually takes you */
function lastVisibleWord(){
  const box=(R.mode==='pages'?$('#pgClip'):scView).getBoundingClientRect();
  for(let dy=6; dy<80; dy+=10) for(const dx of [8,40,box.width/2]){ const i=wordAtPoint(box.right-dx, box.bottom-dy); if(i!=null) return i; }
  return null;
}
function creditLastPage(){
  if(!R.meta || (R.mode!=='pages' && R.mode!=='scroll') || TTS.on || SC.auto) return;
  const last=lastVisibleWord(); if(last==null) return;
  const dw=last-CLK.pos+1, dt=performance.now()-CLK.t; if(dw<=0 || dt<2000) return;
  recordStats(creditFor(dt,dw,true), dw); resetClock();
}
function closeReader(quiet){
  tearMark(); R.tearShow=false;
  creditLastPage(); if(TTS.mode) ttsModeOff(true); stopActivity(); noteProgress(); saveProgress(true); selClear();
  const m=R.meta;
  if(R.mode) MODES[R.mode].leave(); R.mode=null; R.meta=null; /* nothing may save a closed book's record again */
  const back=R.returnTo||'library'; R.returnTo=null;
  showView(back); applyLook();
  if(quiet || !m) return;
  /* the tutorial is removed once it's closed (Settings can bring it back) */
  if(m.kind==='sample'){ LS.set('tutOpen',false); if(!keepTutorial()) setTimeout(()=>tutorialPrompt(m.id), 300); return; }
  if(m.finished){ if(!m.finishedAt){ m.finishedAt=Date.now(); touch(m); } if(!m.keepFinished) setTimeout(()=>finishPrompt(m.id), 350); }
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && R.meta && R.mode){ tearMark(); stopActivity(); noteProgress(); saveProgress(true); CLK.away=performance.now(); }
  else if(!document.hidden && CLK.away){ CLK.away=0; if(R.meta && R.mode) resetClock(); tearShowOnReturn(); }   /* time away from the app never counts */
});
const vr=document.getElementById('v-reader');
for(const ev of ['pointerdown','keydown','wheel','touchstart']) vr.addEventListener(ev, markActivity, {capture:true, passive:true});
/* Auto-scroll and Speed keep going by themselves: after 10 minutes with no touch, pause and ask */
setInterval(()=>{
  if(document.hidden || !R.meta || !(R.playing || SC.auto)) return;
  if(performance.now()-(CLK.touch||0) < 10*60000) return;
  const wasSpeed=R.playing; if(R.playing) pause(); if(SC.auto) asStop(true); setChrome(true);
  openSheet('Still reading?', `<p class="note" style="margin-top:0">${wasSpeed?'Speed reading':'Auto-scroll'} paused after 10 minutes without a touch, so your reading time isn’t counted while you’re away.</p><button class="btn primary block" type="button" data-act="go">Keep reading</button>`, {
    go:()=>{ closeSheet(); markActivity(); resetClock(); if(wasSpeed) play(); else asStart(); }
  });
}, 30000);
const leaving=()=>{ if(R.meta && R.mode){ tearMark(); stopActivity(); saveProgress(true); } };
window.addEventListener('pagehide',leaving); window.addEventListener('beforeunload',leaving); document.addEventListener('freeze',leaving);
document.addEventListener('keydown',e=>{
  if($('#v-reader').hidden||!$('#sheet').hidden||$('#imgOverlay')) return;
  if(e.target.matches('input,textarea,select')) return;
  if(R.mode==='scroll') SC.userScrolled=true;
  if(R.mode==='speed'){ if(e.key===' '){ e.preventDefault(); toggle(); } else if(e.key==='ArrowLeft') $('#bWord').click(); else if(e.key==='ArrowRight') $('#fWord').click(); return; }
  if(R.mode==='pages'){ if(['ArrowRight','PageDown',' '].includes(e.key)){ e.preventDefault(); pgTurn(1); } else if(['ArrowLeft','PageUp'].includes(e.key)){ e.preventDefault(); pgTurn(-1); } return; }
  if(R.mode==='scroll' && S.autoScroll && e.key===' '){ e.preventDefault(); SC.auto?asStop():asStart(); }
});

/* ---------- text selection: highlight, note, copy, define ---------- */
let SEL=null, selT=null;
/* on phones, any native selection inside the book is dropped at once; Tooz's own selection is used instead */
function dropNativeSel(){ try{ const s=getSelection(); const h=hostEl(); if(s&&s.rangeCount&&!s.isCollapsed&&h&&h.contains(s.getRangeAt(0).commonAncestorContainer)){ s.removeAllRanges(); return true; } }catch(e){} return false; }
document.addEventListener('selectionchange',()=>{ if(coarse()){ dropNativeSel(); return; } clearTimeout(selT); selT=setTimeout(selCheck,220); });
for(const el of [pgView, scView]) el.addEventListener('selectstart',e=>{ if(coarse()) e.preventDefault(); });
function nodeIdx(node, off, isStart){
  let base=node.nodeType===3?node.parentElement:node;
  let w=base&&base.closest?base.closest('w'):null;
  if(!w && node.nodeType===1){ const kids=node.childNodes; const ch=kids[Math.min(off, kids.length-1)]; if(ch&&ch.nodeType===1) w=ch.matches('w')?ch:ch.querySelector('w'); }
  if(!w) return null;
  let i=idxOf(w); if(i==null) return null;
  if(!isStart && node.nodeType===3 && off===0 && i>0 && !(node.previousSibling)) i--;
  /* a selection that starts at the very end of a word really starts at the next one */
  if(isStart && node.nodeType===3 && off>=node.length && node.parentElement && node.parentElement.closest('w')===w && !node.nextSibling) i++;
  return i;
}
function selCheck(){
  if($('#v-reader').hidden || R.mode==='speed' || !R.mode){ selHide(); return; }
  const s=getSelection(); if(!s||s.isCollapsed||!s.rangeCount||!s.toString().trim()){ selHide(); return; }
  const rg=s.getRangeAt(0); const host=hostEl(); if(!host||!host.contains(rg.commonAncestorContainer)){ selHide(); return; }
  let a=nodeIdx(rg.startContainer, rg.startOffset, true), b=nodeIdx(rg.endContainer, rg.endOffset, false);
  if(a==null||b==null){ selHide(); return; } if(b<a) [a,b]=[b,a];
  SEL={s:a,e:b, text:s.toString()}; showSelBar(); if(SC.auto) asStop(); placeSelBar();
}
function showSelBar(){
  const bar=$('#selBar'); if(!bar) return;
  const was=bar.hidden; bar.hidden=false;
  if(was) TS.barAt=performance.now();
}
function selMenuIsOpen(){ const m=$('#selMenu'); return !!(m && !m.hidden); }
function closeSelMenu(focusMore){
  const m=$('#selMenu'), btn=$('#selMore');
  if(m) m.hidden=true;
  if(btn){ btn.setAttribute('aria-expanded','false'); if(focusMore) btn.focus(); }
  placeSelBar();
}
function selMenuItems(){ return [...document.querySelectorAll('#selMenu [role="menuitem"], #selMenu [data-sel]')].filter(b=>!b.hidden && b.offsetParent!==null); }
function selMenuFocus(i){
  const items=selMenuItems(); if(!items.length) return;
  i=(i+items.length)%items.length;
  items.forEach((b,k)=>b.tabIndex=k===i?0:-1);
  items[i].focus();
}
function openSelMenu(){
  const m=$('#selMenu'), btn=$('#selMore'); if(!m||!btn) return;
  m.hidden=false; btn.setAttribute('aria-expanded','true');
  const items=selMenuItems(); items.forEach((b,k)=>b.tabIndex=k===0?0:-1);
  placeSelBar();
  if(items[0]) items[0].focus();
}
function toggleSelMenu(){ if(selMenuIsOpen()) closeSelMenu(false); else openSelMenu(); }
function cssVarPx(name){ return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))||0; }
function selSafeBox(){
  const pad=8;
  const L=cssVarPx('--sal')+pad, T=cssVarPx('--sat')+pad, R=cssVarPx('--sar')+pad, B=cssVarPx('--sab')+pad;
  const W=innerWidth, H=innerHeight;
  return {l:L, t:T, r:W-R, b:H-B, w:W-L-R, h:H-T-B};
}
function selRangeRect(){
  const rects=[];
  if(TS.on){
    for(let i=TS.a;i<=TS.b;i++){
      const el=wordEl(i); if(!el) continue;
      for(const r of el.getClientRects()) if(r.width>0 && r.height>0) rects.push(r);
    }
  }
  if(!rects.length){
    try{
      const s=getSelection();
      if(s&&s.rangeCount&&!s.isCollapsed){ for(const r of s.getRangeAt(0).getClientRects()) if(r.width>0 && r.height>0) rects.push(r); }
    }catch(e){}
  }
  if(!rects.length) return null;
  let l=Infinity,t=Infinity,r=-Infinity,b=-Infinity;
  for(const q of rects){ l=Math.min(l,q.left); t=Math.min(t,q.top); r=Math.max(r,q.right); b=Math.max(b,q.bottom); }
  const clipEl=R.mode==='pages'?$('#pgClip'):R.mode==='scroll'?scView:null;
  const vis=clipEl?clipEl.getBoundingClientRect():{left:0,top:0,right:innerWidth,bottom:innerHeight};
  const cl=Math.max(l, vis.left, 0), ct=Math.max(t, vis.top, 0), cr=Math.min(r, vis.right, innerWidth), cb=Math.min(b, vis.bottom, innerHeight);
  if(cr-cl<1 || cb-ct<1) return null;
  return {left:cl, top:ct, right:cr, bottom:cb, width:cr-cl, height:cb-ct};
}
function overlaps(a,b,pad){
  pad=pad||0;
  return !(a.right<=b.left-pad || a.left>=b.right+pad || a.bottom<=b.top-pad || a.top>=b.bottom+pad);
}
function placeSelBar(){
  const bar=$('#selBar'); if(!bar || bar.hidden) return;
  const menu=$('#selMenu'), menuOpen=menu && !menu.hidden;
  const box=selSafeBox(), sel=selRangeRect(), gap=12;
  const barW=bar.offsetWidth, barH=bar.offsetHeight;
  const menuW=menuOpen?menu.offsetWidth:0, menuH=menuOpen?menu.offsetHeight:0;
  let barLeft, barTop;
  if(!sel){
    barLeft=Math.max(box.l, Math.min((innerWidth-barW)/2, box.r-barW));
    barTop=box.b-barH;
  } else {
    const mid=(sel.left+sel.right)/2;
    barLeft=Math.max(box.l, Math.min(mid-barW/2, box.r-barW));
    const below=sel.bottom+gap, above=sel.top-gap-barH;
    const belowFits=below+barH<=box.b+0.5, aboveFits=above>=box.t-0.5;
    if(belowFits) barTop=below;
    else if(aboveFits) barTop=above;
    else {
      const roomBelow=box.b-(sel.bottom+gap), roomAbove=(sel.top-gap)-box.t;
      barTop=roomBelow>=roomAbove ? Math.max(box.t, Math.min(below, box.b-barH)) : Math.max(box.t, Math.min(above, box.b-barH));
    }
  }
  bar.classList.add('placed');
  bar.style.left=Math.round(barLeft)+'px';
  bar.style.top=Math.round(barTop)+'px';
  bar.style.bottom='auto';
  bar.style.right='auto';
  if(!menuOpen) return;
  const br={left:barLeft, top:barTop, right:barLeft+barW, bottom:barTop+barH};
  const more=stillRect($('#selMore')||bar);
  const area=r=>Math.max(0, Math.min(r.right,sel?sel.right:r.left)-Math.max(r.left,sel?sel.left:r.right))*Math.max(0, Math.min(r.bottom,sel?sel.bottom:r.top)-Math.max(r.top,sel?sel.top:r.bottom));
  const candidates=[];
  const add=(l,t,kind)=>{
    l=Math.max(box.l, Math.min(l, box.r-menuW));
    t=Math.max(box.t, Math.min(t, box.b-menuH));
    const r={left:l, top:t, right:l+menuW, bottom:t+menuH};
    const overSel=sel && overlaps(r, sel, 1);
    const overBar=overlaps(r, br, 1);
    const off=r.left<box.l-1||r.top<box.t-1||r.right>box.r+1||r.bottom>box.b+1;
    const pref={below:0, above:1, right:2, left:3, 'right-end':4, 'left-end':5}[kind]||6;
    candidates.push({l,t,kind, overSel, overBar, off, overlap:sel?area(r):0, score:(off?500:0)+(overSel?100:0)+(overBar?25:0)+pref});
  };
  add(more.left, br.bottom+gap, 'below');
  add(more.left, br.top-gap-menuH, 'above');
  add(br.right+gap, br.top, 'right');
  add(br.left-gap-menuW, br.top, 'left');
  add(br.right+gap, br.bottom-menuH, 'right-end');
  add(br.left-gap-menuW, br.bottom-menuH, 'left-end');
  candidates.sort((a,b)=>a.score-b.score || a.overlap-b.overlap);
  const best=candidates[0];
  menu.style.left=Math.round(best.l)+'px';
  menu.style.top=Math.round(best.t)+'px';
}
function selHide(){
  closeSelMenu(false);
  const bar=$('#selBar');
  bar.hidden=true; bar.classList.remove('placed'); bar.style.left=bar.style.top=bar.style.bottom=bar.style.right='';
  SEL=null; if(TS.on){ TS.on=false; tsPaint(); }
}
function selClear(){ selHide(); try{ const s=getSelection(); if(s&&!s.isCollapsed) s.removeAllRanges(); }catch(e){} if(pendingRelay){ pendingRelay=false; holdPlace(); relayoutSoon(); } }
$('#selMore').innerHTML=(ICON.more||'')+'More';
for(const [act,icon,label] of [['define','define','Define'],['note','note','Note'],['copy','copy','Copy'],['share','share','Share']]){
  const b=document.querySelector('#selMenu [data-sel="'+act+'"]'); if(b) b.innerHTML=(ICON[icon]||'')+label;
}
$('#selBar').addEventListener('mousedown',e=>e.preventDefault());
$('#selMenu').addEventListener('mousedown',e=>e.preventDefault());
$('#selBar').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b||!SEL) return;
  if(b.id==='selMore'){ toggleSelMenu(); return; }
  const {s,e:en}=SEL;
  if(b.dataset.hl){ if(performance.now()-(TS.barAt||0)<250) return; addHighlight(s,en,+b.dataset.hl); selClear(); return; }
  const act=b.dataset.sel; selClear();
  /* Define, Note and Share only open a sheet — they must not call goTo or setBack or move R.pos */
  if(act==='copy') copyQuote(s,en);
  else if(act==='note'){ const ex=(R.meta.highlights||[]).find(h=>h.e>=s && h.s<=en); const h=addHighlight(s,en,ex?ex.c:1); openHlMenu(h,true); }
  else if(act==='define'){ const k=defineIdx(s,en); const w=clean(R.words[k]); if(w) defineWord(w,k); }
  else if(act==='share') quoteImage(s,en);
});
document.addEventListener('keydown',e=>{
  if(!selMenuIsOpen()) return;
  const items=selMenuItems();
  const i=items.indexOf(document.activeElement);
  if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); closeSelMenu(true); return; }
  if(e.key==='ArrowDown'){ e.preventDefault(); e.stopPropagation(); selMenuFocus(i<0?0:i+1); return; }
  if(e.key==='ArrowUp'){ e.preventDefault(); e.stopPropagation(); selMenuFocus(i<0?items.length-1:i-1); return; }
  if(e.key==='Home'){ e.preventDefault(); e.stopPropagation(); selMenuFocus(0); return; }
  if(e.key==='End'){ e.preventDefault(); e.stopPropagation(); selMenuFocus(items.length-1); return; }
}, true);
/* the word to define: the first real word in the selection (skipping note numbers and stray punctuation) */
function defineIdx(s,e){ for(let k=s;k<=e;k++){ if(R.wf && (R.wf[k]&F_N)) continue; if(clean(R.words[k])) return k; } return s; }
/* "quote" — Author, Title, chapter */
function citation(s){ const ch=currentChapter(s); const t=R.meta.title, a=R.meta.author; return [a, t, ch&&ch.t&&ch.t!==t?ch.t:''].filter(Boolean).join(', '); }
async function copyQuote(s,e){
  const t='“'+textOf(s,e)+'” — '+citation(s);
  try{ await navigator.clipboard.writeText(t); toast('Copied'); }catch(err){ toast('Couldn’t copy. Select the text and use the iPhone’s Copy instead.'); }
}

/* ---------- touch selection: press and hold a word, drag the handles; no phone menu over the book ---------- */
const TS={on:false, a:0, b:0, timer:0, start:null, drag:null, extending:false};
const coarse=()=>{ try{ return matchMedia('(hover:none),(pointer:coarse)').matches; }catch(e){ return false; } };
function tsPaint(){
  document.querySelectorAll('w.tsel,wd.tsel').forEach(w=>w.classList.remove('tsel'));
  const A=$('#tsA'), B=$('#tsB');
  if(!TS.on){ A.hidden=B.hidden=true; return; }
  for(let k=TS.a;k<=TS.b;k++){ const w=wordEl(k); if(w){ w.classList.add('tsel'); const d=k<TS.b&&dashOf(w); if(d) d.classList.add('tsel'); } }
  const wa=wordEl(TS.a), wb=wordEl(TS.b);
  if(wa){ const b=bandOf(wa, wa.getClientRects()[0]||wa.getBoundingClientRect()); A.style.setProperty('--stem',b.h+'px'); A.style.left=b.l+'px'; A.style.top=(b.top-13)+'px'; A.hidden=false; } else A.hidden=true;
  if(wb){ const rs=wb.getClientRects(); const b=bandOf(wb, rs[rs.length-1]||wb.getBoundingClientRect()); B.style.setProperty('--stem',b.h+'px'); B.style.left=b.r+'px'; B.style.top=b.top+'px'; B.hidden=false; } else B.hidden=true;
  TS.bh=wb?bandOf(wb, wb.getBoundingClientRect()).h:22;
  if(TS.on) placeSelBar();
}
function tsSet(a,b){ TS.on=true; TS.a=Math.min(a,b); TS.b=Math.max(a,b); SEL={s:TS.a, e:TS.b}; showSelBar(); if(SC.auto) asStop(); tsPaint(); }
function wordAtPoint(x,y){ const el=document.elementFromPoint(x,y); const w=el&&el.closest?el.closest('w'):null; if(!w || !hostEl() || !hostEl().contains(w)) return null; return idxOf(w); }
/* the coloured band of a word: no taller than its line (tall fonts have boxes that reach into the next line) */
function bandOf(w, r){
  const cs=getComputedStyle(w), fs=parseFloat(cs.fontSize)||16; let lh=parseFloat(cs.lineHeight); if(!lh) lh=(S.lineH||1.5)*fs;
  const h=Math.max(8, Math.min(r.height, lh-0.14*fs)); return {l:r.left, r:r.right, top:r.top+(r.height-h)/2, h, mid:r.top+r.height/2};
}
/* the word nearest the finger: first the nearest line (by line centre), then the nearest word on it.
   Past the end of a short last line picks that line's last word. */
function tsRects(){
  if(TS.rects) return TS.rects;
  const h=hostEl(), out=[]; if(!h) return out; const H=innerHeight, W=innerWidth;
  for(const w of h.querySelectorAll('w')){ const rs=w.getClientRects(); for(const r of rs){ if(r.width<1 || r.bottom<0 || r.top>H || r.right<0 || r.left>W) continue; const i=idxOf(w); if(i!=null) out.push({i, l:r.left, r:r.right, mid:r.top+r.height/2}); } }
  TS.rects=out; return out;
}
function wordNear(x,y){
  const L=tsRects(); if(!L.length) return null;
  let best=Infinity; for(const q of L){ const d=Math.abs(q.mid-y); if(d<best) best=d; }
  const line=L.filter(q=>Math.abs(Math.abs(q.mid-y)-best)<3);
  let pick=null, bd=Infinity; for(const q of line){ const d= x<q.l ? q.l-x : x>q.r ? x-q.r : 0; if(d<bd || (d===bd && pick && q.i>pick.i && x>q.r)){ bd=d; pick=q; } }
  return pick?pick.i:null;
}
function tsExtendTo(i){
  if(i==null) return;
  if(TS.extending && TS.start) tsSet(TS.start.i, i);
  else if(TS.drag==='tsA') tsSet(Math.min(i,TS.b), TS.b);
  else if(TS.drag==='tsB') tsSet(TS.a, Math.max(i,TS.a));
}
/* dragging a selection to the top or bottom edge scrolls (Scroll) or turns the page (Pages) so it can keep going */
const EDGE={top:100, bottom:70, dwell:650};
function tsEdgeStart(){ TS.rects=null; document.body.classList.add('tsdrag'); if(TS.loop) return; TS.dwellAt=0; TS.loop=setInterval(tsEdgeTick,40); }
function tsEdgeStop(){ document.body.classList.remove('tsdrag'); clearInterval(TS.loop); TS.loop=0; TS.dwellAt=0; }
async function tsEdgeTick(){
  if(!(TS.extending||TS.drag) || !TS.pt){ if(!(TS.extending||TS.drag)) tsEdgeStop(); return; }
  const {x,y}=TS.pt, H=innerHeight;
  const zone= y>=H-EDGE.bottom ? 1 : y<=EDGE.top ? -1 : 0;
  if(!zone){ TS.dwellAt=0; return; }
  if(R.mode==='scroll'){
    const depth= zone>0 ? (y-(H-EDGE.bottom))/EDGE.bottom : (EDGE.top-y)/EDGE.top;
    scView.scrollTop += zone*Math.round(4+Math.min(1,Math.max(0,depth))*16); TS.rects=null;
    SC.gestureAt=Date.now();
    tsExtendTo(wordNear(x, zone>0? H-EDGE.bottom-6 : EDGE.top+6));
  } else if(R.mode==='pages'){
    if(!hasSelection()) return;
    const now=performance.now();
    if(!TS.dwellAt){ TS.dwellAt=now; return; }
    if(now-TS.dwellAt<EDGE.dwell || P.busy || TS.turning) return;
    TS.turning=true; TS.edge=true;
    try{ await pgTurn(zone); } finally{ TS.edge=false; TS.turning=false; TS.dwellAt=performance.now(); TS.rects=null; }
    if(TS.extending||TS.drag) tsExtendTo(wordNear(x, zone>0? H-EDGE.bottom-6 : EDGE.top+6));
    tsPaint();
  }
}
for(const host of [pgView, scView]){
  host.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse' || !coarse()) return;
    clearTimeout(TS.timer); const w=e.target.closest&&e.target.closest('w'); if(!w) return; const i=idxOf(w); if(i==null) return;
    TS.start={x:e.clientX,y:e.clientY,i};
    TS.timer=setTimeout(()=>{ if(!TS.start) return; tsSet(TS.start.i, TS.start.i); TS.extending=true; TS.pt={x:TS.start.x,y:TS.start.y}; tsEdgeStart(); markActivity(); try{ navigator.vibrate&&navigator.vibrate(8); }catch(_){} }, 450);
  });
  host.addEventListener('pointermove',e=>{
    if(TS.extending){ TS.pt={x:e.clientX,y:e.clientY}; tsExtendTo(wordNear(e.clientX,e.clientY)); return; }
    if(TS.start && Math.hypot(e.clientX-TS.start.x, e.clientY-TS.start.y)>9){ clearTimeout(TS.timer); TS.start=null; }
  });
  const end=()=>{ clearTimeout(TS.timer); if(TS.extending){ TS.extending=false; TS.justSelected=performance.now(); } TS.start=null; if(!TS.drag) tsEdgeStop(); };
  host.addEventListener('pointerup',end); host.addEventListener('pointercancel',end);
  /* while a press-and-hold is extending the selection, the page mustn't scroll */
  host.addEventListener('touchmove',e=>{ if(TS.extending||TS.drag) e.preventDefault(); },{passive:false});
  host.addEventListener('contextmenu',e=>{ if(coarse()) e.preventDefault(); });
}
for(const id of ['tsA','tsB']){
  const h=$('#'+id);
  h.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); TS.drag=id; TS.pt={x:e.clientX,y:e.clientY}; tsEdgeStart(); try{ h.setPointerCapture(e.pointerId); }catch(_){} });
  h.addEventListener('pointermove',e=>{ if(TS.drag!==id) return; e.preventDefault(); TS.pt={x:e.clientX,y:e.clientY}; tsExtendTo(wordNear(e.clientX, id==='tsA'? e.clientY+13+(TS.bh||22)/2 : e.clientY-(TS.bh||22)/2-6)); });
  const up=()=>{ TS.drag=null; TS.justSelected=performance.now(); tsEdgeStop(); }; h.addEventListener('pointerup',up); h.addEventListener('pointercancel',up);
  h.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
}
/* a tap anywhere else lets go of the selection */
document.addEventListener('pointerdown',e=>{
  if(selMenuIsOpen() && !e.target.closest('#selBar,#selMenu,.tsh,#sheet')){ closeSelMenu(true); e.stopPropagation(); return; }
  if(!TS.on || TS.extending) return; if(e.target.closest('#selBar,#selMenu,.tsh,#sheet')) return; if(performance.now()-(TS.justSelected||0)<350) return; selClear(); TS.clearedAt=performance.now();
}, true);
const selReposition=()=>{ if($('#selBar').hidden) return; placeSelBar(); };
scView.addEventListener('scroll', selReposition, {passive:true});
window.addEventListener('resize', selReposition);
try{ visualViewport.addEventListener('resize', selReposition); visualViewport.addEventListener('scroll', selReposition); }catch(e){}

/* ---------- share a quote as an image ---------- */
function quoteImage(s,e, style){
  style=style||LS.get('qstyle','light');
  const q=textOf(s,e); const quote=q.length>700? q.slice(0,700).replace(/\s+\S*$/,'')+'…' : q;
  const by=[R.meta.author, R.meta.title].filter(Boolean);
  const STY={light:{bg:'#f6f1e7',ink:'#2a241c',mute:'#7a6d5c',acc:'#a8743a'}, dark:{bg:'#1d1f24',ink:'#efe9de',mute:'#a59d90',acc:'#d7a45f'}, sepia:{bg:'#e9dcc3',ink:'#3a2c1a',mute:'#6f5b40',acc:'#8a5a2b'}};
  const c=document.createElement('canvas'); c.width=c.height=1080; const x=c.getContext('2d'); const st=STY[style]||STY.light;
  x.fillStyle=st.bg; x.fillRect(0,0,1080,1080);
  const serif='Georgia, "Iowan Old Style", "Times New Roman", serif';
  const wrap=(txt,size)=>{ x.font=`${size}px ${serif}`; const words=txt.split(/\s+/), lines=[]; let cur=''; for(const w of words){ const t=cur?cur+' '+w:w; if(x.measureText(t).width>840 && cur){ lines.push(cur); cur=w; } else cur=t; } if(cur) lines.push(cur); return lines; };
  let size=64, lines=wrap('“'+quote+'”',size); while(lines.length*size*1.35>620 && size>26){ size-=2; lines=wrap('“'+quote+'”',size); }
  const lh=size*1.35, total=lines.length*lh; let y=(1080-total-120)/2+size;
  x.fillStyle=st.acc; x.fillRect(120, y-size-28, 72, 5);
  x.fillStyle=st.ink; x.font=`${size}px ${serif}`; for(const l of lines){ x.fillText(l,120,y); y+=lh; }
  x.fillStyle=st.mute; x.font=`italic 34px ${serif}`; y+=30;
  if(by.length){ const t='— '+by.join(', '); const bl=wrap(t,34); x.font=`italic 34px ${serif}`; for(const l of bl.slice(0,2)){ x.fillText(l,120,y); y+=46; } }
  x.fillStyle=st.mute; x.globalAlpha=.55; x.font='22px -apple-system, system-ui, sans-serif'; x.fillText('Tooz eReader', 120, 1020); x.globalAlpha=1;
  const url=c.toDataURL('image/png');
  openSheet('Share as image', `<img class="qcard-prev" src="${url}" alt="Quote card">
    <div class="seg" style="margin-bottom:12px">${[['light','Light'],['sepia','Sepia'],['dark','Dark']].map(([k,l])=>`<button type="button" data-act="sty" data-s="${k}" aria-pressed="${k===style}">${l}</button>`).join('')}</div>
    <div class="row"><button class="btn primary" type="button" data-act="share">Share or save</button></div>`, {
    sty:(b)=>{ LS.set('qstyle',b.dataset.s); quoteImage(s,e,b.dataset.s); },
    share:()=>{ c.toBlob(async blob=>{ const name=(R.meta.title||'Quote').replace(/[^\w\s-]/g,'').slice(0,40).trim()+' quote.png'; const file=new File([blob], name, {type:'image/png'});
      try{ if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file]}); return; } }catch(err){ if(err&&err.name==='AbortError') return; }
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); toast('Image saved'); }, 'image/png'); }
  });
}

/* ---------- highlights and notes ---------- */
function hlAt(i){ if(i==null) return null; return (R.meta.highlights||[]).find(h=>i>=h.s && i<=h.e)||null; }
function addHighlight(s,e,c,note){
  const list=R.meta.highlights; let notes=note?[note]:[];
  for(let k=list.length-1;k>=0;k--){ const h=list[k]; if(h.e>=s && h.s<=e){ s=Math.min(s,h.s); e=Math.max(e,h.e); if(h.note) notes.unshift(h.note); list.splice(k,1); } }
  const h={id:uid(), s, e, c, note:notes.join('\n\n'), at:Date.now()}; list.push(h); list.sort((a,b)=>a.s-b.s);
  touch(R.meta); redecorate(); return h;
}
const HL_NAME={1:'Yellow',2:'Green',3:'Blue',4:'Pink'};
function hlName(c){ return HL_NAME[c||1]||'Highlight'; }
function jumpToMoment(i, len){
  if(R.mode==='speed' && R.playing) pause();
  const prev=R.pos;
  pendingRelay=false; clearTimeout(relayT);
  const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return frames().then(()=>goTo(i, true)).then(async()=>{
    if(prev!==i) setBack(prev);
    await frames();
    if(R.meta && R.mode && R.pos!==i) await goTo(i, 'back');
    return flashFound(i, Math.max(1, len||1));
  });
}
function refreshMomentViews(){ try{ if(typeof renderNotes==='function' && $('#v-words') && !$('#v-words').hidden) renderNotes(); }catch(e){} }
function openHlMenu(h, focusNote, from){
  openSheet('Highlight', `
    <div class="quote">${esc(textOf(h.s,Math.min(h.e,h.s+120)))}${h.e>h.s+120?'…':''}</div>
    <div class="chips" style="gap:12px">${[1,2,3,4].map(c=>`<button class="swatch" type="button" data-act="col" data-c="${c}" aria-label="Highlight ${hlName(c).toLowerCase()}" aria-pressed="${h.c===c}" style="background:var(--hl${c})"></button>`).join('')}</div>
    <div class="field"><label for="hlNote">Note</label><textarea class="short" id="hlNote" placeholder="Add a note">${esc(h.note||'')}</textarea></div>
    <div class="row"><button class="btn primary" type="button" data-act="save">Save note</button><button class="btn" type="button" data-act="copy">Copy</button><button class="btn" type="button" data-act="share">Share image</button></div>
    <button class="btn block danger" type="button" data-act="del">${ICON.trash} Remove highlight</button>`, {
    col:(b)=>{ h.c=+b.dataset.c; touch(R.meta); redecorate(); document.querySelectorAll('#sheet .swatch').forEach(x=>x.setAttribute('aria-pressed', x===b)); },
    save:()=>{ h.note=$('#hlNote').value.trim(); touch(R.meta); redecorate(); toast(h.note?'Note saved':'Note cleared'); if(from==='toc') openToc('hls'); else { closeSheet(); refreshMomentViews(); } },
    copy:()=>{ copyQuote(h.s,h.e); },
    share:()=>{ closeSheet(); quoteImage(h.s,h.e); },
    del:()=>{ const L=R.meta.highlights; const k=L.indexOf(h); if(k>=0) L.splice(k,1); touch(R.meta); redecorate(); toast('Highlight removed'); if(from==='toc') openToc('hls'); else { closeSheet(); refreshMomentViews(); } }
  });
  if(focusNote) setTimeout(()=>{ const t=$('#hlNote'); t&&t.focus(); },120);
}

/* ---------- footnotes ---------- */
function openFootnote(i){
  if(i==null) return; if(R.backTo && R.backTo.has(i)){ goTo(R.backTo.get(i), true); return; }
  const t=R.notes.get(i); if(t==null) return;
  const B=R.blocks; let bi=blockAt(t); let s=B[bi].s, e=B[bi].e-1;
  if(e-s<4 && bi+1<B.length) e=B[bi+1].e-1;
  const txt=textOf(s, Math.min(e, s+200));
  openSheet('Note', `<div class="quote">${esc(txt)}${e>s+200?'…':''}</div><button class="btn block" type="button" data-act="go">Go to this note in the book</button>`, { go:()=>{ closeSheet(); goTo(t,true); } });
}

/* ---------- notes & highlights stream (view only; stored highlights stay {id,s,e,c,note,at}) ---------- */
let NOTESORT=LS.get('notesSort','pos');
if(NOTESORT!=='date') NOTESORT='pos';
function sortMoments(list){
  const a=(list||[]).slice();
  if(NOTESORT==='date') a.sort((x,y)=>(y.at||0)-(x.at||0) || (x.s||0)-(y.s||0));
  else a.sort((x,y)=>(x.s||0)-(y.s||0) || (x.at||0)-(y.at||0));
  return a;
}
function bookMoments(d){
  const out=[];
  if(!d) return out;
  for(const h of d.highlights||[]) out.push({kind:'hl', s:h.s, e:h.e, at:h.at||0, id:h.id, c:h.c, note:h.note||'', bookId:d.id, src:h});
  for(const b of d.bookmarks||[]) out.push({kind:'bm', s:b.i, e:b.i, at:b.at||0, id:'bm:'+(b.at||0)+':'+b.i, name:b.name||'', bookId:d.id, src:b});
  if(typeof WORDS!=='undefined'){
    for(const w of WORDS){ if(w && w.docId===d.id) out.push({kind:'word', s:w.pos||0, e:w.pos||0, at:w.at||0, id:w.id, word:w.word||'', sentence:w.sentence||'', def:w.def||'', bookId:d.id, src:w}); }
  }
  return out;
}
function momentQuote(m, getText){
  if(m.kind==='word') return m.word||'Word';
  if(m.kind==='bm'){
    const raw=getText?getText(m):(typeof textOf==='function' && R.meta && R.meta.id===m.bookId?textOf(m.s, Math.min((R.n||1)-1, m.s+12)):'');
    const line=(raw||'').split(/[.?!]/)[0].trim()||raw||'';
    return line?(line.length>80?line.slice(0,80)+'…':line):'';
  }
  const raw=(getText?getText(m):textOf(m.s, Math.min(m.e, m.s+80)))||'';
  const cap=(m.e>m.s+80) || raw.length>320;
  return cap?(raw.length>320?raw.slice(0,320)+'…':raw+'…'):raw;
}
function momentMatches(m, q, quote){
  if(!q) return true;
  q=q.toLowerCase();
  return [quote, m.note, m.name, m.word, m.sentence, m.def, m.kind==='hl'?'highlight':m.kind==='bm'?'bookmark':'word', m.kind==='hl'?hlName(m.c):''].some(x=>x && String(x).toLowerCase().includes(q));
}
function momentKindMeta(m){
  if(m.kind==='hl'){ const name=hlName(m.c); return {label:name+' highlight', kindLbl:name, icon:`<span class="moment-dot" style="background:var(--hl-dot${m.c||1},var(--hl${m.c||1}))" aria-hidden="true"></span>`}; }
  if(m.kind==='bm') return {label:'Bookmark', kindLbl:'Bookmark', icon:`<span class="moment-ico" aria-hidden="true">${ICON.mark}</span>`};
  return {label:'Looked-up word', kindLbl:'Word', icon:`<span class="moment-ico" aria-hidden="true">${ICON.define}</span>`};
}
function momentRowHtml(m, quote, where, goAttrs, moreBtn){
  const k=momentKindMeta(m);
  let body='';
  if(m.kind==='word'){
    const def=(m.def||'').trim();
    const snip=m.sentence||'';
    body=`<div class="t"><span class="moment-kind">${esc(k.kindLbl)}</span><span class="moment-word">${esc(m.word||quote||'Word')}</span>${def?` <span class="moment-def">${esc(def)}</span>`:''}</div>
        ${snip?`<div class="moment-snip">${esc(snip)}</div>`:''}
        ${where?`<div class="where">${esc(where)}</div>`:''}`;
  }else if(m.kind==='bm'){
    body=`<div class="t"><span class="moment-kind">${esc(k.kindLbl)}</span>${esc(quote)}</div>
        ${where?`<div class="where">${esc(where)}</div>`:''}`;
  }else{
    const long=!!(m.note && m.note.length>90);
    body=`<div class="t"><span class="moment-kind">${esc(k.kindLbl)}</span>${esc(quote)}</div>
        ${m.note?`<div class="nt${long?' nt-clamp':''}">${esc(m.note)}</div>${long?`<span class="nt-more" data-act="more" role="button" tabindex="0">more</span>`:''}`:''}
        ${where?`<div class="where">${esc(where)}</div>`:''}`;
  }
  const exp=m.kind==='word' && (m.sentence||'') ? `<button class="icon-btn moment-exp" type="button" data-act="expand" aria-label="Show the sentence" aria-expanded="false">▾</button>` : '';
  return `<div class="swrow moment-row" data-mk="${m.kind}" data-mid="${esc(String(m.id))}" data-book="${esc(m.bookId||'')}" data-i="${m.s}" data-len="${Math.max(1,(m.e||m.s)-m.s+1)}" data-bmat="${m.kind==='bm'?(m.at||0):''}">
    <button class="swdel" type="button" tabindex="-1">Delete</button>
    <div class="hlrow moment swfront">
      ${k.icon}
      <span class="sr-only">${k.label}</span>
      <button type="button" class="grow moment-go" ${goAttrs}>
        ${body}
      </button>
      ${exp}${moreBtn||''}
      <button class="icon-btn moment-rm" type="button" data-act="rmmoment" aria-label="Remove ${k.label}">${ICON.close}</button>
    </div>
  </div>`;
}
function notesSortLabel(){ return NOTESORT==='date'?'Sorted by date':'Sorted by place in the book'; }
function removeMoment(m, book){
  const d=book|| (R.meta && m.bookId && R.meta.id===m.bookId?R.meta:(typeof LIB!=='undefined'?LIB.find(x=>x.id===m.bookId):null));
  let undo=()=>{}, label='Removed';
  if(m.kind==='hl'){
    if(!d) return; const L=d.highlights||(d.highlights=[]); const k=L.findIndex(h=>h.id===m.id); if(k<0) return;
    const [gone]=L.splice(k,1); touch(d); if(R.meta===d) redecorate();
    label='Highlight removed';
    undo=()=>{ d.highlights.push(gone); d.highlights.sort((a,b)=>a.s-b.s); touch(d); if(R.meta===d) redecorate(); afterMomentChange(); };
  } else if(m.kind==='bm'){
    if(!d) return; const L=d.bookmarks||(d.bookmarks=[]); const k=L.findIndex(b=>b.i===m.s && String(b.at||0)===String(m.at||0)); if(k<0) return;
    const [gone]=L.splice(k,1); touch(d); if(R.meta===d) updateChrome();
    label='Bookmark deleted';
    undo=()=>{ d.bookmarks.push(gone); d.bookmarks.sort((a,b)=>a.i-b.i); touch(d); if(R.meta===d) updateChrome(); afterMomentChange(); };
  } else if(m.kind==='word'){
    if(typeof WORDS==='undefined') return; const k=WORDS.findIndex(w=>w.id===m.id); if(k<0) return;
    const [gone]=WORDS.splice(k,1); if(typeof saveWords==='function') saveWords();
    label='Removed “'+(gone.word||'word')+'”';
    undo=()=>{ WORDS.splice(k,0,gone); if(typeof saveWords==='function') saveWords(); afterMomentChange(); };
  } else return;
  const host=document.querySelector('.moment-row[data-mid="'+CSS.escape(String(m.id))+'"]');
  const list=host && (host.closest('#hlStream')||host.closest('#notesHl'));
  const idx=list?[...list.querySelectorAll('.moment-row')].findIndex(r=>r.dataset.mid===String(m.id)):-1;
  afterMomentChange();
  toast(label, {label:'Undo', fn:undo});
  requestAnimationFrame(()=>{
    const box=($('#hlStream') && document.getElementById('sheet') && !$('#sheet').hidden)?$('#hlStream'):$('#notesHl');
    const rows=box?[...box.querySelectorAll('.moment-row')]:[];
    const target=rows[idx]||rows[Math.max(0,idx-1)]||null;
    const btn=target&&target.querySelector('.moment-rm');
    const fallback=$('#hlFind')||$('#notesFind');
    if(btn) btn.focus(); else if(fallback) fallback.focus();
  });
}
function afterMomentChange(){
  if($('#hlStream')) fillHlStream();
  refreshMomentViews();
}
const MOMENT_PAGE=80;
function paintMomentRows(box, rows, empty){
  if(!box) return;
  box._allRows=rows;
  box._shown=0;
  if(!rows.length){ box.innerHTML=empty||''; return; }
  const n=Math.min(MOMENT_PAGE, rows.length);
  box.innerHTML=rows.slice(0,n).join('');
  box._shown=n;
  if(!box._lazyBound){
    box._lazyBound=1;
    const scroller=box.closest('.sheet-body')||box.closest('.view')||box;
    scroller.addEventListener('scroll',()=>{
      if(!box._allRows || box._shown>=box._allRows.length) return;
      if(scroller.scrollTop+scroller.clientHeight < scroller.scrollHeight-160) return;
      const from=box._shown, to=Math.min(box._allRows.length, from+MOMENT_PAGE);
      box.insertAdjacentHTML('beforeend', box._allRows.slice(from,to).join(''));
      box._shown=to;
    },{passive:true});
  }
}
function momentsCopyText(d, quoteOf){
  const lines=[d.title||''];
  for(const m of sortMoments(bookMoments(d))){
    if(m.kind==='hl'){
      const q=quoteOf?quoteOf(m):(typeof textOf==='function'&&R.meta&&R.meta.id===d.id?textOf(m.s,m.e):'');
      lines.push('“'+(q||'')+'”'+(m.note?'\nNote: '+m.note:''));
    }else if(m.kind==='bm'){
      const q=quoteOf?quoteOf(m):(typeof textOf==='function'&&R.meta&&R.meta.id===d.id?textOf(m.s, Math.min((R.n||1)-1,m.s+12)):'');
      lines.push('Bookmark · '+Math.round(100*m.s/Math.max(1,(d.count||R.n||1)-1))+'%'+(q?'\n“'+q+'”':''));
    }else if(m.kind==='word'){
      lines.push('Word · '+(m.word||'')+(m.def?' — '+m.def:'')+(m.sentence?'\n“'+m.sentence+'”':''));
    }
  }
  return lines.filter(Boolean).join('\n\n');
}
function fillHlStream(){
  const box=$('#hlStream'), count=$('#hlCount'); if(!box||!R.meta) return;
  const q=(($('#hlFind')||{}).value||'').trim();
  const all=sortMoments(bookMoments(R.meta));
  const rows=[];
  for(const m of all){
    const quote=momentQuote(m);
    if(!momentMatches(m,q,quote+(m.sentence||'')+(m.def||'')+(m.note||''))) continue;
    const where=Math.round(100*m.s/Math.max(1,R.n-1))+'%';
    const more=m.kind==='hl'?`<button class="icon-btn moment-more" type="button" data-act="edit" data-id="${esc(m.id)}" aria-label="Edit ${hlName(m.c)} highlight">${ICON.more}</button>`:'';
    rows.push(momentRowHtml(m, quote, where, `data-act="go" data-i="${m.s}" data-len="${Math.max(1,(m.e||m.s)-m.s+1)}"`, more));
  }
  const n=rows.length, tot=all.length;
  if(count) count.textContent=tot?(n+' of '+tot):'';
  const empty=q?'<p class="note">No matches.</p>':'<p class="note">Select text in the book to highlight it. Add a note from More. Bookmarks and words you look up appear here too.</p>';
  paintMomentRows(box, rows, empty);
  const sortBtn=$('#hlSort'); if(sortBtn){ sortBtn.textContent=notesSortLabel(); sortBtn.setAttribute('aria-pressed', NOTESORT==='date'?'true':'false'); }
}

/* ---------- contents, bookmarks, highlights ---------- */
function openToc(tab){
  if(R.mode==='speed' && R.playing) pause();
  setChrome(true);
  const t=(tab==='marks'?'hls':(tab||'toc'));
  const tools=`<div class="toc-tools"><button type="button" class="toc-tool" id="tocSearch" data-act="search">${ICON.search}<span>Search this book</span></button><button type="button" class="toc-tool" id="tocNotes" data-act="notes">${ICON.note}<span>Notes &amp; highlights</span></button></div>`;
  const seg=`<div class="seg" style="margin-bottom:4px">${[['toc','Contents'],['hls','Notes']].map(([k,l])=>`<button type="button" data-act="tab" data-t="${k}" aria-pressed="${t===k}">${l}</button>`).join('')}</div>`;
  let body='';
  if(t==='toc'){
    const ch=R.meta.chapters||[]; const cur=currentChapter(R.pos);
    /* a very long list (the Bible's 1,189 chapters) shows books first; tap a book to show its chapters */
    let rows=ch.map((c,k)=>k), kids=new Set(), open=-1;
    if(ch.length>150){
      const maxD=Math.max(...ch.map(c=>c.d||0));
      const parentOf=k=>{ for(let j=k-1;j>=0;j--) if((ch[j].d||0)<(ch[k].d||0)) return j; return -1; };
      ch.forEach((c,k)=>{ if((c.d||0)===maxD){ const p=parentOf(k); if(p>=0) kids.add(p); } });
      const curK=ch.indexOf(cur);
      open = (R.tocOpen&&R.tocOpen.id===R.meta.id)? R.tocOpen.k : (curK>=0&&(cur.d||0)===maxD? parentOf(curK) : curK);
      if(maxD>0) rows=rows.filter(k=>(ch[k].d||0)<maxD || parentOf(k)===open);
    }
    body = ch.length ? `<div class="list">${rows.map(k=>{ const c=ch[k]; const par=kids.has(k); return `<button class="li${c===cur?' on':''}${k===open?' open':''}" type="button" data-act="${par?'tocx':'go'}" data-k="${k}" data-i="${c.i}" style="padding-left:${4+(c.d||0)*16}px"${par?` aria-expanded="${k===open}"`:''}><span class="grow">${par?(k===open?'▾ ':'▸ '):''}${esc(c.t)}</span><span class="small">${Math.round(100*c.i/Math.max(1,R.n-1))}%</span></button>`; }).join('')}</div>` : '<p class="note">This document has no chapter list. Use search or the progress bar to move around.</p>';
  } else {
    const hl=(R.meta.highlights||[]).length || (R.meta.bookmarks||[]).length || (typeof WORDS!=='undefined' && WORDS.some(w=>w&&w.docId===R.meta.id));
    body=`<div class="hl-tools">
        <input class="input" id="hlFind" type="search" placeholder="Search notes, bookmarks and words" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search notes, bookmarks and words">
        <div class="hl-meta"><span id="hlCount"></span><button class="sort" type="button" id="hlSort" data-act="hlsort">${notesSortLabel()}</button></div>
      </div>
      <div id="hlStream"></div>
      ${hl?`<button class="btn block" type="button" data-act="copyall" style="margin-top:12px">Copy all</button>`:''}`;
  }
  openSheet(R.meta.title, tools+seg+body, {
    search:()=>openSearch(),
    notes:()=>openToc('hls'),
    tab:(b)=>openToc(b.dataset.t),
    tocx:(b)=>{ const k=+b.dataset.k; const was=R.tocOpen&&R.tocOpen.id===R.meta.id&&R.tocOpen.k===k; R.tocOpen={id:R.meta.id, k: was? -1 : k}; openToc('toc'); setTimeout(()=>{ const o=$('#sheet .li.open'); o&&o.scrollIntoView({block:'start'}); },40); },
    go:(b)=>{ const i=+b.dataset.i, len=+b.dataset.len||1; closeSheet(); jumpToMoment(i, len); },
    edit:(b)=>{ const h=R.meta.highlights.find(x=>x.id===b.dataset.id); if(h) openHlMenu(h,false,'toc'); },
    rmmoment:(b)=>{ const row=b.closest('.moment-row'); if(row) removeMoment({kind:row.dataset.mk, id:row.dataset.mid, bookId:row.dataset.book, s:+row.dataset.i, at:+row.dataset.bmat||0}, R.meta); },
    hlsort:()=>{ NOTESORT=NOTESORT==='date'?'pos':'date'; LS.set('notesSort',NOTESORT); fillHlStream(); },
    copyall:async()=>{ const txt=momentsCopyText(R.meta); try{ await navigator.clipboard.writeText(txt); toast('Copied'); }catch(e){ toast('Couldn’t copy on this device.'); } },
    expand:(b)=>{ const row=b.closest('.moment-row'); if(!row) return; const on=row.classList.toggle('open'); b.setAttribute('aria-expanded', on?'true':'false'); },
    more:(b)=>{ const nt=b.parentElement && b.parentElement.querySelector('.nt-clamp'); if(nt) nt.classList.remove('nt-clamp'); b.remove(); }
  });
  sheetFocusBack=$('#rToc');
  if(t==='hls'){
    fillHlStream();
    const inp=$('#hlFind');
    if(inp){ inp.addEventListener('input', fillHlStream); setTimeout(()=>inp.focus(), 80); }
  }
  if(t==='toc' && !(tab==='toc' && R.tocOpen && R.tocOpen.fresh===false)) setTimeout(()=>{ const on=$('#sheet .li.on')||$('#sheet .li.open'); on&&on.scrollIntoView({block:'center'}); },30);
}

/* ---------- search ---------- */
function buildSearchIndex(){
  if(R.sIdx) return R.sIdx; let s=''; const off=new Int32Array(R.n);
  for(let k=0;k<R.n;k++){ if(k>0 && !glued(k)) s+=' '; off[k]=s.length; s+=R.words[k].toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"'); }
  return R.sIdx={s,off};
}
function wordAtChar(c){ const off=R.sIdx.off; let lo=0, hi=off.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(off[m]<=c) lo=m; else hi=m-1; } return lo; }
function openSearch(){
  stopActivity();
  setChrome(true);
  openSheet('Search this book', `<input class="input" id="srchIn" type="search" placeholder="Words or a phrase" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"><div id="srchMeta" class="note"></div><div id="srchOut"></div>`, {
    res:(b)=>{ const i=+b.dataset.i, len=+b.dataset.l; closeSheet(); jumpToMoment(i, len); }
  });
  sheetFocusBack=$('#rToc');
  const inp=$('#srchIn'); inp.value=R.lastSearch||''; let t=null;
  inp.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(runSearch,260); });
  setTimeout(()=>inp.focus(),80); if(inp.value) runSearch();
}
function runSearch(){
  const inp=$('#srchIn'); if(!inp) return;
  const q=inp.value.trim().toLowerCase().replace(/\s+/g,' ').replace(/[’‘]/g,"'").replace(/[“”]/g,'"'); R.lastSearch=inp.value.trim();
  const out=$('#srchOut'), meta=$('#srchMeta');
  if(q.length<2){ out.innerHTML=''; meta.textContent=q?'Type at least 2 letters.':''; return; }
  const {s}=buildSearchIndex(); const MAXSHOW=150, MAXCOUNT=5000; const hits=[]; let p=0, total=0;
  while(total<MAXCOUNT){ p=s.indexOf(q,p); if(p<0) break; total++; if(hits.length<MAXSHOW) hits.push(p); p+=q.length; }
  const qWords=q.split(' ').length; const span=(i)=>{ let j=i, n=0; while(j<R.n && n<qWords){ j++; if(!glued(j)) n++; } return Math.max(1,j-i); };
  meta.textContent = total ? `${total>=MAXCOUNT?MAXCOUNT+'+':total} match${total===1?'':'es'}`+(total>MAXSHOW?` · showing the first ${MAXSHOW}`:'') : 'No matches.';
  out.innerHTML=hits.map(c=>{ const i=wordAtChar(c), L=span(i); const a=Math.max(0,i-7), b=Math.min(R.n-1,i+L+9);
    let h=''; for(let k=a;k<=b;k++){ const w=esc(R.words[k]); h+=(k>a&&!glued(k)?' ':'')+(k>=i&&k<i+L?'<mark>'+w+'</mark>':w); }
    const ch=currentChapter(i);
    return `<button class="result" type="button" data-act="res" data-i="${i}" data-l="${L}">${a>0?'…':''}${h}${b<R.n-1?'…':''}<span class="where">${esc(ch?ch.t:'')} · ${Math.round(100*i/Math.max(1,R.n-1))}%</span></button>`; }).join('');
}
function flashFound(i,len){
  if(R.mode==='speed') return;
  const apply=()=>{
    const ws=[];
    for(let k=i;k<i+len;k++){ const w=wordEl(k); if(w){ w.classList.add('found'); ws.push(w); } }
    if(ws[0] && R.mode==='pages'){ const pg=pgPageOfEl(ws[0]); if(pg!==P.page) pgSet(pg,false); }
    /* The bars overlay the page, so a match at the top or bottom would sit under them. Hide the bars so the highlight is visible. Insets stay fixed, so the page does not move. */
    if(ws[0] && R.chrome && R.mode!=='speed'){
      const wr=ws[0].getBoundingClientRect();
      const top=$('#rTop')&&$('#rTop').getBoundingClientRect();
      const foot=$('#rFoot')&&!$('#rFoot').hidden&&getComputedStyle($('#rFoot')).visibility!=='hidden' ? $('#rFoot').getBoundingClientRect() : null;
      if((top && wr.top<top.bottom-2) || (foot && wr.bottom>foot.top+2)) setChrome(false);
    }
    updateChrome();
    setTimeout(()=>ws.forEach(w=>w.classList.remove('found')), 2000);
  };
  requestAnimationFrame(()=>requestAnimationFrame(apply));
}

/* ---------- read aloud ---------- */
const TTS={on:false, utt:null, cur:-1, voices:[], seq:0, mode:false, pick:null, sentA:null, sentB:null};
function voiceTier(v){ const u=(v.voiceURI+' '+v.name).toLowerCase(); if(/premium|enhanced|neural|natural/.test(u)) return 0; if(/eloquence|speech\.synthesis\.voice|bells|bubbles|zarvox|whisper|trinoids|organ|cellos|bahh|boing|jester|superstar|wobble|albert|bad news|good news/.test(u)) return 2; return 1; }
function voiceLabel(v){ let n=v.name.replace(/\s*\((Enhanced|Premium)\)/i,''); const u=(v.voiceURI+' '+v.name).toLowerCase(); const q=/premium/.test(u)?'Premium':/enhanced/.test(u)?'Enhanced':''; const reg=(v.lang||'').split(/[-_]/)[1]; return n+(q?' · '+q:'')+(reg?' ('+reg.toUpperCase()+')':'')+(v.localService===false?' · online':''); }
function voicePreview(){ try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance('This is how your books will sound when Tooz reads them aloud.'); const v=TTS.voices.find(x=>x.voiceURI===S.ttsVoice); if(v){ u.voice=v; u.lang=v.lang; } u.rate=S.ttsRate||1; speechSynthesis.speak(u); }catch(e){ toast('Read aloud isn’t available here.'); } }
function ttsVoices(){ try{ TTS.voices=speechSynthesis.getVoices()||[]; }catch(e){ TTS.voices=[]; } return TTS.voices; }
if('speechSynthesis' in window){ ttsVoices(); try{ speechSynthesis.addEventListener('voiceschanged',ttsVoices); }catch(e){} }
function ttsStart(){
  if(R.mode==='speed') return;
  ttsDismissHint();
  const wantNat=S.ttsEngine!=='system';
  if(!wantNat && !('speechSynthesis' in window)){ toast('Read aloud isn’t available on this device.'); return; }
  stopActivity(); selClear(); TTS.mode=true; ttsPickMark(null); TTS.on=true; TTS.seq++; requestWake(); updateChrome(); asUI();
  /* Natural voice if it's already on the phone (or this book already has saved audio). Otherwise start with the
     phone's own voice right away and offer the better one without blocking. */
  if(wantNat && (natReady() || LS.get('pipReady.'+pipVoice(), false))){ TTS.nat=true; natStart(); return; }
  if(wantNat){ ttsStartPreferNat(); return; }
  TTS.nat=false;
  try{ speechSynthesis.cancel(); }catch(e){}
  ttsSpeakFrom(R.pos, TTS.seq);
}
function ttsStop(){ if(!TTS.on) return; TTS.on=false; TTS.seq++; if(TTS.nat) natClear(); try{ speechSynthesis.cancel(); }catch(e){} ttsMark(-1); releaseWake(); resetClock(); updateChrome(); }
/* start reading again from the current word (after a jump or a voice change) */
function ttsRestart(){
  if(TTS.nat){ if(!natReady() && !abPartAt(R.pos)){ natClear(); natStart(); return; } TTS.seq++; natSpeakFrom(R.pos, TTS.seq); return; }
  TTS.seq++; try{ speechSynthesis.cancel(); }catch(e){} ttsSpeakFrom(R.pos, TTS.seq);
}
function ttsSpeakFrom(i, seq){
  if(!TTS.on || seq!==TTS.seq) return;
  if(i>=R.n){ ttsStop(); toast('Finished reading aloud'); return; }
  const ch=speechChunk(i,70,12); const j=ch.j, text=ch.text, map=ch.map; i=ch.i;
  if(!text){ if(j>=R.n){ ttsStop(); toast('Finished reading aloud'); return; } ttsSpeakFrom(j, seq); return; }
  const t0=performance.now();
  const u=new SpeechSynthesisUtterance(text); u.rate=S.ttsRate;
  const v=TTS.voices.find(x=>x.voiceURI===S.ttsVoice); if(v){ u.voice=v; u.lang=v.lang; } else u.lang=document.documentElement.lang||'en';
  let lastMark=i;
  u.onboundary=(e)=>{ if(seq!==TTS.seq) return; if(e.name && e.name!=='word') return; const c=e.charIndex; let lo=0, hi=map.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(map[m]<=c) lo=m; else hi=m-1; } lastMark=i+lo; ttsMark(lastMark); };
  u.onend=()=>{ if(seq===TTS.seq && TTS.on){ const ms=performance.now()-t0; recordStats(Math.max(500,ms), j-i); ttsLearn(j-i, ms); if(ch.pauseAfter) setTimeout(()=>{ if(seq===TTS.seq && TTS.on) ttsSpeakFrom(j, seq); }, ch.pauseAfter/(S.ttsRate||1)); else ttsSpeakFrom(j, seq); } };
  u.onerror=(e)=>{ if(seq!==TTS.seq) return; if(e.error==='interrupted'||e.error==='canceled') return; ttsStop(); toast('Read aloud stopped ('+(e.error||'error')+').'); };
  TTS.utt=u; ttsMark(i); if(typeof natMedia==='function') natMedia(); speechSynthesis.speak(u);
}
let ttsMoveT=0;
function ttsIsClauseEnd(k){ return /[;:—–]$/.test(R.words[k]||''); }
function ttsSentOf(i){
  const a0=sentStartOf(i); let b0=i; while(b0<R.n-1 && !isSentEnd(b0)) b0++;
  let a=i, b=i;
  while(a>a0 && !ttsIsClauseEnd(a-1)) a--;
  while(b<b0 && !ttsIsClauseEnd(b)) b++;
  /* Cap by word count, not viewport top: CSS columns put later-page words at the same top as the current word. */
  const SPAN=25;
  if(b-a+1>SPAN){
    const back=Math.floor((SPAN-1)/2);
    a=Math.max(a, i-back);
    b=Math.min(b, a+SPAN-1);
  }
  if(R.mode==='pages' && P.topWord!=null && P.k>=0){
    a=Math.max(a, P.topWord);
    if(P.rangeEnd!=null) b=Math.min(b, Math.max(a, P.rangeEnd-1));
  }
  return [a,b];
}
function ttsSentClear(){ if(TTS.sentA==null) return; for(let k=TTS.sentA;k<=TTS.sentB;k++){ const w=wordEl(k); if(w) w.classList.remove('ttssent'); } TTS.sentA=TTS.sentB=null; }
function ttsSentPaint(i){
  if(i==null || i<0){ ttsSentClear(); return; }
  const [a,b]=ttsSentOf(i);
  if(TTS.sentA===a && TTS.sentB===b){
    for(let k=a;k<=b;k++){ const w=wordEl(k); if(w && !w.classList.contains('ttssent')) w.classList.add('ttssent'); }
    return;
  }
  ttsSentClear(); TTS.sentA=a; TTS.sentB=b;
  for(let k=a;k<=b;k++){ const w=wordEl(k); if(w) w.classList.add('ttssent'); }
}
async function ttsMark(k){
  const prev=TTS.cur; TTS.cur=k;
  if(prev>=0){ const p=wordEl(prev); if(p) p.classList.remove('tts'); }
  if(k<0){ ttsSentPaint(-1); return; }
  R.pos=k;
  let w=wordEl(k);
  if(!w){ if(R.mode==='pages') await pgShow(k); else if(R.mode==='scroll') await scShow(k); w=wordEl(k); }
  if(!w) return; w.classList.add('tts'); ttsSentPaint(k);
  if(R.mode==='pages'){ const pg=pgPageOfEl(w); if(pg!==P.page){ pgSet(pg,true); R.anchor=P.topWord; } }
  else if(R.mode==='scroll'){
    /* keep the spoken word no lower than the middle of the screen; only the end of the book lets it go further down */
    const r=w.getBoundingClientRect(), v=scView.getBoundingClientRect(), mid=v.top+v.height*0.5, wc=r.top+r.height/2;
    if(wc>mid || r.top<v.top+8){ scView.scrollTo({top:scView.scrollTop+(wc-mid), behavior: Math.abs(wc-mid)>v.height*0.6?'auto':'smooth'}); }
  }
  const now=performance.now(); if(now-ttsMoveT>800){ ttsMoveT=now; updateChrome(); if(now-R.lastSave>3000) saveProgress(); }
}
/* ---------- read-aloud controls ----------
   The speaker button opens a small floating pill (play/pause and a speed chip). Nothing plays until Play.
   While the pill is open, tapping a word chooses where to start (or jumps there if already playing).
   Swipe the pill to skip a sentence; a long-press opens voice choice and downloads.
   The text clip shrinks by the pill's reserved strip, anchored on the first visible word. */
const TTS_RATES=[0.75,1,1.25,1.5,2];
function ttsRateLabel(v){ const n=+(v||1); return (Math.abs(n-Math.round(n))<1e-9?n.toFixed(1):String(n))+'×'; }
function ttsCycleRate(){
  const cur=+(S.ttsRate||1);
  const eq=TTS_RATES.findIndex(r=>Math.abs(r-cur)<1e-9);
  const next=eq>=0 ? TTS_RATES[(eq+1)%TTS_RATES.length] : (TTS_RATES.find(r=>r>cur+1e-9)||TTS_RATES[0]);
  ttsSetRate(next);
}
function ttsHintUI(){
  const el=$('#ttsHint'); if(!el) return;
  const show=TTS.mode && R.mode!=='speed' && !TTS.on && !LS.get('ttsHintSeen', false);
  if(!show){
    if(el.classList.contains('fade')) return;
    el.classList.remove('show'); el.hidden=true; el.classList.remove('fade');
    return;
  }
  el.hidden=false;
  requestAnimationFrame(()=>el.classList.add('show'));
}
function ttsDismissHint(){
  LS.set('ttsHintSeen', 1);
  const el=$('#ttsHint'); if(!el) return;
  el.classList.remove('show');
  const go=()=>{ el.hidden=true; el.classList.remove('fade','show'); ttsHoldHintUI(); };
  if(el.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches){ go(); return; }
  el.classList.add('fade');
  setTimeout(go, 500);
}
let ttsHoldT=0;
function ttsHoldHintUI(){
  const el=$('#ttsHoldHint'); if(!el) return;
  const show=TTS.mode && R.mode!=='speed' && LS.get('ttsHintSeen', false) && !LS.get('ttsHoldHintSeen', false);
  if(!show){ el.classList.remove('show','fade'); el.hidden=true; return; }
  el.hidden=false;
  requestAnimationFrame(()=>el.classList.add('show'));
  clearTimeout(ttsHoldT);
  ttsHoldT=setTimeout(()=>ttsHideHoldHint(), 5000);
}
function ttsHideHoldHint(immediate){
  LS.set('ttsHoldHintSeen', 1);
  const el=$('#ttsHoldHint'); if(!el) return;
  clearTimeout(ttsHoldT); ttsHoldT=0;
  el.classList.remove('show');
  const go=()=>{ el.hidden=true; el.classList.remove('fade','show'); if(typeof ttsReserveSync==='function') ttsReserveSync(); };
  if(immediate || el.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches){ go(); return; }
  el.classList.add('fade');
  setTimeout(go, 400);
}
let ttsResPx=0;
function ttsLinePad(){
  const host=R.mode==='pages'?pgFlow:scFlow;
  const w=host&&host.querySelector('w');
  let lh=0;
  if(w){
    const cs=getComputedStyle(w);
    lh=parseFloat(cs.lineHeight);
    if(!isFinite(lh) || lh<=0){ const fs=parseFloat(cs.fontSize); lh=(isFinite(fs)?fs:(S.size||18))*(S.lineH||1.4); }
  } else lh=(S.size||18)*(S.lineH||1.4);
  return Math.max(8, Math.round(1.2*lh));
}
function ttsMeasureReservePx(){
  const v=$('#v-reader'), b=$('#ttsBar');
  if(!v || !b || b.hidden) return 0;
  const cur=parseFloat(v.style.getPropertyValue('--tts-reserve'))||0;
  const clip=R.mode==='pages'?$('#pgClip'): scView;
  if(!clip) return 0;
  const defaultBottom=clip.getBoundingClientRect().bottom + cur;
  /* Measure from the pill only. Hints and the voice chip render inside this reserved strip so they never change the page count. */
  const top=stillRect(b).top; /* not moved by the Style's pop-in */
  const pad=ttsLinePad();
  /* Scroll gets one extra line so the last line can rest fully above the pill, not flush against its top. */
  const extra=(R.mode==='scroll')?pad:0;
  return Math.max(0, Math.round(defaultBottom - (top - pad - extra)));
}
function ttsReserveSync(){
  const v=$('#v-reader'), b=$('#ttsBar');
  const on=!!(TTS.mode && R.mode!=='speed' && b && !b.hidden);
  const wasOn=!!(v && v.classList.contains('tts-pill-on'));
  if(v && b && !b.hidden){ const lift=Math.ceil(stillRect(b).height+8); if(lift>0) v.style.setProperty('--tts-chip-lift', lift+'px'); v.style.setProperty('--tts-line-pad', ttsLinePad()+'px'); }
  const next=on?ttsMeasureReservePx():0;
  if(next===ttsResPx && on===wasOn){
    if(v) v.classList.toggle('tts-pill-on', on);
    document.body.classList.toggle('tts-pill-on', on);
    return;
  }
  /* Capture the first visible word *before* the clip changes. If the clip will
     grow (pill closing), add end pad first so the browser cannot clamp scrollTop. */
  if(R.mode==='scroll' && wasOn && (!on || next<ttsResPx) && scView){
    const grow=Math.max(0, (ttsResPx||0)-next);
    const max=Math.max(0, scView.scrollHeight-scView.clientHeight);
    const need=scView.scrollTop - Math.max(0, max-grow);
    if(need>0) scSetEndPad(scEndPad()+need+2);
  }
  if(R.mode==='pages' || R.mode==='scroll') holdPlace(true);
  const keepTop=(R.mode==='scroll' && scView)?scView.scrollTop:null;
  ttsResPx=next;
  if(v) v.style.setProperty('--tts-reserve', next+'px');
  if(v) v.classList.toggle('tts-pill-on', on);
  document.body.classList.toggle('tts-pill-on', on);
  if(R.mode==='pages') relayoutSoon();
  else if(R.mode==='scroll' && scView){
    const i=R.anchor;
    const restore=()=>{
      if(R.mode!=='scroll') return;
      if(i!=null) scKeepWord(i);
      else if(keepTop!=null){
        const max=Math.max(0, scView.scrollHeight-scView.clientHeight);
        if(keepTop>max) scSetEndPad(scEndPad()+(keepTop-max)+2);
        scView.scrollTop=keepTop;
      }
    };
    void scView.offsetHeight;
    restore();
    requestAnimationFrame(restore);
    setTimeout(restore, 50);
  }
}

function ttsModeOn(){
  if(R.mode==='speed') return;
  if(SC.auto) asStop(true);
  selClear(); TTS.mode=true; TTS.pick=null; setChrome(true); updateChrome(); asUI();
  requestAnimationFrame(()=>{ ttsReserveSync(); const p=$('#ttsPlay'); if(p) p.focus(); ttsHoldHintUI(); });
}
function ttsModeOff(quiet){ ttsStop(); ttsPickMark(null); TTS.mode=false; ttsHideNatChip(true); ttsHideHoldHint(true); const t=$('#toast'); if(t) t.hidden=true; updateChrome(); asUI(); ttsReserveSync(); const sp=$('#rTts'); if(!quiet && sp && R.chrome && !$('#v-reader').hidden) sp.focus(); }
function ttsBarUI(){
  const b=$('#ttsBar'); if(!b) return;
  const was=b.hidden;
  b.hidden=!TTS.mode || R.mode==='speed';
  document.body.classList.toggle('tts-pill-on', !b.hidden);
  /* #v-reader.tts-pill-on shrinks the text clip; ttsReserveSync toggles that
     class after it has captured firstVis and added any end pad. */
  ttsHintUI();
  if(b.hidden){ ttsReserveSync(); return; }
  $('#ttsPlay').innerHTML=TTS.on?ICON.pause:ICON.play; $('#ttsPlay').setAttribute('aria-label',TTS.on?'Pause':'Play');
  const label=ttsRateLabel(S.ttsRate||1);
  const lab=$('#ttsLabel'); if(lab) lab.textContent=label;
  $('#ttsSpeed').setAttribute('aria-label','Speaking speed '+label);
  const tr=$('#ttsTrackBar');
  if(tr && R.n){ const i=TTS.on&&TTS.cur>=0?TTS.cur:R.pos; tr.style.width=(100*Math.max(0,i)/Math.max(1,R.n-1))+'%'; }
  if(was) requestAnimationFrame(()=>ttsReserveSync());
  else ttsReserveSync();
}
async function ttsPickMark(k){
  if(TTS.pick!=null){ const w=wordEl(TTS.pick); if(w) w.classList.remove('ttspick'); }
  TTS.pick=k; ttsBarUI(); if(k==null) return;
  let w=wordEl(k);
  if(!w || (R.mode==='pages' && pgPageOfEl(w)!==P.page)){ if(R.mode==='pages') await pgShow(k); else if(R.mode==='scroll') await scShow(k); w=wordEl(k); }
  if(w){ w.classList.add('ttspick'); if(R.mode==='scroll'){ const r=w.getBoundingClientRect(), v=scView.getBoundingClientRect(); if(r.top<v.top+20 || r.bottom>v.bottom-80) scView.scrollTo({top:scView.scrollTop+(r.top-v.top)-v.height*0.3}); } }
}
function ttsPickWord(i){
  if(TTS.on){ R.pos=i; ttsRestart(); return; }
  ttsPickMark(i);
}
function ttsPlayPause(){
  if(TTS.on){ const k=TTS.cur; ttsStop(); if(k>=0) ttsPickMark(k); return; }
  if(TTS.pick!=null) R.pos=TTS.pick;
  ttsStart();
}
function sentStartOf(i){ let k=Math.max(0,i); while(k>0 && !isSentEnd(k-1)) k--; return k; }
function ttsSkip(d){
  const c= TTS.on&&TTS.cur>=0 ? TTS.cur : TTS.pick!=null ? TTS.pick : R.pos;
  let t;
  if(d<0){ const s0=sentStartOf(c); t= c-s0<3 && s0>0 ? sentStartOf(s0-1) : s0; }
  else { let k=c; while(k<R.n-1 && !isSentEnd(k)) k++; t=Math.min(R.n-1,k+1); }
  if(TTS.on){ R.pos=t; ttsRestart(); } else ttsPickMark(t);
}
let ttsRateT=0;
function ttsRateApply(){
  ttsBarUI();
  if(TTS.on && TTS.nat){ natRateChanged(); return; }
  if(TTS.on){ clearTimeout(ttsRateT); ttsRateT=setTimeout(()=>{ if(TTS.on){ R.pos=Math.max(0,TTS.cur); ttsRestart(); } },400); }
}
function ttsSetRate(v){ S.ttsRate=Math.round(clamp(v,0.5,2)*20)/20; saveSettings(); ttsRateApply(); }
$('#rTts').onclick=()=>{ TTS.mode?ttsModeOff():ttsModeOn(); };
$('#ttsPlay').onclick=ttsPlayPause;
$('#ttsPrev').onclick=()=>ttsSkip(-1);
$('#ttsNext').onclick=()=>ttsSkip(1);
$('#ttsVoice').onclick=openVoiceSheet;
$('#ttsSpeed').onclick=()=>{ if(!TTS.pillLock) ttsCycleRate(); };
$('#ttsClose')&&($('#ttsClose').onclick=()=>{ if(!TTS.pillLock) ttsModeOff(); });
$('#ttsPrev').innerHTML=ICON.bsent; $('#ttsNext').innerHTML=ICON.fsent; $('#ttsVoice').innerHTML=ICON.voice;
if($('#ttsClose')) $('#ttsClose').innerHTML=ICON.close;
/* Scroll: the auto-scroll button shows or hides the auto-scroll controls (like the speaker does for read aloud) */
$('#rAs').innerHTML=ICON.autoscroll; $('#asMore').innerHTML=ICON.more; $('#spOpts').innerHTML=ICON.gear;
$('#rAs').onclick=()=>{
  if(S.autoScroll){ if(SC.auto) asStop(true); S.autoScroll=false; }
  else { if(TTS.mode) ttsModeOff(); S.autoScroll=true; }
  saveSettings(); asUI(); updateChrome();
};
$('#asMore').onclick=()=>{ if(SC.auto) asStop(true); openAsOpts(); };
$('#spOpts').onclick=openSpeedOpts;

/* ---------- reading options panel (Aa) ---------- */
const FMT={ lineH:v=>(+v).toFixed(2), dim:v=>v+'%', warmth:v=>v+'%', scrollWpm:v=>v+' wpm', wpm:v=>v+' wpm', rampSecs:v=>v+' sec', charBudget:v=>v+' letters',
  commaPause:v=>(+v).toFixed(1)+'×', sentPause:v=>(+v).toFixed(1)+'×', paraPause:v=>(+v).toFixed(1)+'×', autoRewind:v=>+v?v+' words':'Off', speedSize:v=>v+' px', ttsRate:v=>(+v).toFixed(2)+'×', size:v=>v+' px' };
const LAYOUT_KEYS=new Set(['font','size','lineH','margin','para','justify','hyphen','boldText','wordStart','twoCol']);
const REPANEL_KEYS=new Set(['mode','autoScroll','nightAuto','ramp','multi']);
const pRange=(key,label,min,max,step,desc)=>`<div class="set"><div class="hd"><label for="o_${key}">${label}</label><span class="val" data-val="${key}">${FMT[key]?FMT[key](S[key]):S[key]}</span></div><input type="range" id="o_${key}" data-set="${key}" data-type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}">${desc?`<div class="desc">${desc}</div>`:''}</div>`;
const pToggle=(key,label,desc)=>`<div class="set"><div class="hd"><label for="o_${key}">${label}</label><input type="checkbox" class="switch" id="o_${key}" data-set="${key}" data-type="toggle"${S[key]?' checked':''}></div>${desc?`<div class="desc">${desc}</div>`:''}</div>`;
const pSeg=(key,opts,label,desc)=>`<div class="set">${label?`<div class="hd"><label>${label}</label></div>`:''}<div class="seg" data-set="${key}" data-type="seg" data-accent-group="${key}">${opts.map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${String(S[key])===String(v)}">${l}</button>`).join('')}</div>${desc?`<div class="desc">${desc}</div>`:''}</div>`;
function fontGrid(key){
  key=key||'font';
  /* "Book's font" appears only when this book brings its own font; otherwise "original" means Literata */
  const fam=R.bookFamily||null, bookName=R.text&&R.text.font?R.text.font.family:null;
  const cur=(S[key]==='original' && !fam)?'literata':S[key];
  const same=key==='speedFont'?`<button class="chip" type="button" data-v="same" aria-pressed="${S.speedFont==='same'}" style="font-family:${esc(fontCSS())}">Same<small>as reading font</small></button>`:'';
  const tiles=Object.entries(FONTS).filter(([k])=>k!=='original'||fam).map(([k,f])=>{
    const css= k==='original'? `"${fam}",Georgia,serif` : f.css;
    const label= k==='original'? 'Book’s font' : k==='opendyslexic'?'Open<wbr>Dyslexic':f.label;
    const note= k==='original'? esc(String(bookName||fam).replace(/[-_]+/g,' ').slice(0,20)) : f.note;
    return `<button class="chip${k==='opendyslexic'?' wide':''}" type="button" data-v="${k}" aria-pressed="${cur===k}" style="font-family:${esc(css)}">${label}<small>${note}</small></button>`;
  });
  return `<div class="fontgrid" data-set="${key}" data-type="seg" data-accent-group="${key}">${same}${tiles.join('')}</div>`;
}
/* the Aa sheet: the few things you change most, with the rest folded away underneath */
const AAOPEN=new Set();
const fold=(k,title,body)=>`<details class="aadet" data-k="${k}"${AAOPEN.has(k)?' open':''}><summary>${title}</summary><div class="aadet-b">${body}</div></details>`;
function quickFonts(key){
  const cur=(S[key]==='original' && !R.bookFamily)?'literata':S[key];
  const pick=[cur]; for(const k of ['literata','newyork','georgia','lexend','atkinson']){ if(pick.length>=4) break; if(k!==cur && FONTS[k]) pick.push(k); }
  if(key==='speedFont' && !pick.includes('same')) pick[pick.length-1]='same';
  return `<div class="fontrow" data-set="${key}" data-type="seg" data-accent-group="${key}">${pick.map(k=>{ const f=k==='same'?{label:'Same',css:fontCSS()}:k==='original'?{label:'Book’s',css:`"${R.bookFamily}",Georgia,serif`}:FONTS[k]; return `<button type="button" data-v="${k}" aria-pressed="${(key==='speedFont'?S.speedFont:cur)===k}" style="font-family:${esc(f.css)}">${k==='opendyslexic'?'Dyslexic':f.label}</button>`; }).join('')}</div>`;
}
function panelHTML(){
  const m=S.mode;
  const themeKeys=['auto',...Object.keys(THEMES)];
  const swatch=(k)=>{ const T=THEMES[k]; return T?`background:${T.bg};color:${T.ink}`:`background:linear-gradient(135deg,${THEMES[autoDay()].bg} 50%,${THEMES.dark.bg} 50%);color:${THEMES[autoDay()].ink}`; };
  /* Match phone's Aa is painted in two inks along the same diagonal (day ink | Dark's ink), so it reads on both halves */
  const aa=(k)=>THEMES[k]?'Aa':`<span class="aa2" style="background-image:linear-gradient(135deg,${THEMES[autoDay()].ink} 50%,${THEMES.dark.ink} 50%)">Aa</span>`;
  const sizeKey=m==='speed'?'speedSize':'size';
  const sizeRow=`<div class="aarow"><span class="aalbl">${m==='speed'?'Word size':'Text size'}</span><div class="stepper"><button type="button" data-step="${sizeKey}" data-d="${m==='speed'?-2:-1}" data-min="${m==='speed'?24:12}" data-max="${m==='speed'?72:40}" aria-label="Smaller" style="font-size:.85rem">A</button><span class="v" data-val="${sizeKey}">${S[sizeKey]} px</span><button type="button" data-step="${sizeKey}" data-d="${m==='speed'?2:1}" data-min="${m==='speed'?24:12}" data-max="${m==='speed'?72:40}" aria-label="Larger" style="font-size:1.25rem">A</button></div></div>`;
  let h=`<div class="panel-sec">${pSeg('mode',[['pages','Pages'],['scroll','Scroll'],['speed','Speed']])}</div>
  <div class="panel-sec aaquick">
    ${sizeRow}
    <div class="themes" data-set="theme" data-type="seg" data-accent-group="theme">${themeKeys.map(k=>`<button type="button" data-v="${k}" aria-pressed="${S.theme===k}" style="${swatch(k)}" aria-label="${k==='auto'?'Match phone':THEMES[k].label}">${aa(k)}</button>`).join('')}
      <div class="lbl">${themeKeys.map(k=>`<span>${k==='auto'?'Phone':THEMES[k].label}</span>`).join('')}</div></div>
    ${quickFonts(m==='speed'?'speedFont':'font')}
  </div>`;
  if(m!=='speed'){
    h+=fold('text','More text options',`${fontGrid()}
      <div class="group">
      ${pRange('lineH','Line spacing',1.2,2.2,0.05)}
      ${pSeg('margin',[['narrow','Narrow'],['normal','Normal'],['wide','Wide']],'Margins')}
      ${pSeg('para',[['indent','Indented'],['spaced','Spaced'],['both','Spaced and indented']],'Paragraphs')}
      ${pToggle('justify','Justify text')}
      ${pToggle('hyphen','Hyphenation','Breaks long words at line ends for even spacing.')}
      ${pToggle('boldText','Bold text')}
      ${pToggle('wordStart','Word-start emphasis','Bolds the first part of each word to guide your eyes.')}
      </div>`);
  } else {
    h+=fold('word','Word display',`${fontGrid('speedFont')}<div class="group">
      <div class="set"><div class="hd"><label>Focus letter color</label></div><div class="chips" data-set="focusColor" data-type="seg" data-accent-group="focusColor" style="align-items:center">${COLORS.map(([n,c])=>`<button class="swatch" type="button" data-v="${c}" aria-label="${n}" aria-pressed="${S.focusColor.toLowerCase()===c.toLowerCase()}" style="background:${c}"></button>`).join('')}<label class="note" style="display:flex;align-items:center;gap:8px">Custom <input type="color" data-set="focusColor" data-type="text" value="${esc(S.focusColor)}"></label></div></div>
      ${pToggle('context','Show the sentence when paused')}
      ${pToggle('boldText','Bold text')}
      </div>
      <p class="note" style="margin:6px 0 0">Speed, pauses and the speed ramp are under ${ICON.gear} on the Speed controls.</p>`);
  }
  if(m==='pages') h+=fold('pages','Pages',`<div class="group">
      ${pSeg('turn',[['slide','Slide'],['fade','Fade'],['none','None']],'Page turn')}
      ${pSeg('tapZones',[['edges','Edges'],['anywhere','Anywhere']],'Tap to turn', S.tapZones==='edges'?'Tap the left or right edge to turn. Tap the middle to show or hide controls.':'Tap the left third to go back, anywhere else to go forward. Tap the top to show or hide controls.')}
      ${pToggle('twoCol','Two pages side by side when wide','On an iPad or a phone turned sideways.')}
      ${pToggle('focus','Hide controls while reading','Tap the middle of the page to bring them back.')}
    </div>`);
  if(m==='scroll') h+=fold('scroll','Scrolling',`<div class="group">
      ${pToggle('focus','Hide controls while reading','Tap the page to bring them back.')}
    </div>
    <p class="note" style="margin:6px 0 0">Auto-scroll has its own button at the bottom of the page.</p>`);
  return h;
}
/* light settings live on the Settings page (they apply everywhere) */
function lightHTML(){ return `<div class="group">
      ${pRange('dim','Dim',0,80,5,'Darkens the page beyond the phone’s lowest brightness.')}${pRange('warmth','Warmth',0,100,5,'Adds a warm tint for night reading.')}
      ${pToggle('nightAuto','Switch theme at night')}
      ${S.nightAuto?`<div class="set"><div class="timerow">From <input class="input" type="time" data-set="nightFrom" data-type="text" value="${esc(S.nightFrom)}"> to <input class="input" type="time" data-set="nightTo" data-type="text" value="${esc(S.nightTo)}"></div>${pSeg('nightTheme',[['sepia','Sepia'],['gray','Gray'],['dark','Dark'],['black','Black']],'Night theme')}</div>`:''}
    </div>`; }
/* Speed controls → ⚙︎ */
function speedOptsHTML(){
  return `<div class="group">
      ${pRange('wpm','Reading speed',100,1000,10)}
      ${pToggle('ramp','Speed ramp','Starts at 60% of your speed each time you press play and eases up.')}
      ${S.ramp?pRange('rampSecs','Ramp length',2,20,1):''}
      ${pToggle('multi','Show 2–3 words at once','Groups short words. A long word always gets its own flash.')}
      ${S.multi?pRange('charBudget','Group width',8,24,1,'Most letters (with spaces) shown in one flash.'):''}
      ${pToggle('adaptive','Adaptive pacing','Slows a little on long sentences and long words, speeds up on easy stretches.')}
    </div>
    <h3 class="subh">Pauses</h3><div class="group">
      ${pRange('commaPause','After commas and dashes',1,4,0.1)}
      ${pRange('sentPause','At the end of a sentence',1,4,0.1)}
      ${pRange('paraPause','At the end of a paragraph',1,5,0.1)}
      ${pToggle('longWord','Extra time on long words','Words over 7 letters stay on screen a little longer.')}
      ${pRange('autoRewind','Rewind when resuming',0,10,1,'After a pause, play backs up this many words. Jumps never rewind.')}
    </div>`;
}
function openSpeedOpts(){ if(R.playing) pause(); openSheet('Speed reading options', speedOptsHTML(), {}); $('#sheet .sheet-body').dataset.sheet='speed'; bindPanel(); }
/* auto-scroll bar → ⋯ */
function asOptsHTML(){ return `<div class="group">
    ${pToggle('asRamp','Ease into speed','Starts slower and builds to full speed over a few seconds.')}
    ${pToggle('asPauses','Pause at pictures and headings','Holds for a moment so you can take them in.')}
    ${pToggle('adaptive','Adaptive pacing','Slows a little on long sentences and long words, speeds up on easy stretches.')}
  </div>`; }
function openAsOpts(){ openSheet('Auto-scroll options', asOptsHTML(), {}); $('#sheet .sheet-body').dataset.sheet='as'; bindPanel(); }
/* audio controls → voice button */
function voiceSheetHTML(){ const lang=(document.documentElement.lang||'en').slice(0,2).toLowerCase(); return voiceSectionHTML(lang)+(R.meta?abSectionHTML():''); }
function openVoiceSheet(){ const t=$('#toast'); if(t) t.hidden=true; if(typeof ttsHideNatChip==='function') ttsHideNatChip(true); if(typeof ttsHideHoldHint==='function') ttsHideHoldHint(true); openSheet('Voice', voiceSheetHTML(), Object.assign({},READ_ACTS,AB_ACTS)); $('#sheet .sheet-body').dataset.sheet='voice'; bindPanel(); setTimeout(()=>{ natStateUI(); abUI(); },0); }
/* actions shared by the Aa menu and the reading section of Settings */
const READ_ACTS={
  vprev:()=>{ if(TTS.on) ttsStop(); if(S.ttsEngine!=='system') natPreview(); else voicePreview(); },
  kokget:async()=>{ if(await natEnsure()){ toast('Natural voice is ready'); } natStateUI(); },
  kokdel:async()=>{ if(TTS.on) ttsStop(); await natRemove(); toast('Voice download removed'); natStateUI(); },
  resetlook:()=>{ resetReading(); refreshPanel(); toast('Reading options reset'); }
};
function openPanel(){
  if(R.mode==='speed' && R.playing) pause();
  if(SC.auto) asStop(true);
  setChrome(true);
  openSheet('Reading options', panelHTML(), READ_ACTS, 'short');
  $('#sheet .sheet-body').dataset.aa='1';
  bindPanel();
  sheetFocusBack=$('#rAa');
  requestAnimationFrame(fitAaSheetForWord);
}
/* Keep the Speed word box in the gap above the Aa sheet so size changes stay visible. */
function fitAaSheetForWord(){
  const sh=$('#sheet'); if(!sh) return;
  const aa=sh.querySelector('.sheet-body[data-aa="1"]');
  if(sh.hidden || !aa || R.mode!=='speed' || $('#v-reader').hidden){
    if(sh.style.maxHeight) sh.style.maxHeight='';
    return;
  }
  const word=$('#word'); if(!word) return;
  const wr=word.getBoundingClientRect();
  const below=Math.round(window.innerHeight - wr.bottom - 16);
  const minH=Math.min(200, Math.round(window.innerHeight*0.4));
  const maxH=Math.round(window.innerHeight*0.86);
  const room=Math.max(minH, Math.min(maxH, below>0?below:minH));
  sh.style.maxHeight=Math.max(room, minH)+'px';
}
/* re-draw whichever reading controls are on screen (the Aa menu, the Settings page section) */
function refreshPanel(){
  const ls=$('#lightSet'); if(ls && ls.offsetParent!==null) ls.innerHTML=lightHTML();
  const body=$('#sheet .sheet-body'); if(!body || $('#sheet').hidden) return;
  const html= body.dataset.aa? panelHTML() : body.dataset.sheet==='speed'? speedOptsHTML() : body.dataset.sheet==='as'? asOptsHTML() : body.dataset.sheet==='voice'? voiceSheetHTML() : null;
  if(html==null) return;
  const st=body.scrollTop; body.innerHTML=html; body.scrollTop=st; if(body.dataset.sheet==='voice'){ natStateUI(); abUI(); }
}
/* Aa → More settings: the Settings page over the book, with a way back */
function openSettingsFromReader(){
  closeSheet(); if(TTS.on) ttsStop();
  R.inSet=true; for(const x of VIEWS) $('#v-'+x).hidden=(x!=='settings'); $('#v-reader').hidden=true; $('#tabs').hidden=true;
  renderSettings(); requestAnimationFrame(()=>{ const r=$('#readHead'); if(r) r.scrollIntoView({block:'start'}); });
}
function backToBook(){
  R.inSet=false; $('#v-settings').hidden=true; $('#v-reader').hidden=false; $('#tabs').hidden=true;
  holdPlace(); applyLook(); relayoutSoon(); updateChrome();
}
function resetReading(){
  const keep={linkService:S.linkService, goalMins:S.goalMins, measuredWpm:S.measuredWpm, info:S.info, style:S.style};
  Object.assign(S, DEFAULTS, keep, {mode:S.mode}); saveSettings(); applyLook(); setWpm(S.wpm); asUI(); relayoutSoon();
}
function afterSet(key){
  saveSettings();
  if(key==='mode'){ refreshPanel(); switchMode(S.mode).then(()=>{ refreshPanel(); fitAaSheetForWord(); }); return; }
  if(key==='wpm') setWpm(S.wpm);
  if(key==='scrollWpm'||key==='autoScroll'){ if(!S.autoScroll && SC.auto) asStop(true); asUI(); }
  if(key==='focus') setChrome(true);
  if(key==='ttsEngine'){ if(TTS.on) ttsStop(); refreshPanel(); return; }
  if(key==='ttsRate'){ ttsRateApply(); }
  if(key==='pipVoice'){ setTimeout(natStateUI,0); const el=$('#kokSpeed'); if(el) el.textContent='The first sample also shows how quickly this phone can make speech.'; }
  if((key==='pipVoice'||key==='ttsVoice') && TTS.on){ clearTimeout(TTS.restartT); TTS.restartT=setTimeout(()=>{ if(TTS.on) ttsRestart(); },400); }
  applyLook();
  if(key==='speedSize'||key==='focusColor'||key==='boldText'){ if(R.mode==='speed') showChunk(R.pos); }
  requestAnimationFrame(fitAaSheetForWord);
  if((key==='font'||key==='speedFont') && R.mode==='speed'){ document.fonts&&document.fonts.ready.then(()=>{ if(R.mode==='speed'){ showChunk(R.pos); syncScroll(true); } }); }
  if(key==='context' && R.mode==='speed') renderContext();
  if(LAYOUT_KEYS.has(key) && R.mode!=='speed') relayoutSoon();
  if(key==='focus' && R.mode!=='speed'){ $('#v-reader').classList.toggle('overlay', !!S.focus && !TTS.mode); }
  if(REPANEL_KEYS.has(key)) refreshPanel();
  if(key==='tapZones') refreshPanel();
  updateChrome();
}
function bindPanel(root){
  const body=root||$('#sheet .sheet-body'); if(!body || body.dataset.bound) return; body.dataset.bound='1';
  body.addEventListener('toggle',e=>{ const d=e.target; if(d.matches && d.matches('details[data-k]')){ if(d.open) AAOPEN.add(d.dataset.k); else AAOPEN.delete(d.dataset.k); } },true);
  body.addEventListener('input',e=>{
    const t=e.target; const key=t.dataset.set; if(!key) return;
    if(t.dataset.type==='range'){ S[key]=+t.value; const v=body.querySelector(`[data-val="${key}"]`); if(v) v.textContent=FMT[key]?FMT[key](S[key]):S[key]; afterSet(key); }
    else if(t.dataset.type==='text' && t.type==='color'){ S[key]=t.value; afterSet(key); }
  });
  body.addEventListener('change',e=>{
    const t=e.target; const key=t.dataset.set; if(!key) return;
    if(t.dataset.type==='toggle'){ S[key]=t.checked; afterSet(key); }
    else if(t.dataset.type==='text'){ S[key]=t.value; afterSet(key); }
  });
  body.addEventListener('click',e=>{
    const st=e.target.closest('[data-step]');
    if(st){ const key=st.dataset.step; S[key]=clamp(S[key]+(+st.dataset.d),+(st.dataset.min||12),+(st.dataset.max||40)); const v=body.querySelector(`[data-val="${key}"]`); if(v) v.textContent=FMT[key](S[key]); afterSet(key); return; }
    const b=e.target.closest('button[data-v]'); if(!b) return; const grp=b.closest('[data-set]'); if(!grp||grp.dataset.type!=='seg') return;
    const key=grp.dataset.set; let v=b.dataset.v; if(typeof DEFAULTS[key]==='number') v=+v;
    S[key]=v; grp.querySelectorAll('button[data-v]').forEach(x=>x.setAttribute('aria-pressed', x===b)); afterSet(key);
  });
}
$('#rAa').onclick=openPanel;
$('#rToc').onclick=()=>openToc('toc');
$('#markBtn').onclick=()=>openToc('hls');
/* night theme switch and phone light/dark changes */
setInterval(()=>{ if(S.nightAuto) applyLook(); },60000);
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>applyLook()); }catch(e){}
