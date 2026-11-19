/* ---------- the Guide (v39): one accent blob that always sits where you look or tap next ----------
   One fixed, aria-hidden, pointer-events:none layer above every view. The blob is purely visual: it never takes a tap,
   focus or VoiceOver, and it never sits on the reading text. Screens call guideTo(targets, {main}) when they appear.
   A target is an element or {el, kind}: 'fill' (the blob becomes the element's own fill: it lands in the element's exact
   rect and radius, then hands off to the real fill), 'mark' (a small pill under the element), 'thumb' (a range's
   thumb) or 'strip' (the reader's bottom reserved strip, at your progress). Rects are read once per flight; every frame
   of a flight is transform and opacity only (Web Animations, on the compositor). How it moves comes from the Style's
   CSS variables (--guide-dur, --guide-ease, --guide-stretch, --guide-squish, --guide-tail, --guide-fly), never from JS. */
const GUIDE={on:true, layer:null, shapes:[], cur:0, blob:null, tail:null, splits:[], rest:null, extras:[], token:0,
  anims:[], flying:false, lifted:false, liftTimer:0, offEls:new Set(), tour:null, raf:0, frames:null};
const GUIDE_MAX=3;
function guideCss(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function guideNum(name, def){ const v=parseFloat(guideCss(name)); return isFinite(v)?v:def; }
function guideMs(name, def){ const s=guideCss(name); const v=parseFloat(s); if(!isFinite(v)) return def; return /ms$/.test(s)?v:(/s$/.test(s)?v*1000:v); }
function guideParams(){
  return { dur:guideMs('--guide-dur',350), ease:guideCss('--guide-ease')||'ease-out', stretch:guideNum('--guide-stretch',.1),
    squish:guideNum('--guide-squish',0), tail:guideNum('--guide-tail',.06), fly:guideNum('--guide-fly',1)>0,
    size:guideNum('--guide-size',26), fade:guideMs('--guide-fade',160) };
}
function guideMount(){
  if(GUIDE.layer && GUIDE.layer.isConnected) return GUIDE.layer;
  let L=document.getElementById('guide');
  if(!L){ L=document.createElement('div'); L.id='guide'; document.body.appendChild(L); }
  L.setAttribute('aria-hidden','true'); L.innerHTML='';
  const mk=(cls)=>{ const o=document.createElement('div'); o.className='gpos '+cls; const i=document.createElement('i'); i.className='gbody'; o.appendChild(i); L.appendChild(o); return o; };
  GUIDE.shapes=[mk('gshape'), mk('gshape')];
  GUIDE.tail=mk('gtail'); GUIDE.blob=mk('gblob');
  GUIDE.splits=[mk('gsplit'), mk('gsplit')];
  GUIDE.layer=L; GUIDE.cur=0;
  return L;
}
function guideNorm(t){
  if(!t) return null;
  if(t.nodeType===1) return {el:t, kind:'mark'};
  if(t.el) return {el:t.el, kind:t.kind||'mark'};
  return null;
}
/* where an element will rest: stillRect, and any entrance still running on it or a parent (the pill's pop, a sheet's
   settle) is read at its end state for this one measurement, then put back exactly where it was (no visible change) */
function guideStillRect(el){
  const held=[];
  for(let a=el; a && a!==document.body; a=a.parentElement){
    let list=[]; try{ list=a.getAnimations(); }catch(e){}
    for(const an of list){
      if(an.playState==='finished' || an.playState==='idle') continue;
      const tg=an.effect && an.effect.target; if(GUIDE.layer && tg && GUIDE.layer.contains(tg)) continue;
      const end=an.effect && an.effect.getComputedTiming().endTime; if(!isFinite(end)) continue;
      held.push([an, an.currentTime]); try{ an.currentTime=end; }catch(e){}
    }
  }
  const r=stillRect(el);
  for(const [an,t] of held) try{ an.currentTime=t; }catch(e){}
  return r;
}
/* the box the blob takes for a target, or null when the target isn't on screen */
function guideBox(t){
  const el=t&&t.el; if(!el || !el.isConnected) return null;
  if(el.closest('[hidden]')) return null;
  const r=guideStillRect(el); if(r.width<1 || r.height<1) return null;
  const cs=getComputedStyle(el);
  if(t.kind==='fill'){
    return {x:r.left, y:r.top, w:r.width, h:r.height, rad:[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' '), bg:cs.backgroundColor, fill:true};
  }
  if(t.kind==='thumb'){
    const mn=+el.min||0, mx=+el.max||1, v=+el.value||0, f=mx>mn?Math.min(1,Math.max(0,(v-mn)/(mx-mn))):0;
    const th=16, d=14, cx=r.left+th/2+f*(r.width-th), cy=r.top+r.height/2;
    return {x:cx-d/2, y:cy-d/2, w:d, h:d, rad:'50%', bg:'', fill:false};
  }
  if(t.kind==='strip'){
    const sc=$('#rScrub'); const mn=sc?(+sc.min||0):0, mx=sc?(+sc.max||1):1, v=sc?(+sc.value||0):0, f=mx>mn?Math.min(1,Math.max(0,(v-mn)/(mx-mn))):0;
    const w=14, h=3, pad=20, cx=r.left+pad+f*Math.max(0,r.width-pad*2);
    return {x:cx-w/2, y:r.bottom-h-1, w, h, rad:'2px', bg:'', fill:false};
  }
  /* mark: a short pill just under the element (centred), clear of its label */
  const w=Math.max(12, Math.min(28, r.width*.5)), h=4;
  return {x:r.left+r.width/2-w/2, y:Math.min(innerHeight-h-2, r.bottom+4), w, h, rad:'2px', bg:'', fill:false};
}
const guideC=b=>({x:b.x+b.w/2, y:b.y+b.h/2});
const guideSame=(a,b)=>a && b && Math.abs(a.x-b.x)<2 && Math.abs(a.y-b.y)<2 && Math.abs(a.w-b.w)<2 && Math.abs(a.h-b.h)<2;
function guideOff(el, on){
  if(!el) return;
  if(on){ el.classList.add('guide-off'); GUIDE.offEls.add(el); }
  else { el.classList.remove('guide-off'); GUIDE.offEls.delete(el); }
}
function guideClearOff(keep){ for(const el of [...GUIDE.offEls]) if(el!==keep) guideOff(el,false); }
function guideCancel(){ for(const a of GUIDE.anims) try{ a.cancel(); }catch(e){} GUIDE.anims=[]; GUIDE.flying=false; }
function guideAnim(el, kf, o){ const a=el.animate(kf, Object.assign({fill:'forwards'}, o)); GUIDE.anims.push(a); return a; }
/* place a shape element exactly on a box (static styles; only at phase boundaries, never per frame) */
function guideShapeAt(s, b, opacity){
  s.style.width=b.w+'px'; s.style.height=b.h+'px';
  s.style.transform=`translate(${b.x}px,${b.y}px)`;
  const i=s.firstChild; i.style.borderRadius=b.rad; i.style.background=b.fill&&b.bg?b.bg:''; i.style.transform='none';
  i.style.opacity=String(opacity);
}
function guideDot(o, x, y, d, op, sc){
  o.style.width=d+'px'; o.style.height=d+'px'; o.style.transform=`translate(${x-d/2}px,${y-d/2}px)`;
  const i=o.firstChild; i.style.borderRadius='50%'; i.style.background=''; i.style.opacity=String(op); i.style.transform=`scale(${sc==null?1:sc})`;
}
function guideHideAll(exceptShape){
  for(const s of GUIDE.shapes) if(s!==exceptShape) s.firstChild.style.opacity='0';
  for(const o of [GUIDE.blob, GUIDE.tail, ...GUIDE.splits]) o.firstChild.style.opacity='0';
}
/* settle on a target with no motion: the shape sits on the box; on a fill it hands off to the real fill at once */
function guideRest(t, b){
  const s=GUIDE.shapes[GUIDE.cur];
  guideHideAll(s);
  guideShapeAt(s, b, b.fill?0:1);
  guideClearOff(null);
  GUIDE.rest={t, b}; GUIDE.flying=false; GUIDE.lifted=false;
  if(GUIDE.layer) GUIDE.layer.dataset.at=b.fill?'fill':(t.kind||'mark');
}
/* where the blob is right now (its centre), mid-flight included */
function guideNow(){
  if(GUIDE.flying || GUIDE.lifted){
    const o=GUIDE.blob, m=new DOMMatrixReadOnly(getComputedStyle(o).transform==='none'?undefined:getComputedStyle(o).transform);
    const d=parseFloat(o.style.width)||26; return {x:m.m41+d/2, y:m.m42+d/2, mid:true};
  }
  if(GUIDE.rest){ const c=guideC(GUIDE.rest.b); return {x:c.x, y:c.y, mid:false}; }
  return null;
}
/* the fill gathers into a blob (on a tap of Continue) and waits there for the next screen */
function guideLift(el){
  if(!GUIDE.on || !GUIDE.rest) return;
  const P=guideParams(); const rb=GUIDE.rest.b; const c=guideC(rb);
  const tok=++GUIDE.token; guideCancel(); guideMergeNow();
  const s=GUIDE.shapes[GUIDE.cur], d=P.size;
  if(rb.fill){ guideShapeAt(s, rb, 1); guideOff(GUIDE.rest.t.el, true); }
  guideDot(GUIDE.blob, c.x, c.y, d, 0, .35);
  GUIDE.lifted=true;
  if(!P.fly){
    guideAnim(s.firstChild, [{opacity:1},{opacity:0}], {duration:P.fade, easing:'ease-out'});
    GUIDE.blob.firstChild.style.transform='none';
    guideAnim(GUIDE.blob.firstChild, [{opacity:0},{opacity:1}], {duration:P.fade, delay:P.fade*.5, easing:'ease-out'});
  }else{
    const L=Math.max(90, P.dur*.3);
    guideAnim(s.firstChild, [{opacity:1, transform:'scale(1)'},{opacity:0, transform:`scale(${Math.max(.2,Math.min(1,d/rb.w*1.6))},${Math.max(.3,Math.min(1,d/rb.h))})`}], {duration:L, easing:'ease-in'});
    guideAnim(GUIDE.blob.firstChild, [{opacity:0, transform:'scale(.35)'},{opacity:1, transform:'scale(1.12)', offset:.7},{opacity:1, transform:'scale(1)'}], {duration:L, easing:'ease-out'});
  }
  clearTimeout(GUIDE.liftTimer);
  GUIDE.liftTimer=setTimeout(()=>{ if(tok===GUIDE.token && GUIDE.lifted) guideScreen(); }, 1600); /* the open didn't happen: go back */
}
/* fly from where the blob is to box b of target t */
function guideFly(t, b, tok){
  const P=guideParams(), d=P.size, now=guideNow();
  const fromRest=!now.mid && GUIDE.rest; const rb=fromRest?GUIDE.rest.b:null;
  const src=fromRest?GUIDE.rest.t.el:null;
  const old=GUIDE.shapes[GUIDE.cur]; GUIDE.cur=1-GUIDE.cur; const s=GUIDE.shapes[GUIDE.cur];
  guideCancel(); GUIDE.flying=true; GUIDE.lifted=false; clearTimeout(GUIDE.liftTimer);
  if(GUIDE.layer) GUIDE.layer.dataset.at='flight';
  const f=now, to=guideC(b);
  const dx=to.x-f.x, dy=to.y-f.y, dist=Math.hypot(dx,dy), th=Math.atan2(dy,dx)*180/Math.PI;
  const D=P.dur*(dist<40?.7:1);
  const L=fromRest?.22:0, A=L, B=fromRest?.78:.72;          /* lift | travel | land (fractions of the flight) */
  const st=Math.min(.7, P.stretch*Math.min(1, dist/220)), sq=P.squish;
  guideClearOff(null);
  /* the leaving shape: on a fill it takes over from the real fill, then shrinks into the blob */
  for(const x of GUIDE.shapes) if(x!==old) x.firstChild.style.opacity='0';
  if(fromRest){
    guideShapeAt(old, rb, 1);
    if(rb.fill && src) guideOff(src, true);
    guideAnim(old.firstChild, [{opacity:1, transform:'scale(1)'},{opacity:0, transform:`scale(${Math.max(.2,Math.min(1,d/rb.w*1.6))},${Math.max(.3,Math.min(1,d/rb.h))})`, offset:A},{opacity:0, transform:'scale(.2)'}], {duration:D, easing:'ease-in'});
  } else old.firstChild.style.opacity='0';
  /* the arriving target's own fill stays hidden until the blob has landed, so there is only ever one accent blob */
  if(b.fill) guideOff(t.el, true);
  const T=(x,y)=>`translate(${x-d/2}px,${y-d/2}px)`;
  guideDot(GUIDE.blob, f.x, f.y, d, fromRest?0:1, 1);
  guideAnim(GUIDE.blob, [{transform:T(f.x,f.y), offset:0},{transform:T(f.x,f.y), offset:A, easing:P.ease},{transform:T(to.x,to.y), offset:B},{transform:T(to.x,to.y), offset:1}], {duration:D});
  const R0=`rotate(${th}deg)`;
  const body=[
    {offset:0, opacity:fromRest?0:1, transform:`${R0} scale(${fromRest?.35:1})`},
    {offset:A, opacity:1, transform:`${R0} scale(1)`, easing:'ease-in'},
    {offset:A+(B-A)*.45, opacity:1, transform:`${R0} scale(${1+st},${1-st*.45})`, easing:'ease-out'},
    {offset:B, opacity:1, transform:`${R0} scale(${1-sq},${1+sq*.8})`, easing:'ease-out'},
    {offset:B+(1-B)*.5, opacity:.9, transform:`${R0} scale(${1+sq*.35},${1-sq*.2})`},
    {offset:1, opacity:0, transform:`${R0} scale(${Math.max(.4,Math.min(1.4,Math.min(b.w,b.h)/d))})`}
  ];
  guideAnim(GUIDE.blob.firstChild, body, {duration:D, easing:'linear'});
  /* the tail: a smaller drop on the same path that lags and catches up */
  const lag=Math.min(.16, P.tail), td=d*.74;
  const TT=(x,y)=>`translate(${x-td/2}px,${y-td/2}px)`;
  guideDot(GUIDE.tail, f.x, f.y, td, 0, 1);
  if(lag>0.001 && dist>20){
    guideAnim(GUIDE.tail, [{transform:TT(f.x,f.y), offset:0},{transform:TT(f.x,f.y), offset:Math.min(B,A+lag), easing:P.ease},{transform:TT(to.x,to.y), offset:Math.min(1,B+lag*.6)},{transform:TT(to.x,to.y), offset:1}], {duration:D});
    guideAnim(GUIDE.tail.firstChild, [{offset:0, opacity:0, transform:'scale(.6)'},{offset:A, opacity:0, transform:'scale(.6)'},{offset:Math.min(B,A+lag), opacity:.95, transform:'scale(1)'},{offset:Math.min(1,B+lag*.6), opacity:0, transform:'scale(.5)'},{offset:1, opacity:0, transform:'scale(.5)'}], {duration:D, easing:'linear'});
  }
  /* landing: the target's exact shape grows out of the blob */
  guideShapeAt(s, b, 0);
  const sx=Math.min(1,d/b.w), sy=Math.min(1,d/b.h);
  const land=guideAnim(s.firstChild, [{offset:0, opacity:0, transform:`scale(${sx},${sy})`},{offset:B, opacity:0, transform:`scale(${sx},${sy})`, easing:'ease-out'},{offset:Math.min(1,B+(1-B)*.55), opacity:1},{offset:1, opacity:1, transform:'scale(1)'}], {duration:D, easing:'linear'});
  return land.finished.then(()=>{
    if(tok!==GUIDE.token) return false;
    guideCancel();
    guideHideAll(s); guideShapeAt(s, b, 1);
    GUIDE.rest={t, b};
    if(GUIDE.layer) GUIDE.layer.dataset.at=b.fill?'fill':(t.kind||'mark');
    if(b.fill){ /* hand-off: the real fill comes back under the identical shape, which then fades */
      guideOff(t.el, false);
      guideAnim(s.firstChild, [{opacity:1},{opacity:0}], {duration:120, easing:'ease-out'}).finished.then(()=>{ if(tok===GUIDE.token){ guideCancel(); s.firstChild.style.opacity='0'; } }).catch(()=>{});
    }
    return true;
  }).catch(()=>false);
}
/* with Reduce Motion: fade out at the old spot, fade in at the new one (opacity only) */
function guideFade(t, b, tok){
  const P=guideParams();
  const old=GUIDE.shapes[GUIDE.cur]; GUIDE.cur=1-GUIDE.cur; const s=GUIDE.shapes[GUIDE.cur];
  const prev=GUIDE.rest; guideCancel(); GUIDE.flying=true; clearTimeout(GUIDE.liftTimer);
  const wasLift=GUIDE.lifted; GUIDE.lifted=false;
  guideClearOff(null);
  for(const o of [GUIDE.blob, GUIDE.tail, ...GUIDE.splits]) if(!(wasLift && o===GUIDE.blob)) o.firstChild.style.opacity='0';
  const outEl=wasLift?GUIDE.blob.firstChild:old.firstChild;
  if(!wasLift && prev){ guideShapeAt(old, prev.b, 1); if(prev.b.fill) guideOff(prev.t.el, true); }
  if(b.fill) guideOff(t.el, true);
  guideShapeAt(s, b, 0);
  const startOp=+getComputedStyle(outEl).opacity||0;
  guideAnim(outEl, [{opacity:startOp},{opacity:0}], {duration:P.fade, easing:'ease-out'});
  if(prev && prev.b.fill) setTimeout(()=>{ if(tok===GUIDE.token) guideOff(prev.t.el,false); }, P.fade);
  const a=guideAnim(s.firstChild, [{opacity:0},{opacity:1}], {duration:P.fade, delay:P.fade, easing:'ease-out'});
  return a.finished.then(()=>{
    if(tok!==GUIDE.token) return false;
    guideCancel(); guideHideAll(s); guideShapeAt(s, b, b.fill?0:1);
    if(b.fill) guideOff(t.el, false);
    GUIDE.rest={t, b}; if(GUIDE.layer) GUIDE.layer.dataset.at=b.fill?'fill':(t.kind||'mark');
    return true;
  }).catch(()=>false);
}
/* a step with several targets: from the main spot, split into up to three blobs; they merge back before the next move */
function guideSplit(from, extras, tok){
  const P=guideParams(), c=guideC(from), dd=10;
  GUIDE.extras=extras.slice(0, GUIDE_MAX-1).map((x,k)=>({t:x.t, b:x.b, o:GUIDE.splits[k]}));
  const jobs=GUIDE.extras.map(x=>{
    const e=guideC(x.b);
    const ty=x.b.y+x.b.h/2;
    if(!P.fly){ guideDot(x.o, e.x, ty, dd, 0, 1); return guideAnim(x.o.firstChild, [{opacity:0},{opacity:1}], {duration:P.fade, easing:'ease-out'}).finished; }
    guideDot(x.o, c.x, c.y, dd, 1, 1);
    const th=Math.atan2(ty-c.y, e.x-c.x)*180/Math.PI, st=Math.min(.6,P.stretch);
    guideAnim(x.o, [{transform:`translate(${c.x-dd/2}px,${c.y-dd/2}px)`},{transform:`translate(${e.x-dd/2}px,${ty-dd/2}px)`}], {duration:P.dur*.8, easing:P.ease});
    return guideAnim(x.o.firstChild, [{opacity:.6, transform:`rotate(${th}deg) scale(.6)`},{opacity:1, transform:`rotate(${th}deg) scale(${1+st},${1-st*.4})`, offset:.5},{opacity:1, transform:`rotate(${th}deg) scale(1)`}], {duration:P.dur*.8, easing:'linear'}).finished;
  });
  GUIDE.splitOn=GUIDE.extras.length>0;
  if(GUIDE.layer) GUIDE.layer.dataset.split=String(GUIDE.extras.length+1);
  return Promise.all(jobs).then(()=>{
    if(tok!==GUIDE.token) return;
    for(const x of GUIDE.extras){ const e=guideC(x.b); guideDot(x.o, e.x, x.b.y+x.b.h/2, dd, 1, 1); }
    for(const a of GUIDE.anims) try{ a.cancel(); }catch(e){} GUIDE.anims=[];
  }).catch(()=>{});
}
function guideMergeNow(){
  for(const x of GUIDE.extras) x.o.firstChild.style.opacity='0';
  GUIDE.extras=[]; GUIDE.splitOn=false; if(GUIDE.layer) delete GUIDE.layer.dataset.split;
}
function guideMerge(tok){
  if(!GUIDE.splitOn || !GUIDE.rest) { guideMergeNow(); return Promise.resolve(); }
  const P=guideParams(), c=guideC(GUIDE.rest.b), dd=10;
  if(GUIDE.layer) GUIDE.layer.dataset.merging='1';
  const jobs=GUIDE.extras.map(x=>{
    const e=guideC(x.b), ty=x.b.y+x.b.h/2;
    if(!P.fly) return guideAnim(x.o.firstChild, [{opacity:1},{opacity:0}], {duration:P.fade, easing:'ease-out'}).finished;
    guideAnim(x.o, [{transform:`translate(${e.x-dd/2}px,${ty-dd/2}px)`},{transform:`translate(${c.x-dd/2}px,${c.y-dd/2}px)`}], {duration:P.dur*.6, easing:P.ease});
    return guideAnim(x.o.firstChild, [{opacity:1, transform:'scale(1)'},{opacity:.9, transform:'scale(.8)', offset:.8},{opacity:0, transform:'scale(.4)'}], {duration:P.dur*.6, easing:'linear'}).finished;
  });
  return Promise.all(jobs).catch(()=>{}).then(()=>{
    if(GUIDE.layer) delete GUIDE.layer.dataset.merging;
    if(tok!==GUIDE.token) return;
    for(const a of GUIDE.anims) try{ a.cancel(); }catch(e){} GUIDE.anims=[];
    guideMergeNow();
  });
}
/* the director: screens call this when they appear. targets: up to 3 elements or {el, kind}; opts.main: the one the
   blob goes to first (index or element; default the first); opts.snap: no motion (resize, rotation, re-render). */
function guideTo(targets, opts){
  opts=opts||{};
  if(!GUIDE.on) return Promise.resolve(false);
  guideMount();
  let list=(Array.isArray(targets)?targets:[targets]).map(guideNorm).filter(Boolean);
  if(!list.length) return Promise.resolve(false);
  let main=list[0];
  if(typeof opts.main==='number' && list[opts.main]) main=list[opts.main];
  else if(opts.main){ const m=list.find(x=>x.el===opts.main || x.el===(opts.main.el||null)); if(m) main=m; }
  list=[main, ...list.filter(x=>x!==main)].slice(0, GUIDE_MAX);
  const b=guideBox(main); if(!b) return Promise.resolve(false);
  const extras=list.slice(1).map(t=>({t, b:guideBox(t)})).filter(x=>x.b);
  if(GUIDE.flying && !opts.snap && GUIDE.flyTo && GUIDE.flyTo.el===main.el && guideSame(GUIDE.flyTo.b, b) && !extras.length) return GUIDE.flyTo.p; /* already on its way there */
  const tok=++GUIDE.token;
  const P=guideParams();
  const prev=GUIDE.rest;
  const same=!GUIDE.flying && !GUIDE.lifted && prev && guideSame(prev.b, b) && prev.t.kind===main.kind;
  if(same && !opts.snap && extras.length && !GUIDE.splitOn){ guideCancel(); guideRest(main, b); return guideSplit(b, extras, tok).then(()=>true); }
  if(opts.snap || same || (!prev && !GUIDE.flying && !GUIDE.lifted)){
    guideCancel(); guideMergeNow(); guideRest(main, b);
    if(extras.length){ GUIDE.extras=extras.map((x,k)=>({t:x.t,b:x.b,o:GUIDE.splits[k]})); GUIDE.splitOn=true; GUIDE.layer.dataset.split=String(extras.length+1); for(const x of GUIDE.extras){ const e=guideC(x.b); guideDot(x.o, e.x, x.b.y+x.b.h/2, 10, 1, 1); } }
    return Promise.resolve(true);
  }
  const go=()=>{
    if(tok!==GUIDE.token) return false;
    const p=(P.fly && !opts.fade)?guideFly(main, b, tok):guideFade(main, b, tok);
    GUIDE.flyTo={el:main.el, b, p};
    return p.then(ok=>{ if(ok && tok===GUIDE.token && extras.length) return guideSplit(b, extras, tok).then(()=>true); return ok; });
  };
  if(GUIDE.splitOn && !GUIDE.flying) return guideMerge(tok).then(go);
  guideMergeNow();
  return go();
}
/* what each screen asks for (the prototype covers the library, the reader and the tour) */
function guideReaderTarget(){
  const v=$('#v-reader'); if(!v || v.hidden || !R.meta) return null;
  const bar=$('#ttsBar');
  if(bar && !bar.hidden) return {el:$('#ttsPlay'), kind:'fill'};
  if(R.mode==='speed') return {el:$('#playBtn'), kind:'fill'};
  if(!v.classList.contains('chrome-off')) return {el:$('#rScrub'), kind:'thumb'};
  return {el:$('#runFoot'), kind:'strip'};
}
function guideScreenTargets(){
  if(typeof TOUR!=='undefined' && TOUR.on) return GUIDE.tour;
  const v=$('#v-reader');
  if(v && !v.hidden){ const t=guideReaderTarget(); return t?[t]:null; }
  const lib=$('#v-library');
  if(lib && !lib.hidden){
    const go=document.querySelector('#v-library .continue-hero .hero-go');
    if(go) return [{el:go, kind:'fill'}];
    const add=$('#addBtn'); return add?[{el:add, kind:getComputedStyle(add).backgroundColor===guideAccentRgb()?'fill':'mark'}]:null;
  }
  const tab=document.querySelector('#tabs button[aria-current="page"]');
  return tab?[{el:tab.querySelector('svg')||tab, kind:'mark'}]:null;
}
function guideAccentRgb(){
  const L=guideMount(), p=GUIDE.blob.firstChild; return getComputedStyle(p).backgroundColor;
}
function guideScreen(opts){
  const t=guideScreenTargets(); if(!t || !t.length) return Promise.resolve(false);
  return guideTo(t, Object.assign({main:0}, opts||{}));
}
/* the tour: each step names its targets; the first is the main spot */
function guideTour(targets){ GUIDE.tour=(targets||[]).filter(Boolean); if(GUIDE.tour.length) return guideTo(GUIDE.tour, {main:0}); return Promise.resolve(false); }
/* the guide on or off (tests compare layout with it on and off; it never changes layout either way) */
function guideSet(on){
  GUIDE.on=!!on; GUIDE.token++; guideCancel(); guideMergeNow(); guideClearOff(null); clearTimeout(GUIDE.liftTimer); GUIDE.lifted=false;
  if(!on){ if(GUIDE.layer) GUIDE.layer.remove(); GUIDE.layer=null; GUIDE.rest=null; return; }
  guideMount(); GUIDE.rest=null; guideScreen({snap:true});
}
/* test/diagnostic view of the guide */
function guideState(){
  const L=GUIDE.layer; if(!L) return {on:GUIDE.on, layers:document.querySelectorAll('#guide').length};
  const vis=[...L.querySelectorAll('.gpos')].filter(o=>+getComputedStyle(o.firstChild).opacity>.05);
  const r=GUIDE.rest;
  const shape=GUIDE.shapes[GUIDE.cur];
  return {on:GUIDE.on, layers:document.querySelectorAll('#guide').length, at:L.dataset.at||'', split:+(L.dataset.split||1), flying:GUIDE.flying, lifted:GUIDE.lifted,
    visible:vis.length, realFill:!!(r && r.b.fill && !r.t.el.classList.contains('guide-off')),
    target:r?{id:r.t.el.id||'', cls:r.t.el.className&&r.t.el.className.baseVal==null?r.t.el.className:'', kind:r.t.kind, box:r.b}:null,
    shape:shape?{rect:shape.getBoundingClientRect().toJSON(), rad:getComputedStyle(shape.firstChild).borderRadius, op:+getComputedStyle(shape.firstChild).opacity}:null,
    pe:getComputedStyle(L).pointerEvents, aria:L.getAttribute('aria-hidden')};
}
(function bindGuide(){
  const ready=()=>{
    guideMount();
    /* a tap on a book's Continue (or any open-a-book card) gathers the fill into a blob; the tap itself is untouched */
    document.addEventListener('click', e=>{
      const go=e.target && e.target.closest && e.target.closest('#v-library .hero-go');
      if(go && GUIDE.rest && GUIDE.rest.t.el===go) guideLift(go);
    }, {capture:true, passive:true});
    /* resize and rotation re-snap the blob (rects are measured again once, after the layout settles) */
    let rt=0; const resnap=()=>{ cancelAnimationFrame(rt); rt=requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(!GUIDE.flying && !GUIDE.lifted) guideScreen({snap:true}); else guideScreen(); })); };
    window.addEventListener('resize', resnap); window.addEventListener('orientationchange', resnap);
    /* the library re-renders, the reader's bars show or hide, the read-aloud pill opens or closes */
    let mt=0; const later=(fade)=>{ cancelAnimationFrame(mt); mt=requestAnimationFrame(()=>{ if(typeof TOUR!=='undefined' && TOUR.on) return; guideScreen(fade?{fade:true}:null); }); };
    const list=$('#docList'); if(list) new MutationObserver(()=>later(false)).observe(list, {childList:true});
    const v=$('#v-reader');
    if(v){
      let was={off:v.classList.contains('chrome-off'), pill:v.classList.contains('tts-pill-on')};
      new MutationObserver(()=>{
        if(v.hidden || !R.meta) return;
        const now={off:v.classList.contains('chrome-off'), pill:v.classList.contains('tts-pill-on')};
        if(now.off===was.off && now.pill===was.pill) return;
        const barsOnly=now.pill===was.pill; was=now;
        later(barsOnly); /* the bars hiding or coming back only cross-fades the mark: it never travels while you read */
      }).observe(v, {attributes:true, attributeFilter:['class']});
      /* only a real open or close counts: the reader re-sets hidden on every page turn, and the mark must not move while you read */
      const bar=$('#ttsBar'); let barWas=bar?bar.hidden:true;
      if(bar) new MutationObserver(()=>{ if(bar.hidden===barWas) return; barWas=bar.hidden; if(!v.hidden && R.meta) later(false); }).observe(bar, {attributes:true, attributeFilter:['hidden']});
    }
    /* scrubbing moves the progress mark with the thumb (no flight) */
    const sc=$('#rScrub'); if(sc) sc.addEventListener('input', ()=>{ if(GUIDE.rest && GUIDE.rest.t.el===sc && !GUIDE.flying) guideTo([{el:sc, kind:'thumb'}], {snap:true}); }, {passive:true});
    requestAnimationFrame(()=>guideScreen({snap:true}));
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
