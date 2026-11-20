/* ---------- the Guide (v40, Living Substance + Accent Gravity) ----------
   v40: one fixed viewport <svg> (pointer-events none) holds the Source blob, a fixed pool of 4 reusable child blobs
   (zero DOM churn), the live tether strand and the focus-border <rect>. The Source lives on the bottom tab bar (home
   base) outside the reader; child blobs bud off it to fill accented controls (Continue, active pills and switches as
   they scroll into view), hop between options of a [data-accent-group] and trace a search field's border. Hold the
   Source (or an active accent) ~240 ms to pull it out on a tether (Accent Gravity): drop it on a book to open it, on a
   Style or page colour to live-paint it, on a search field to focus it, slide it along the tabs to scrub them, or (in
   the reader, on the scrubber or the bottom progress mark only) pull it up for fine scrubbing. Labels float above the
   liquid (an ink copy of the label sits over a filling blob). The gooey filter is on only during a bud/peel window and
   switches itself off when a frame takes over 24 ms. Per-Style physics come only from CSS variables.
   ---------- the Guide (v39): one soft-body accent character that sits where you look or tap next ----------
   One fixed, aria-hidden, pointer-events:none layer above every view. It is purely visual: it never takes a tap, focus
   or VoiceOver, never rests on any text and never moves while you read. Screens call guideTo(targets, {main}).
   A target is an element or {el, kind}: 'fill' (it fills the element's exact shape like a mould, then hands off to the
   real fill), 'mark' (a small pill under the element or its label), 'thumb' (a range's thumb) or 'strip' (your
   progress, in the reader's bottom strip, faint and clear of the footer text).
   The body: an SVG path through GUIDE_N outline points on a closed Catmull-Rom curve. Each point is a damped spring
   around the centre; the centre is a stiff spring chasing a carrot along an arc. The whole flight (wake, launch, arc,
   landing jiggle, mould) is simulated ONCE at launch with a fixed 1/240 s step and baked: the body's position and
   opacity become a Web Animation on its wrapper (transform/opacity, on the compositor, so it keeps time even while the
   page is busy, e.g. a book opening), and the outline is a precomputed sequence of path shapes that a small rAF loop
   writes (path d only, no layout reads) only while a flight plays; then it sleeps (zero cost at rest).
   Temperament per Style comes from CSS variables read once per flight (--guide-anticip, --guide-travel,
   --guide-stiffness, --guide-damping, --guide-wobble, --guide-squash, --guide-jiggles, --guide-settle,
   --guide-stretch, --guide-arc, --guide-overshoot); there is no per-Style code here.
   At rest it is still. Outside the reader, after ~6 s with no input it gives one small hop, once per screen.
   Reduce Motion: a plain fade out and in (no physics, no rAF). */
const GUIDE_N=12, GUIDE_DT=1/240, GUIDE_FR=1000/60, GUIDE_MAX=3, GUIDE_NS='http://www.w3.org/2000/svg', GUIDE_POOL=4;
const GUIDE={on:true, layer:null, shapes:[], cur:0, ring:null, bodies:[], main:null, anims:[],
  rest:null, extras:[], token:0, flying:false, lifted:false, held:false, liftTimer:0, offEls:new Set(), tour:null,
  raf:0, rafCount:0, manual:false, flyTo:null, splitOn:false, snaps:0,
  idleMs:6000, idleTimer:0, screenSeq:0, nudged:-1, nudges:0, nudgeAnim:null, pulses:0, flights:[],
  /* v40 */
  svg:null, liq:null, tetherPath:null, focusRect:null, inkLayer:null, pool:[], gooUntil:0, gooTrips:0, gooOnFrames:0, lastFrameT:0,
  kids:new Set(), ktok:0, tether:null, pend:null, focusEl:null, focusT:0, xfer:null, seen:new WeakSet(), waits:new Set(),
  wave:{pending:new Set(), timer:0, lastScroll:0, peak:0, lastY:null, lastT:0, waves:0, sent:0, faded:0, maxWave:0, io:null, mo:null, view:''},
  transfers:0, settles:0, traces:0, unzips:0, pours:0, scrubs:0, gravity:[], tetherFrames:0, backHow:'', safe:null, under:null};
function guideCss(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function guideNum(name, def){ const v=parseFloat(guideCss(name)); return isFinite(v)?v:def; }
function guideMs(name, def){ const s=guideCss(name); const v=parseFloat(s); if(!isFinite(v)) return def; return /ms$/.test(s)?v:(/s$/.test(s)?v*1000:v); }
/* the Style's temperament, read once per flight */
function guideParams(){
  return { A:guideMs('--guide-anticip',80)/1000, T:(guideMs('--guide-travel',250)+guideMs('--guide-weight',0))/1000, k:guideNum('--guide-stiffness',700),
    zeta:guideNum('--guide-damping',.5), wob:guideNum('--guide-wobble',.03), squash:guideNum('--guide-squash',.15),
    jig:guideNum('--guide-jiggles',1), settle:guideMs('--guide-settle',130)/1000, stretch:guideNum('--guide-stretch',.3),
    arc:guideNum('--guide-arc',.12), over:guideNum('--guide-overshoot',.5), fly:guideNum('--guide-fly',1)>0,
    size:guideNum('--guide-size',26), fade:guideMs('--guide-fade',160), thumb:guideNum('--guide-thumb',16),
    curve:guideNum('--guide-curve',3), weight:guideMs('--guide-weight',0), trace:guideMs('--guide-trace',200), xfade:guideMs('--guide-xfade',0),
    tw:guideNum('--guide-tether-w',2), top:guideNum('--guide-tether-op',.8), sag:guideNum('--guide-sag',0), tjig:guideNum('--guide-tether-jiggle',0),
    hold:guideMs('--guide-hold',240), lift:guideNum('--guide-lift',52) };
}
function guideSvg(tag, attrs, parent){ const e=document.createElementNS(GUIDE_NS, tag); for(const k in attrs) e.setAttribute(k, attrs[k]); if(parent) parent.appendChild(e); return e; }
function guideMount(){
  if(GUIDE.layer && GUIDE.layer.isConnected) return GUIDE.layer;
  let L=document.getElementById('guide');
  if(!L){ L=document.createElement('div'); L.id='guide'; document.body.appendChild(L); }
  L.setAttribute('aria-hidden','true'); L.innerHTML='';
  /* the exact resting shape (a div: its rect and radius match the target to the pixel); two, for Reduce Motion's cross-fade */
  const mk=(cls)=>{ const o=document.createElement('div'); o.className='gpos '+cls; const i=document.createElement('i'); i.className='gbody'; o.appendChild(i); L.appendChild(o); return o; };
  GUIDE.shapes=[mk('gshape'), mk('gshape')]; GUIDE.ring=mk('gring');
  /* the one liquid layer: a fixed viewport <svg> with the Source, the child pool, the tether and the focus border */
  const svg=guideSvg('svg', {class:'gsvg', 'aria-hidden':'true', focusable:'false'}, L);
  const f=guideSvg('filter', {id:'gGoo', x:'-25%', y:'-25%', width:'150%', height:'150%', 'color-interpolation-filters':'sRGB'}, guideSvg('defs', {}, svg));
  guideSvg('feGaussianBlur', {in:'SourceGraphic', stdDeviation:'2.4', result:'b'}, f);
  guideSvg('feColorMatrix', {in:'b', mode:'matrix', values:'1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8', result:'g'}, f);
  guideSvg('feComposite', {in:'SourceGraphic', in2:'g', operator:'atop'}, f);
  const liq=guideSvg('g', {class:'gliq'}, svg);
  GUIDE.svg=svg; GUIDE.liq=liq;
  GUIDE.tetherPath=guideSvg('path', {class:'gtether', d:''}, liq);
  GUIDE.focusRect=guideSvg('rect', {class:'gfocus', x:'0', y:'0', width:'0', height:'0', rx:'0'}, svg);
  /* labels float above the liquid: one ink layer, one ink copy per body */
  const ink=document.createElement('div'); ink.className='ginks'; L.appendChild(ink); GUIDE.inkLayer=ink;
  const safe=document.createElement('div'); safe.className='gsafe'; L.appendChild(safe);
  GUIDE.layer=L; GUIDE.cur=0; GUIDE.bodies=[]; GUIDE.main=null; GUIDE.extras=[]; GUIDE.pool=[];
  guideBodyMake('gmain'); for(let i=0;i<GUIDE_POOL;i++) guideBodyMake('gdrop');
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
/* an element's own colours as they are with its real fill showing (guide-off / guide-wait lifted for this one read,
   with transitions held, so nothing is drawn or animated); a transparent fill falls back to --play-bg, --chrome-on, --accent */
function guideRealStyle(el){
  const off=el.classList.contains('guide-off'), wt=el.classList.contains('guide-wait'); let bg, color, cs=getComputedStyle(el);
  if(off || wt){ const tr=el.style.transition; el.style.transition='none'; el.classList.remove('guide-off','guide-wait'); cs=getComputedStyle(el); bg=cs.backgroundColor; color=cs.color;
    if(off) el.classList.add('guide-off'); if(wt) el.classList.add('guide-wait'); void getComputedStyle(el).backgroundColor; el.style.transition=tr; }
  else { bg=cs.backgroundColor; color=cs.color; }
  if(!bg || /^rgba\(0, 0, 0, 0\)$|^transparent$/.test(bg)){ for(const v of ['--play-bg','--chrome-on','--accent']){ const x=cs.getPropertyValue(v).trim(); if(x){ bg=x; break; } } }
  return {bg, color};
}
const guideClear=c=>!c || /^rgba\(0, 0, 0, 0\)$|^transparent$/.test(c);
/* the mark colour (the Style's --guide-mark / --accent as drawn) */
function guideMarkColour(){ const s=GUIDE.shapes[0]; return s?getComputedStyle(s.firstChild).backgroundColor:''; }
/* the safe-area insets, measured once per layout from a probe (custom properties holding env() don't resolve) */
function guideSafe(){
  if(GUIDE.safe && GUIDE.safe.w===innerWidth && GUIDE.safe.h===innerHeight) return GUIDE.safe;
  const p=GUIDE.layer && GUIDE.layer.querySelector('.gsafe'); let l=0, r=0, b=0;
  if(p){ const cs=getComputedStyle(p); l=parseFloat(cs.paddingLeft)||0; r=parseFloat(cs.paddingRight)||0; b=parseFloat(cs.paddingBottom)||0; }
  return (GUIDE.safe={l, r, b, w:innerWidth, h:innerHeight});
}
/* the box the blob takes for a target, or null when the target isn't on screen */
/* the label text inside an element (its text nodes only), or null */
function guideTextRect(el){
  try{ const rg=document.createRange(); let r=null;
    for(const n of el.childNodes){ if(n.nodeType!==3 || !n.textContent.trim()) continue; rg.selectNodeContents(n); const q=rg.getBoundingClientRect(); if(q.width>0) r=r?{left:Math.min(r.left,q.left), right:Math.max(r.right,q.right), top:Math.min(r.top,q.top), bottom:Math.max(r.bottom,q.bottom)}:{left:q.left,right:q.right,top:q.top,bottom:q.bottom}; }
    return r; }catch(e){ return null; }
}
/* the box the character takes for a target, or null when the target isn't on screen */
function guideBox(t){
  const el=t&&t.el; if(!el || !el.isConnected) return null;
  if(el.closest('[hidden]')) return null;
  const r=guideStillRect(el); if(r.width<1 || r.height<1) return null;
  const cs=getComputedStyle(el);
  if(t.kind==='fill'){
    return {x:r.left, y:r.top, w:r.width, h:r.height, rad:[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' '), bg:guideRealStyle(el).bg, fill:true};
  }
  if(t.kind==='thumb'){ /* the native thumb's width is the platform's: --guide-thumb (16px Chromium, 28px iOS WebKit) */
    const th=guideParams().thumb;
    const mn=+el.min||0, mx=+el.max||1, v=+el.value||0, f=mx>mn?Math.min(1,Math.max(0,(v-mn)/(mx-mn))):0;
    const d=14, cx=r.left+th/2+f*(r.width-th), cy=r.top+r.height/2;
    return {x:cx-d/2, y:cy-d/2, w:d, h:d, rad:'50%', bg:'', fill:false};
  }
  if(t.kind==='strip'){
    /* your progress along the bottom strip, never on the footer text and never under a notch: below the text when there
       is room (the home-indicator inset); with no inset, one continuous line just above the text (no jump across it).
       Its ends keep clear of the left/right safe areas (landscape notch). */
    const sc=$('#rScrub'); const mn=sc?(+sc.min||0):0, mx=sc?(+sc.max||1):1, v=sc?(+sc.value||0):0, f=mx>mn?Math.min(1,Math.max(0,(v-mn)/(mx-mn))):0;
    const sa=guideSafe(), w=14, h=3, pad=20, x0=Math.max(r.left, sa.l)+pad, x1=Math.min(r.right, innerWidth-sa.r)-pad, tr=guideTextRect(el);
    const cx=x0+w/2+f*Math.max(0,x1-x0-w);
    if(!tr || tr.bottom+2+h<=innerHeight-1) return {x:cx-w/2, y:tr?tr.bottom+2:r.bottom-h-1, w, h, rad:'2px', bg:'', fill:false};
    return {x:cx-w/2, y:Math.max(r.top-h-1, tr.top-h-2), w, h, rad:'2px', bg:'', fill:false, above:true};
  }
  /* mark: a short pill under the element, or under its label when it has one (tabs: icon over label) */
  const tr=guideTextRect(el), below=tr?tr.bottom:r.bottom;
  const w=Math.max(12, Math.min(28, r.width*.5)), h=4;
  return {x:r.left+r.width/2-w/2, y:Math.min(innerHeight-h-2, below+3), w, h, rad:'2px', bg:'', fill:false};
}
const guideC=b=>({x:b.x+b.w/2, y:b.y+b.h/2});
const guideSame=(a,b)=>a && b && Math.abs(a.x-b.x)<2 && Math.abs(a.y-b.y)<2 && Math.abs(a.w-b.w)<2 && Math.abs(a.h-b.h)<2;
function guideOff(el, on){
  if(!el) return;
  if(on){ el.classList.add('guide-off'); GUIDE.offEls.add(el); }
  else { el.classList.remove('guide-off'); GUIDE.offEls.delete(el); }
}
function guideKidOwns(el){ for(const k of GUIDE.kids) if(k.el===el) return true; return false; }
function guideClearOff(keep){ for(const el of [...GUIDE.offEls]) if(el!==keep && !guideKidOwns(el)) guideOff(el,false); }
function guideAnim(el, kf, o){ const a=el.animate(kf, Object.assign({fill:'forwards'}, o)); (GUIDE.anims||(GUIDE.anims=[])).push(a); return a; }
function guideStopAnims(){ for(const a of GUIDE.anims||[]) try{ a.cancel(); }catch(e){} GUIDE.anims=[]; }
/* place a resting shape exactly on a box (static styles; only at phase boundaries, never per frame) */
function guideShapeAt(s, b, opacity){
  s.style.width=b.w+'px'; s.style.height=b.h+'px';
  s.style.transform=`translate(${b.x}px,${b.y}px)`;
  const i=s.firstChild; i.style.borderRadius=b.rad; i.style.background=b.fill&&b.bg?b.bg:''; i.style.transform='none';
  i.style.opacity=String(opacity);
}
function guideVisible(el){ if(!el || !el.isConnected || el.closest('[hidden]')) return false; const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; }
function guideRadPx(b){ const s=String(b.rad||'').split(' ')[0]; const v=parseFloat(s)||0; return /%$/.test(s)?Math.min(b.w,b.h)*v/100:v; }
/* GUIDE_N points spaced evenly along a rounded rect's outline, relative to its centre: from the right middle, clockwise */
function guideOutline(w, h, rad){
  const a=w/2, bb=h/2, r=Math.max(0,Math.min(rad,a,bb)), ex=a-r, ey=bb-r, q=Math.PI*r/2, H=Math.PI/2;
  const arc=(cx,cy,t0)=>u=>({x:cx+r*Math.cos(t0+u*H), y:cy+r*Math.sin(t0+u*H)});
  const segs=[[ey,u=>({x:a,y:u*ey})],[q,arc(ex,ey,0)],[2*ex,u=>({x:ex-2*ex*u,y:bb})],[q,arc(-ex,ey,H)],
    [2*ey,u=>({x:-a,y:ey-2*ey*u})],[q,arc(-ex,-ey,2*H)],[2*ex,u=>({x:-ex+2*ex*u,y:-bb})],[q,arc(ex,-ey,3*H)],[ey,u=>({x:a,y:-ey+ey*u})]];
  const tot=segs.reduce((s,x)=>s+x[0],0)||1, out=[];
  for(let i=0;i<GUIDE_N;i++){
    let d=tot*i/GUIDE_N, k=0;
    while(k<segs.length-1 && d>segs[k][0]){ d-=segs[k][0]; k++; }
    out.push(segs[k][1](segs[k][0]>0?Math.min(1,d/segs[k][0]):0));
  }
  return out;
}
const guideCircle=r=>guideOutline(2*r, 2*r, r);
const guideEase=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const guideBack=(s,c)=>{ const u=s-1; return 1+(c+1)*u*u*u+c*u*u; }; /* ease-out with overshoot c (c=0: ease-out cubic); never starts at rest */
/* ---------- the soft body ---------- */
const GUIDE_UC=guideCircle(1);
/* the fixed pool: one Source body and GUIDE_POOL child bodies, made once at mount and reused (zero DOM churn) */
function guideBodyMake(cls){
  const wrap=guideSvg('g', {class:'gbod '+cls}, GUIDE.liq);
  const g=guideSvg('g', {class:'ggoo'}, wrap);
  const strand=guideSvg('path', {class:'gstrand', d:''}, g);
  const path=guideSvg('path', {class:'gblob', d:''}, g);
  const ink=document.createElement('div'); ink.className='gink'; GUIDE.inkLayer.appendChild(ink);
  const b={wrap, svg:GUIDE.svg, g, path, strand, ink, inkOn:false, cls, free:true, c:{x:0,y:0}, v:{x:0,y:0}, r:13, p:[], pv:[], op:0,
    phase:(GUIDE.pool.length*2.17)%6.28, anim:null, frames:null, plan:null, ev:null, goo:false, lastIdx:-1, tgt:null, fadeA:null};
  for(let i=0;i<GUIDE_N;i++){ b.p.push({x:0,y:0}); b.pv.push({x:0,y:0}); }
  GUIDE.pool.push(b); return b;
}
/* take a body from the pool (a child body is stolen from the oldest flight only when steal is on) */
function guideBodyNew(cls, r, steal){
  guideMount();
  const want=cls==='gmain'?'gmain':'gdrop';
  let b=GUIDE.pool.find(x=>x.free && x.cls===want);
  if(!b){ if(steal===false || want==='gmain') return null; b=GUIDE.bodies.find(x=>x.cls===want); if(!b) return null; guideBodyKill(b); }
  b.free=false; b.r=r; b.c={x:0,y:0}; b.v={x:0,y:0}; b.op=0; b.tgt=null; b.lastIdx=-1;
  for(let i=0;i<GUIDE_N;i++){ b.p[i].x=b.p[i].y=0; b.pv[i].x=b.pv[i].y=0; }
  b.path.style.transition='none'; b.path.style.fill=''; b.strand.style.fill='';
  GUIDE.bodies.push(b); guideBodyPlace(b); return b;
}
function guideBodySet(b, pts){ for(let i=0;i<GUIDE_N;i++){ b.p[i].x=pts[i].x; b.p[i].y=pts[i].y; b.pv[i].x=0; b.pv[i].y=0; } }
/* a still body: its wrapper sits at the centre (static style; only at phase boundaries) and its outline is drawn once */
function guideBodyPlace(b){
  b.wrap.style.transform=`translate(${gf(b.c.x)}px,${gf(b.c.y)}px)`; b.wrap.style.opacity=String(gf(b.op));
  b.path.setAttribute('d', guidePathD(b.p)); b.strand.setAttribute('d','');
  if(b.goo){ b.g.removeAttribute('filter'); b.goo=false; }
}
function guideBodyStop(b){
  if(!b) return;
  if(b.anim){ const a=b.anim; b.anim=null; try{ a.cancel(); }catch(e){} }
  if(b.ev && b.ev.resolve){ const r=b.ev.resolve; b.ev.resolve=null; r(false); }
  b.frames=null; b.ev=null; b.plan=null;
}
function guideBodyKill(b){
  if(!b) return; guideBodyStop(b);
  if(b.fadeA){ try{ b.fadeA.cancel(); }catch(e){} b.fadeA=null; }
  guideInkOff(b); b.op=0; b.tgt=null; b.wrap.style.opacity='0'; b.path.setAttribute('d',''); b.strand.setAttribute('d','');
  if(b.goo){ b.g.removeAttribute('filter'); b.goo=false; }
  b.free=true; GUIDE.bodies=GUIDE.bodies.filter(x=>x!==b); if(GUIDE.main===b) GUIDE.main=null;
}
function guideMainBody(){
  guideMount();
  if(!GUIDE.main || GUIDE.main.free || !GUIDE.main.wrap.isConnected){ GUIDE.main=guideBodyNew('gmain', guideParams().size/2); }
  return GUIDE.main;
}
/* the main character goes quiet: hidden, its outline set to the resting shape (the exact div draws the rest) */
function guideBodyQuiet(b, box){
  if(!b) return; guideBodyStop(b); b.op=0; b.v.x=b.v.y=0;
  if(box){ b.c={x:box.x+box.w/2, y:box.y+box.h/2}; guideBodySet(b, guideOutline(box.w, box.h, guideRadPx(box))); }
  guideBodyPlace(b);
}
/* where the body is at this moment of its flight (state from the baked frames) */
function guideBodyNow(b){
  if(b.anim && b.frames){
    const i=Math.max(0, Math.min(b.frames.length-1, Math.floor((+b.anim.currentTime||0)/GUIDE_FR))); const f=b.frames[i];
    b.c={x:f.cx, y:f.cy}; b.v={x:f.vx, y:f.vy}; b.op=f.op;
    for(let k=0;k<GUIDE_N;k++){ b.p[k].x=f.pts[2*k]; b.p[k].y=f.pts[2*k+1]; b.pv[k].x=f.pvs[2*k]; b.pv[k].y=f.pvs[2*k+1]; }
  }
  return b;
}
/* plan a flight: wake (anticipation: squash, gather, lean, peel with a sticky strand) | launch on an arc | land
   (overshoot, squash, damped jiggles, liquid fill of the target's mould). Times in seconds from the launch. */
function guidePlan(src, dst, P, o){
  const A=o.wake?P.A+(o.delay||0):0;
  const ddx=dst.x-src.x, ddy=dst.y-src.y, dist=Math.hypot(ddx,ddy)||1, dir={x:ddx/dist, y:ddy/dist};
  const lean=o.lean||dir, peel=o.wake?(o.peel!=null?o.peel:Math.min(12, dist*.2)):0;
  const s0={x:src.x+lean.x*peel, y:src.y+lean.y*peel};
  const tdx=dst.x-s0.x, tdy=dst.y-s0.y, td=Math.hypot(tdx,tdy)||1, tdir={x:tdx/td, y:tdy/td};
  let n={x:-tdir.y, y:tdir.x};
  if(n.y>.01 || (Math.abs(n.y)<=.01 && n.x*((s0.x+dst.x)/2-innerWidth/2)>0)){ n.x=-n.x; n.y=-n.y; } /* bow up, or toward the middle */
  const ctl={x:(s0.x+dst.x)/2+n.x*td*P.arc, y:(s0.y+dst.y)/2+n.y*td*P.arc};
  const T=o.T!=null?o.T:P.T*(td<60?.6:1);
  const P1=o.vel?{x:s0.x+o.vel.x*T/3, y:s0.y+o.vel.y*T/3}:{x:s0.x+(ctl.x-s0.x)*2/3, y:s0.y+(ctl.y-s0.y)*2/3};
  const P2={x:dst.x+(ctl.x-dst.x)*2/3, y:dst.y+(ctl.y-dst.y)*2/3};
  const settle=o.settle!=null?o.settle:P.settle, kLand=Math.pow(2*Math.PI*Math.max(.5,P.jig)/Math.max(.05,settle),2);
  const m=(o.r||P.size/2)+3;
  return {t0:0, A, T, tl:A, src:{x:src.x,y:src.y}, s0, dst:{x:dst.x,y:dst.y}, P1, P2, from:o.from||null, lean, peel, dir:tdir,
    mould:o.mould||null, rT:o.rT, r0wake:o.r0wake, tArr0:null, tArr:null, locked:false, settle, kLand, mouldT:Math.min(.12, settle*.7),
    hover:!!o.hover, fadeIn:!!o.fadeIn, strand:o.strand||null, kind:o.kind||'fly',
    bounds:{x0:m, y0:m, x1:innerWidth-m, y1:innerHeight-m}};
}
function guideBez(pl, e){
  const u=1-e, a=u*u*u, b=3*u*u*e, c=3*u*e*e, d=e*e*e;
  return {x:a*pl.s0.x+b*pl.P1.x+c*pl.P2.x+d*pl.dst.x, y:a*pl.s0.y+b*pl.P1.y+c*pl.P2.y+d*pl.dst.y};
}
/* one fixed step of the simulation (s: a plain state object, never the DOM) */
function guideStepSim(s, t, dt){
  const pl=s.plan, P=s.P;
  if(s.op!==s.opT){ const q=dt/Math.max(.001,s.opDur); s.op=s.opT>s.op?Math.min(s.opT,s.op+q):Math.max(s.opT,s.op-q); }
  const vx0=s.v.x, vy0=s.v.y;
  if(!pl.locked){
    let carrot;
    if(t<pl.tl){ const ph=(t-pl.t0)/Math.max(1e-3,pl.A), pe=guideEase((ph-.55)/.45); carrot={x:pl.src.x+(pl.s0.x-pl.src.x)*pe, y:pl.src.y+(pl.s0.y-pl.src.y)*pe}; }
    else if(t<pl.tl+pl.T){ const q=(t-pl.tl)/pl.T; carrot=guideBez(pl, guideBack(q, P.over)); s.r=pl.r0+(pl.rT-pl.r0)*guideEase((q-.45)/.55); }
    else carrot=pl.dst;
    const B=pl.bounds; carrot.x=Math.max(Math.min(B.x0,pl.dst.x), Math.min(Math.max(B.x1,pl.dst.x), carrot.x)); carrot.y=Math.max(Math.min(B.y0,pl.dst.y), Math.min(Math.max(B.y1,pl.dst.y), carrot.y)); /* arcs and overshoot stay on screen */
    const K=9000, C=2*.9*Math.sqrt(K);
    s.v.x+=(K*(carrot.x-s.c.x)-C*s.v.x)*dt; s.v.y+=(K*(carrot.y-s.c.y)-C*s.v.y)*dt;
    s.c.x+=s.v.x*dt; s.c.y+=s.v.y*dt;
    if(t>=pl.tl+pl.T){
      if(pl.tArr0==null){
        pl.tArr0=t; s.r=pl.rT;
        if(pl.T>0){ /* impact: squash along the travel direction (the springs then jiggle it out) */
          const d=pl.dir, nx=-d.y, ny=d.x, w=Math.sqrt(pl.kLand);
          for(let i=0;i<GUIDE_N;i++){ const p=s.p[i], al=p.x*d.x+p.y*d.y, pp=p.x*nx+p.y*ny;
            s.pv[i].x+=d.x*(-al*P.squash*w*1.1)+nx*(pp*P.squash*w*.7); s.pv[i].y+=d.y*(-al*P.squash*w*1.1)+ny*(pp*P.squash*w*.7); }
        }
      }
      const f=1-Math.exp(-dt/.014);
      s.c.x+=(pl.dst.x-s.c.x)*f; s.c.y+=(pl.dst.y-s.c.y)*f; s.v.x*=1-f; s.v.y*=1-f;
      if(Math.hypot(pl.dst.x-s.c.x, pl.dst.y-s.c.y)<.3 || t-pl.tArr0>=.07){ s.c.x=pl.dst.x; s.c.y=pl.dst.y; s.v.x=s.v.y=0; pl.locked=true; pl.tArr=t; }
    }
  }
  let ax=(s.v.x-vx0)/dt, ay=(s.v.y-vy0)/dt; const am=Math.hypot(ax,ay); if(am>12000){ ax*=12000/am; ay*=12000/am; }
  /* the outline: each point a damped spring toward its shape target (gathered from the source, circle, mould) */
  const sp=Math.hypot(s.v.x,s.v.y), moving=sp>20 && !pl.locked, d=moving?{x:s.v.x/sp,y:s.v.y/sp}:pl.dir, nx=-d.y, ny=d.x;
  const e=moving?Math.min(.9, P.stretch*sp/900):0;
  const waking=t<pl.tl, wph=waking?(t-pl.t0)/Math.max(1e-3,pl.A):1;
  const gather=pl.from?guideEase(wph/.55):1;
  const sq=waking?P.squash*(wph<.55?guideEase(wph/.55):1-guideEase((wph-.55)/.45))*(pl.from?gather:1):0;
  const L=pl.lean, lnx=-L.y, lny=L.x;
  const m=pl.mould&&pl.tArr0!=null?guideEase((t-pl.tArr0)/pl.mouldT):0;
  const amp=P.wob*(Math.min(1,sp/600)+(pl.tArr0!=null?.7*Math.exp(-(t-pl.tArr0)/.08):0)+(waking?.4:0));
  const r=pl.from?s.r:(waking&&pl.r0wake!=null?pl.r0wake+(s.r-pl.r0wake)*guideEase(wph):s.r);
  const inertia=Math.min(.4, P.wob*4);
  const k=pl.tArr0!=null?pl.kLand:P.k, kt=k*.55, z=P.zeta;
  for(let i=0;i<GUIDE_N;i++){
    let x=GUIDE_UC[i].x*r, y=GUIDE_UC[i].y*r;
    if(pl.from && gather<1){ x=pl.from[i].x+(x-pl.from[i].x)*gather; y=pl.from[i].y+(y-pl.from[i].y)*gather; }
    if(m>0){ x+=(pl.mould[i].x-x)*m; y+=(pl.mould[i].y-y)*m; }
    if(e>0){ let al=x*d.x+y*d.y, pp=x*nx+y*ny; if(al<0) al*=1+e*.7; al*=1+e; pp/=1+e*.45; x=d.x*al+nx*pp; y=d.y*al+ny*pp; }
    if(sq>0){ const al=(x*L.x+y*L.y)*(1-sq), pp=(x*lnx+y*lny)*(1+sq*.7); x=L.x*al+lnx*pp+L.x*sq*r*.25; y=L.y*al+lny*pp+L.y*sq*r*.25; }
    if(amp>0){ const q=1+amp*(Math.sin(t*13+i*2.4+s.phase)+.6*Math.sin(t*23-i*1.7+s.phase*2)); x*=q; y*=q; }
    const tail=moving && (GUIDE_UC[i].x*d.x+GUIDE_UC[i].y*d.y)<-.3, ki=tail?kt:k, ci=2*z*Math.sqrt(ki);
    const p=s.p[i], v=s.pv[i];
    v.x+=(ki*(x-p.x)-ci*v.x-ax*inertia)*dt; v.y+=(ki*(y-p.y)-ci*v.y-ay*inertia)*dt;
    p.x+=v.x*dt; p.y+=v.y*dt;
  }
  /* a sticky strand back to where it peeled off: it thins as it stretches and snaps, with a little recoil */
  const st=pl.strand;
  if(st && !st.dead){
    const len=Math.hypot(s.c.x-st.a.x, s.c.y-st.a.y);
    if(!st.snapped && (len>st.snap || t>.6)){
      st.snapped=true; st.tSnap=t;
      const dx=(s.c.x-st.a.x)/(len||1), dy=(s.c.y-st.a.y)/(len||1), w=Math.sqrt(P.k);
      for(let i=0;i<GUIDE_N;i++){ const p=s.p[i]; if(p.x*dx+p.y*dy<0){ s.pv[i].x+=dx*w*1.4; s.pv[i].y+=dy*w*1.4; } }
    }
    if(st.snapped && t-st.tSnap>.09) st.dead=true;
  }
  if(pl.locked && t>=pl.tArr0+(pl.mould||pl.T>0||pl.hover?pl.settle:.04)) pl.done=t;
}
/* simulate a whole flight at once and bake it: frames every 1/60 s (centre, opacity, outline, strand) and event times */
function guideSimulate(b, pl, P){
  const s={c:{...b.c}, v:{...b.v}, r:b.r, p:b.p.map(q=>({...q})), pv:b.pv.map(q=>({...q})), op:b.op, opT:1, opDur:.06, phase:b.phase, P, plan:pl};
  if(pl.fadeIn){ s.op=0; s.opT=1; } else s.op=1;
  pl.r0=s.r; if(pl.rT==null) pl.rT=s.r;
  const frames=[]; let t=0, next=0; const W=innerWidth, H=innerHeight, cap=Math.max(1.05, P.curve||3);
  const snap=()=>{
    const pts=new Float32Array(2*GUIDE_N), pvs=new Float32Array(2*GUIDE_N);
    for(let k=0;k<GUIDE_N;k++){ pts[2*k]=s.p[k].x; pts[2*k+1]=s.p[k].y; pvs[2*k]=s.pv[k].x; pvs[2*k+1]=s.pv[k].y; }
    const pre=pl.tArr0==null; let asp=guideAspect(pts);
    if(pre && asp.r>cap){ /* the Style's stretch cap (--guide-curve), along the outline's long axis, before it lands */
      const k=cap/asp.r, ux=asp.ux, uy=asp.uy; for(let q=0;q<GUIDE_N;q++){ const x=pts[2*q], y=pts[2*q+1], al=x*ux+y*uy, d=(al-asp.mid)*(1-k); pts[2*q]=x-ux*d; pts[2*q+1]=y-uy*d; }
      asp=guideAspect(pts); }
    for(let q=0;q<GUIDE_N;q++){ /* the stretched outline itself stays inside the viewport, not only its centre */
      pts[2*q]=Math.max(1-s.c.x, Math.min(W-1-s.c.x, pts[2*q])); pts[2*q+1]=Math.max(1-s.c.y, Math.min(H-1-s.c.y, pts[2*q+1])); }
    const st=pl.strand; let sd=null;
    if(st && !st.dead){ const ar=st.snapped?st.ra*Math.max(0,1-(t-st.tSnap)/.09):st.ra; sd={ax:st.a.x, ay:st.a.y, ar, conn:!st.snapped, snap:st.snap}; }
    frames.push({t:t*1000, cx:s.c.x, cy:s.c.y, vx:s.v.x, vy:s.v.y, op:s.op, r:s.r, pts, pvs, strand:sd, asp:asp.r, pre});
  };
  while(true){
    if(t>=next-1e-9){ snap(); next+=1/60; }
    if(pl.done!=null || t>1.4) break;
    guideStepSim(s, t, GUIDE_DT); t+=GUIDE_DT;
  }
  snap();
  return {frames, dur:t*1000, arrive:(pl.tArr!=null?pl.tArr:t)*1000, arrive0:(pl.tArr0!=null?pl.tArr0:t)*1000,
    fill:(pl.tArr0!=null?pl.tArr0+pl.mouldT:t)*1000, snapAt:pl.strand&&pl.strand.tSnap!=null?pl.strand.tSnap*1000:null};
}
/* the outline's aspect along its long axis (sampled every 15 degrees): {r, ux, uy, mid} */
function guideAspect(pts){
  let best={r:1, ux:1, uy:0, mid:0};
  for(let a=0;a<12;a++){ const th=a*Math.PI/12, ux=Math.cos(th), uy=Math.sin(th);
    let a0=1e9,a1=-1e9,p0=1e9,p1=-1e9;
    for(let q=0;q<GUIDE_N;q++){ const x=pts[2*q], y=pts[2*q+1], al=x*ux+y*uy, pp=-x*uy+y*ux; if(al<a0)a0=al; if(al>a1)a1=al; if(pp<p0)p0=pp; if(pp>p1)p1=pp; }
    const r=(a1-a0)/Math.max(.5,p1-p0); if(r>best.r) best={r, ux, uy, mid:(a0+a1)/2}; }
  return best;
}
/* play a baked flight: the wrapper's transform/opacity run as one Web Animation (compositor); the outline follows in rAF */
function guidePlay(b, pl, P, ev){
  guideBodyStop(b);
  const sim=guideSimulate(b, pl, P), F=sim.frames, n=F.length, dur=Math.max(1, sim.dur);
  const kf=[]; const step=Math.max(1, Math.round(n/40));
  for(let i=0;i<n;i+=step){ const f=F[i]; kf.push({offset:Math.min(1,f.t/dur), transform:`translate(${gf(f.cx)}px,${gf(f.cy)}px)`, opacity:gf(f.op)}); }
  const L=F[n-1]; kf.push({offset:1, transform:`translate(${gf(L.cx)}px,${gf(L.cy)}px)`, opacity:gf(L.op)});
  for(let i=1;i<kf.length;i++) if(kf[i].offset<=kf[i-1].offset) kf[i].offset=Math.min(1,kf[i-1].offset+1e-6);
  b.frames=F; b.plan=pl; b.ev=Object.assign({sim, fired:{}}, ev||{}); b.lastIdx=-1;
  const a=b.wrap.animate(kf, {duration:dur, easing:'linear', fill:'forwards'}); b.anim=a;
  if(GUIDE.manual) a.pause();
  a.finished.then(()=>{ if(b.anim===a) guideBodyEnd(b); }).catch(()=>{});
  guideKick();
  return sim;
}
function guideBodyEnd(b){
  const F=b.frames, ev=b.ev; if(!F) return;
  guideBodyDraw(b, F.length-1); guideBodyFire(b, Infinity);
  const L=F[F.length-1]; b.c={x:L.cx, y:L.cy}; b.v={x:0,y:0}; b.op=L.op;
  for(let k=0;k<GUIDE_N;k++){ b.p[k].x=L.pts[2*k]; b.p[k].y=L.pts[2*k+1]; b.pv[k].x=0; b.pv[k].y=0; }
  const a=b.anim; b.anim=null; b.frames=null; b.plan=null; b.ev=null;
  b.wrap.style.transform=`translate(${gf(b.c.x)}px,${gf(b.c.y)}px)`; b.wrap.style.opacity=String(gf(b.op));
  try{ a && a.cancel(); }catch(e){}
  if(b.goo){ b.g.removeAttribute('filter'); b.goo=false; }
  if(ev && ev.onEnd) ev.onEnd(b);
  if(ev && ev.resolve) ev.resolve(true);
}
/* events inside a flight (arrival, the fill moment), fired from the loop when the animation's time passes them */
function guideBodyFire(b, ms){
  const ev=b.ev; if(!ev) return;
  if(ev.onArrive && !ev.fired.arrive && ms>=ev.sim.arrive0){ ev.fired.arrive=true; ev.onArrive(b); }
  if(ev.onFill && !ev.fired.fill && ms>=ev.sim.fill){ ev.fired.fill=true; ev.onFill(b); }
}
const gf=v=>Math.round(v*100)/100;
/* the closed Catmull-Rom curve through the outline points, as cubic Béziers (local to the centre) */
function guidePathD(p, flat){
  const n=GUIDE_N, X=flat?(i=>p[2*((i+n)%n)]):(i=>p[(i+n)%n].x), Y=flat?(i=>p[2*((i+n)%n)+1]):(i=>p[(i+n)%n].y);
  let d=`M${gf(X(0))} ${gf(Y(0))}`;
  for(let i=0;i<n;i++) d+=`C${gf(X(i)+(X(i+1)-X(i-1))/6)} ${gf(Y(i)+(Y(i+1)-Y(i-1))/6)} ${gf(X(i+1)-(X(i+2)-X(i))/6)} ${gf(Y(i+1)-(Y(i+2)-Y(i))/6)} ${gf(X(i+1))} ${gf(Y(i+1))}`;
  return d+'Z';
}
function guideBodyDraw(b, i){
  const F=b.frames; if(!F) return; const f=F[i]; if(i===b.lastIdx) return; b.lastIdx=i;
  b.path.setAttribute('d', guidePathD(f.pts, true));
  const sd=f.strand; let d='';
  if(sd){
    const ax=sd.ax-f.cx, ay=sd.ay-f.cy, ar=sd.ar;
    if(ar>.3) d+=`M${gf(ax+ar)} ${gf(ay)}A${gf(ar)} ${gf(ar)} 0 1 1 ${gf(ax-ar)} ${gf(ay)}A${gf(ar)} ${gf(ar)} 0 1 1 ${gf(ax+ar)} ${gf(ay)}Z`;
    if(sd.conn){
      const len=Math.hypot(ax,ay)||1, nx=ay/len, ny=-ax/len, wa=Math.max(1.2,ar*.8), wb=Math.max(1.2,f.r*.6), wm=Math.max(.9, 2.6*(1-len/sd.snap));
      d+=`M${gf(ax+nx*wa)} ${gf(ay+ny*wa)}Q${gf(ax/2+nx*wm)} ${gf(ay/2+ny*wm)} ${gf(nx*wb)} ${gf(ny*wb)}L${gf(-nx*wb)} ${gf(-ny*wb)}Q${gf(ax/2-nx*wm)} ${gf(ay/2-ny*wm)} ${gf(ax-nx*wa)} ${gf(ay-ny*wa)}Z`;
    }
  }
  b.strand.setAttribute('d', d);
  const goo=!!sd && !guideGooBlocked(); if(goo!==b.goo){ b.goo=goo; if(goo) b.g.setAttribute('filter','url(#gGoo)'); else b.g.removeAttribute('filter'); }
  if(goo) GUIDE.gooOnFrames++;
}
/* the loop: only while a flight plays; it reads the animation's own clock, so a busy main thread only delays the outline */
function guideKick(){ if(GUIDE.manual || GUIDE.raf) return; if(GUIDE.bodies.some(b=>b.anim)) GUIDE.raf=requestAnimationFrame(guideFrame); }
/* the gooey filter's frame-time guard: a frame over 24 ms while it is on turns it off (pure-path strand) for 3 s */
const guideGooBlocked=()=>performance.now()<GUIDE.gooUntil;
function guideGooTrip(dt){
  GUIDE.gooTrips++; GUIDE.gooUntil=performance.now()+3000;
  for(const b of GUIDE.bodies) if(b.goo){ b.g.removeAttribute('filter'); b.goo=false; }
  if(GUIDE.tetherPath) GUIDE.tetherPath.removeAttribute('filter');
}
function guideFrame(now){
  GUIDE.raf=0; GUIDE.rafCount++;
  now=+now||performance.now(); const dt=GUIDE.lastFrameT?now-GUIDE.lastFrameT:0; GUIDE.lastFrameT=now;
  if(dt>24 && GUIDE.bodies.some(b=>b.goo)) guideGooTrip(dt);
  for(const b of [...GUIDE.bodies]){ if(!b.anim || !b.frames) continue; const ms=+b.anim.currentTime||0; guideBodyDraw(b, Math.min(b.frames.length-1, Math.floor(ms/GUIDE_FR))); guideBodyFire(b, ms); }
  if(!GUIDE.manual && GUIDE.bodies.some(b=>b.anim)) GUIDE.raf=requestAnimationFrame(guideFrame); else GUIDE.lastFrameT=0;
}
function guideSleep(){ if(GUIDE.raf){ cancelAnimationFrame(GUIDE.raf); GUIDE.raf=0; } GUIDE.lastFrameT=0; }
/* captures and tests: hold the flights and step them by hand (ms) */
function guideManual(on){
  GUIDE.manual=!!on;
  for(const b of GUIDE.bodies) if(b.anim){ if(on) b.anim.pause(); else b.anim.play(); }
  if(on) guideSleep(); else guideKick();
}
function guideTick(ms){
  for(const b of [...GUIDE.bodies]){
    if(!b.anim || !b.frames) continue; const a=b.anim, dur=a.effect.getTiming().duration;
    const t=Math.min(dur, (+a.currentTime||0)+ms); a.currentTime=t;
    guideBodyDraw(b, Math.min(b.frames.length-1, Math.floor(t/GUIDE_FR))); guideBodyFire(b, t);
    if(t>=dur) guideBodyEnd(b);
  }
}
function guideBodyBox(b){ guideBodyNow(b); let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; for(const p of b.p){ x0=Math.min(x0,b.c.x+p.x); x1=Math.max(x1,b.c.x+p.x); y0=Math.min(y0,b.c.y+p.y); y1=Math.max(y1,b.c.y+p.y); } return {left:x0, top:y0, right:x1, bottom:y1}; }
/* ---------- flows ---------- */
function guideHideShapes(except){ for(const s of GUIDE.shapes) if(s!==except) s.firstChild.style.opacity='0'; }
function guideSetRest(t, b){
  if(!GUIDE.rest || GUIDE.rest.t.el!==t.el) GUIDE.screenSeq++;
  if(b.fill && t.el && t.el.isConnected) b.bg=guideRealStyle(t.el).bg; /* never a stale colour for the next lift */
  GUIDE.rest={t, b}; GUIDE.flying=false; GUIDE.lifted=false; GUIDE.held=false;
  if(GUIDE.layer) GUIDE.layer.dataset.at=b.fill?'fill':(t.kind||'mark');
  if(GUIDE.under) GUIDE.under();
  guideIdleReset();
}
/* settle on a target with no motion: the exact shape sits on the box; on a fill the real fill shows at once */
function guideRest(t, b){
  guideStopAnims(); clearTimeout(GUIDE.liftTimer);
  const s=GUIDE.shapes[GUIDE.cur];
  guideHideShapes(s); guideShapeAt(s, b, b.fill?0:1);
  guideBodyQuiet(GUIDE.main, b);
  guideClearOff(null);
  guideSetRest(t, b);
}
/* waking on a filled button: the exact fill draws in toward the middle and fades while the body gathers out of it */
function guideGatherFrom(box, A){
  const s=GUIDE.shapes[GUIDE.cur], w0=Math.min(box.w, box.h*2.4);
  if(box.fill){
    guideShapeAt(s, box, 1);
    guideAnim(s.firstChild, [{opacity:1, transform:'scale(1)'},{opacity:0, transform:`scale(${gf(Math.min(1,w0/box.w))},.92)`}], {duration:Math.max(40, A*450), easing:'ease-in'});
  }
  return guideOutline(w0, box.h, guideRadPx(box));
}
/* the body's colour: a fill target's own fill, else the mark colour. With --guide-xfade (Lively) the colour crossfades
   from where it woke over the wake instead of stepping at take-off. */
function guideColour(b, box, from){
  const to=box && box.fill && box.bg ? box.bg : guideMarkColour(), xf=guideParams().xfade;
  b.path.style.transition='none'; b.strand.style.transition='none';
  if(from && to && from!==to && xf>0 && guideParams().fly){
    b.path.style.fill=from; b.strand.style.fill=from; void getComputedStyle(b.path).fill;
    b.path.style.transition=`fill ${xf}ms ease-out`; b.strand.style.transition=`fill ${xf}ms ease-out`;
  }
  b.path.style.fill=to; b.strand.style.fill=to;
}
/* labels float on the liquid: an ink copy of the label (text and icons, the label's own on-fill colour) sits exactly
   over a target while a blob fills it, so "Continue", the Play triangle and active pills stay crisp, never veiled */
function guideInkOn(b, el){
  if(!b || !b.ink || !el || !el.isConnected) return;
  const r=el.getBoundingClientRect(); if(r.width<1) return;
  const cs=getComputedStyle(el), rs=guideRealStyle(el), ink=b.ink, st=ink.style;
  ink.innerHTML=el.innerHTML;
  const so=el.querySelectorAll('svg,img'), sd=ink.querySelectorAll('svg,img');
  so.forEach((x,i)=>{ const q=x.getBoundingClientRect(), d=sd[i]; if(d){ d.style.width=q.width+'px'; d.style.height=q.height+'px'; d.style.flex='none'; } });
  for(const k of ['display','alignItems','justifyContent','flexDirection','gap','paddingTop','paddingRight','paddingBottom','paddingLeft','fontFamily','fontSize','fontWeight','fontStyle',
    'lineHeight','letterSpacing','textTransform','textAlign','whiteSpace','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','fontVariantNumeric']) st[k]=cs[k];
  if(/^inline/.test(st.display)) st.display=st.display.replace('inline-','')||'block';
  st.width=r.width+'px'; st.height=r.height+'px'; st.transform=`translate(${gf(r.left)}px,${gf(r.top)}px)`; st.color=rs.color; st.opacity='1';
  b.inkOn=true; b.inkEl=el;
}
function guideInkOff(b){ if(!b || !b.ink || !b.inkOn) return; b.ink.style.opacity='0'; b.ink.innerHTML=''; b.inkOn=false; b.inkEl=null; }
/* a tap on Continue: it wakes on the button (squash, gather, lean toward the reader below, peel off with a strand
   that snaps) and waits there, gathered, for the reader */
function guideLift(el){
  if(!GUIDE.on || !GUIDE.rest) return;
  const P=guideParams(); if(!P.fly) return;
  const rb=GUIDE.rest.b, src=guideC(rb);
  ++GUIDE.token; guideStopAnims(); guideMergeNow(); clearTimeout(GUIDE.liftTimer);
  const b=guideMainBody(); guideBodyStop(b); b.c={x:src.x, y:src.y}; b.v={x:0,y:0}; b.r=P.size/2;
  guideHideShapes(null);
  const from=guideGatherFrom(rb, P.A); guideBodySet(b, from); guideColour(b, rb);
  if(rb.fill){ guideOff(GUIDE.rest.t.el, true); guideInkOn(b, GUIDE.rest.t.el); const tk=GUIDE.token; setTimeout(()=>{ if(tk===GUIDE.token) guideInkOff(b); }, P.A*900); }
  const down={x:innerWidth/2-src.x, y:innerHeight/2-src.y}, dl=Math.hypot(down.x,down.y)||1;
  const lean={x:down.x/dl, y:down.y/dl}, peel=Math.min(12, rb.h*.3+4);
  const dst={x:src.x+lean.x*peel, y:src.y+lean.y*peel};
  const pl=guidePlan(src, dst, P, {wake:true, from, lean, peel, T:0, hover:true, rT:P.size/2, kind:'lift', settle:Math.min(.1,P.settle),
    strand:{a:{x:src.x,y:src.y}, ra:Math.min(9, rb.h*.3), snap:peel*.8}});
  guidePlay(b, pl, P, {});
  GUIDE.lifted=true; GUIDE.flying=true; if(GUIDE.layer) GUIDE.layer.dataset.at='flight';
  GUIDE.liftT0=performance.now(); GUIDE.holdT0=0;
  GUIDE.liftTimer=setTimeout(()=>{ if(GUIDE.lifted) guideScreen(); }, 1600); /* the open didn't happen: go back */
}
/* the reader is coming up under the character: it never waits on the page. It goes out at once and comes back
   already flying, from the same spot, once the reader is laid out and its target can be measured */
function guideHold(){
  const b=GUIDE.main; if(!b || !(GUIDE.lifted || GUIDE.flying) || GUIDE.held) return;
  guideBodyNow(b); guideBodyStop(b); b.op=0; b.v={x:0,y:0}; guideBodySet(b, guideCircle(guideParams().size/2)); guideBodyPlace(b);
  guideSleep();
  GUIDE.held=true; GUIDE.lifted=true; GUIDE.flying=true; GUIDE.holdT0=performance.now();
  clearTimeout(GUIDE.liftTimer); GUIDE.liftTimer=setTimeout(()=>{ if(GUIDE.held) guideScreen(); }, 1600);
}
/* fly from where it is to box bx of target t */
function guideFly(t, bx, tok){
  const P=guideParams(), to=guideC(bx), prev=GUIDE.rest;
  /* the reader took over 150 ms to lay out: no arc over a page that just appeared, a clean 140 ms settle-in instead */
  if(GUIDE.held && GUIDE.holdT0 && performance.now()-GUIDE.holdT0>150) return guideSettleIn(t, bx, tok);
  guideStopAnims(); clearTimeout(GUIDE.liftTimer);
  const b=guideMainBody();
  const midAir=!!b.anim || GUIDE.lifted || GUIDE.held;
  let src, o={kind:'fly', r:P.size/2};
  guideBodyNow(b);
  if(midAir){ /* already up (flying, lifted or held): no new wind-up, it turns toward the new target */
    src={x:b.c.x, y:b.c.y};
    o.vel=Math.hypot(b.v.x,b.v.y)>30?{x:b.v.x, y:b.v.y}:null;
    if(GUIDE.held || b.op<.05) o.fadeIn=true;
    guideBodyStop(b);
  } else if(prev){
    src=guideC(prev.b); b.c={x:src.x, y:src.y}; b.v={x:0,y:0}; b.r=P.size/2;
    if(guideVisible(prev.t.el)){ /* wake on the spot it rests on, peel off it with a strand */
      guideHideShapes(null);
      o.wake=true; o.from=guideGatherFrom(prev.b, P.A); guideBodySet(b, o.from);
      o.strand={a:{x:src.x,y:src.y}, ra:Math.min(9, prev.b.h*.3+1), snap:10};
      if(prev.b.fill){ guideOff(prev.t.el, true); o.inkFrom=prev.t.el; }
    } else { /* the screen it rested on has gone: it comes in already moving */
      o.fadeIn=true; guideBodySet(b, guideCircle(b.r));
    }
  } else { src={x:to.x, y:to.y}; b.c={...src}; guideBodySet(b, guideCircle(b.r)); }
  const start=GUIDE.liftT0 && (GUIDE.lifted || GUIDE.held) ? GUIDE.liftT0 : performance.now();
  const hold=GUIDE.held && GUIDE.holdT0 ? performance.now()-GUIDE.holdT0 : 0;
  guideClearOff(o.wake && prev && prev.b.fill ? prev.t.el : null);
  if(bx.fill) guideOff(t.el, true);
  if(!o.wake) guideHideShapes(null);
  GUIDE.flying=true; GUIDE.lifted=false; GUIDE.held=false; GUIDE.liftT0=0; GUIDE.holdT0=0;
  if(GUIDE.layer) GUIDE.layer.dataset.at='flight';
  /* time already spent since the tap (wake, and the reader coming up while it was held) comes off the flight, then the
     settle, so tap-to-rest stays inside the budget however long the open took */
  if(GUIDE.liftT0 && start===GUIDE.liftT0){
    const over=Math.max(0, (performance.now()-start)/1000-P.A), cutT=Math.min(P.T*.45, over);
    o.T=P.T-cutT; o.settle=Math.max(P.settle*.6, P.settle-(over-cutT));
  }
  o.mould=guideOutline(bx.w, bx.h, guideRadPx(bx));
  o.rT=bx.fill?P.size/2:Math.max(2, Math.min(P.size/2, Math.min(bx.w,bx.h)/2));
  if(o.strand) o.strand.snap=Math.max(10, Math.min(12, Math.hypot(to.x-src.x,to.y-src.y)*.2)*.8);
  guideColour(b, bx, o.wake && prev ? (prev.b.fill && prev.b.bg ? prev.b.bg : guideMarkColour()) : null);
  b.tgt={el:t.el, kind:t.kind};
  if(o.inkFrom){ guideInkOn(b, o.inkFrom); setTimeout(()=>{ if(tok===GUIDE.token && b.inkEl===o.inkFrom) guideInkOff(b); }, P.A*900); }
  const pl=guidePlan(src, to, P, o);
  return new Promise(res=>{
    const sim=guidePlay(b, pl, P, {resolve:res,
      onArrive:()=>{ if(tok===GUIDE.token && bx.fill) guideInkOn(b, t.el); }, /* ink floats on the liquid while it fills */
      onFill:()=>{ if(tok===GUIDE.token && bx.fill) guideOff(t.el, false); }, /* the real fill comes back as the mould fills */
      onEnd:(body)=>{ guideHandOff(t, bx, tok, body, {start, hold, launch, sim}); res(true); }});
    const launch=performance.now();
  });
}
/* landed and moulded: the path fades into the exact shape (a mark) or the real fill (already back on a fill) */
function guideHandOff(t, bx, tok, body, info){
  if(tok!==GUIDE.token) return;
  const now=performance.now();
  GUIDE.flights.push({target:t.el.id||String(t.el.className||'').replace(/ ?guide-off/,''), kind:'fly', start:info.start, launch:info.launch,
    arrive:info.launch+info.sim.arrive, rest:now+60, hold:info.hold, style:document.documentElement.dataset.style});
  if(GUIDE.flights.length>60) GUIDE.flights.shift();
  GUIDE.cur=1-GUIDE.cur; const s=GUIDE.shapes[GUIDE.cur];
  guideHideShapes(s); guideShapeAt(s, bx, 0);
  if(bx.fill) guideOff(t.el, false);
  guideAnim(body.wrap, [{opacity:body.op},{opacity:0}], {duration:60, easing:'ease-out'});
  const a=bx.fill?guideAnim(s.firstChild, [{opacity:0},{opacity:0}], {duration:60}):guideAnim(s.firstChild, [{opacity:0},{opacity:1}], {duration:60, easing:'ease-out'});
  a.finished.then(()=>{
    if(tok!==GUIDE.token) return;
    guideStopAnims(); guideShapeAt(s, bx, bx.fill?0:1); guideInkOff(body); guideBodyQuiet(body, bx);
    guideSetRest(t, bx);
  }).catch(()=>{});
}
/* after a layout stall: the exact shape settles in at its spot over 140 ms (opacity and a small scale, no arc) */
function guideSettleIn(t, bx, tok){
  const start=GUIDE.liftT0||performance.now(), hold=GUIDE.holdT0?performance.now()-GUIDE.holdT0:0;
  guideStopAnims(); clearTimeout(GUIDE.liftTimer); guideMergeNow();
  guideBodyQuiet(GUIDE.main, bx); guideClearOff(null); if(bx.fill) guideOff(t.el, true);
  GUIDE.flying=true; GUIDE.lifted=false; GUIDE.held=false; GUIDE.liftT0=0; GUIDE.holdT0=0; GUIDE.settles++;
  if(GUIDE.layer) GUIDE.layer.dataset.at='flight';
  GUIDE.cur=1-GUIDE.cur; const s=GUIDE.shapes[GUIDE.cur]; guideHideShapes(s); guideShapeAt(s, bx, 0);
  if(bx.fill) s.firstChild.style.background=bx.bg;
  const a=guideAnim(s.firstChild, [{opacity:0, transform:'scale(.7)'},{opacity:1, transform:'scale(1)'}], {duration:140, easing:'ease-out'});
  return a.finished.then(()=>{
    if(tok!==GUIDE.token) return false;
    guideStopAnims(); if(bx.fill) guideOff(t.el, false); guideShapeAt(s, bx, bx.fill?0:1);
    const now=performance.now();
    GUIDE.flights.push({target:t.el.id||String(t.el.className||'').replace(/ ?guide-off/,''), kind:'settle', start, launch:now-140, arrive:now, rest:now, hold, style:document.documentElement.dataset.style});
    if(GUIDE.flights.length>60) GUIDE.flights.shift();
    guideSetRest(t, bx); return true;
  }).catch(()=>false);
}
/* with Reduce Motion: fade out at the old spot, fade in at the new one (opacity only, no physics, no rAF). A mark on
   a control that is going away (the reader's bars hiding) goes with it at once, never lingering over the page. */
function guideFade(t, b, tok){
  const P=guideParams();
  const old=GUIDE.shapes[GUIDE.cur]; GUIDE.cur=1-GUIDE.cur; const s=GUIDE.shapes[GUIDE.cur];
  const prev=GUIDE.rest; guideStopAnims(); clearTimeout(GUIDE.liftTimer);
  GUIDE.flying=true; GUIDE.lifted=false; GUIDE.held=false;
  guideBodyQuiet(GUIDE.main, null);
  guideClearOff(null);
  const v=$('#v-reader'), gone=!!(prev && v && v.classList.contains('chrome-off') && prev.t.el.closest && prev.t.el.closest('.rchrome'));
  if(prev && !gone){ guideShapeAt(old, prev.b, 1); if(prev.b.fill) guideOff(prev.t.el, true); } else old.firstChild.style.opacity='0';
  if(b.fill) guideOff(t.el, true);
  guideShapeAt(s, b, 0);
  if(!gone) guideAnim(old.firstChild, [{opacity:+old.firstChild.style.opacity||0},{opacity:0}], {duration:P.fade, easing:'ease-out'});
  if(prev && prev.b.fill) setTimeout(()=>{ if(tok===GUIDE.token) guideOff(prev.t.el,false); }, P.fade);
  const a=guideAnim(s.firstChild, [{opacity:0},{opacity:1}], {duration:P.fade, delay:P.fade, easing:'ease-out'});
  return a.finished.then(()=>{
    if(tok!==GUIDE.token) return false;
    guideStopAnims(); guideHideShapes(s); guideShapeAt(s, b, b.fill?0:1);
    if(b.fill) guideOff(t.el, false);
    guideBodyQuiet(GUIDE.main, b); guideSetRest(t, b);
    return true;
  }).catch(()=>false);
}
/* a step with several targets: mitosis. Droplets bud out of the main spot, each on a thin strand that snaps, and fly
   (slightly staggered) to their targets with their own landing jiggle. Max three in all. They rest a little below
   their controls, off labels and edges. */
const GUIDE_DROP=4;
function guideDropAt(b){ return {x:b.x+b.w/2, y:b.y+b.h/2+3}; }
function guideSplit(from, extras, tok){
  const P=guideParams(), c=guideC(from), R=GUIDE_DROP;
  guideMergeNow();
  GUIDE.extras=extras.slice(0, GUIDE_MAX-1).map(x=>({t:x.t, b:x.b, body:null}));
  GUIDE.splitOn=GUIDE.extras.length>0;
  if(GUIDE.layer) GUIDE.layer.dataset.split=String(GUIDE.extras.length+1);
  const main=GUIDE.shapes[GUIDE.cur];
  if(P.fly && main) main.firstChild.animate([{transform:'scale(1)'},{transform:'scale(.82,1.25)', offset:.35},{transform:'scale(1.08,.9)', offset:.7},{transform:'scale(1)'}], {duration:240, easing:'ease-out'});
  const jobs=GUIDE.extras.map((x,k)=>x.t.kind==='fill'?guideChildFly(c, x.t.el, {kind:'fill', box:x.b, delay:k*.04}):new Promise(res=>{
    const d=guideBodyNew('gdrop', R); x.body=d; const dst=guideDropAt(x.b);
    if(!P.fly){ d.c=dst; guideBodySet(d, guideCircle(R)); d.op=0; guideBodyPlace(d); guideAnim(d.wrap, [{opacity:0},{opacity:1}], {duration:P.fade, easing:'ease-out'}).finished.then(()=>{ d.op=1; d.wrap.style.opacity='1'; res(true); }).catch(()=>res(false)); return; }
    d.c={x:c.x, y:c.y}; guideBodySet(d, guideCircle(1.5)); d.r=1.5; d.op=1;
    const pl=guidePlan(c, dst, P, {wake:true, delay:k*.04, peel:6, r0wake:1.5, rT:R, T:P.T*.75, mould:guideCircle(R), hover:true, kind:'split', r:R,
      strand:{a:{x:c.x,y:c.y}, ra:2.4, snap:13}});
    guidePlay(d, pl, P, {onEnd:()=>{ GUIDE.snaps++; res(true); }});
  }));
  return Promise.all(jobs).then(()=>{ if(tok!==GUIDE.token) return; });
}
/* ---------- child blobs (v40): bud off the Source on a strand, arc to a control, fill its exact shape (labels stay on
   top) and hand off to its real fill; or land as a small drop that fades. Pool bodies only; nothing is created. ---------- */
function guideKidsStop(){
  GUIDE.ktok++;
  for(const k of [...GUIDE.kids]){ if(k.el){ guideOff(k.el, false); } if(k.body) guideBodyKill(k.body); }
  GUIDE.kids.clear();
}
/* the Source's spot right now (its rest, or where it is flying to) */
function guideSourceAt(){
  const r=GUIDE.rest; if(GUIDE.flying && GUIDE.flyTo && GUIDE.flyTo.b) return guideC(GUIDE.flyTo.b);
  return r?guideC(r.b):{x:innerWidth/2, y:innerHeight-30};
}
/* opts: kind 'fill'|'drop', box (measured), from (an outline: it starts as that shape, e.g. the previous option),
   fromBox, delay (s), onArrive(body). Resolves true when it has handed off. Reduce Motion: a 140 ms fade, no body. */
function guideChildFly(src, el, o){
  o=o||{}; const P=guideParams(), kt=GUIDE.ktok, fill=o.kind==='fill';
  const bx=o.box||guideBox({el, kind:fill?'fill':'mark'}); if(!bx) return Promise.resolve(false);
  if(fill) guideOff(el, true);
  const rec={el:fill?el:null, body:null}; GUIDE.kids.add(rec);
  const done=(ok)=>{ GUIDE.kids.delete(rec); if(rec.el){ guideOff(rec.el, false); } if(rec.body){ guideBodyKill(rec.body); rec.body=null; } return ok; };
  if(!P.fly){ /* Reduce Motion: the accent fades in at its spot */
    return new Promise(res=>setTimeout(()=>{ if(fill && el.isConnected) guideFadeIn(el); res(done(kt===GUIDE.ktok)); }, (o.delay||0)*1000));
  }
  const d=guideBodyNew('gdrop', GUIDE_DROP, false);
  if(!d){ if(fill) guideFadeIn(el); return Promise.resolve(done(false)); }
  rec.body=d; d.tgt={el, kind:fill?'fill':'mark'};
  const dst=o.point||(fill?guideC(bx):guideDropAt(bx));
  let po;
  if(o.from && o.fromBox){ const c0=guideC(o.fromBox); d.c={x:c0.x, y:c0.y}; guideBodySet(d, o.from); d.r=Math.min(o.fromBox.w,o.fromBox.h)/2; d.op=1;
    po={wake:true, delay:o.delay||0, from:o.from, peel:4, T:P.T*.8, kind:'xfer', r:GUIDE_DROP}; }
  else { d.c={x:src.x, y:src.y}; guideBodySet(d, guideCircle(1.5)); d.r=1.5; d.op=1;
    po={wake:true, delay:o.delay||0, peel:6, r0wake:1.5, T:P.T*.75, kind:'child', r:GUIDE_DROP, strand:{a:{x:src.x,y:src.y}, ra:2.4, snap:13}}; }
  po.rT=fill?P.size/2:GUIDE_DROP; po.mould=fill?guideOutline(bx.w, bx.h, guideRadPx(bx)):guideCircle(GUIDE_DROP); po.hover=!fill;
  guideColour(d, fill?bx:null, o.fromBg||null);
  const pl=guidePlan(o.from&&o.fromBox?guideC(o.fromBox):src, dst, P, po);
  return new Promise(res=>{
    guidePlay(d, pl, P, {
      onArrive:(b)=>{ if(kt!==GUIDE.ktok) return; if(fill) guideInkOn(b, el); if(o.onArrive) o.onArrive(b); },
      onFill:()=>{ if(kt===GUIDE.ktok && fill){ guideOff(el, false); rec.el=null; } },
      onEnd:(b)=>{
        if(kt!==GUIDE.ktok){ res(done(false)); return; }
        if(fill){ guideOff(el, false); rec.el=null; }
        b.fadeA=b.wrap.animate([{opacity:b.op},{opacity:0}], {duration:fill?60:Math.max(90,P.fade*.8), delay:fill?0:(o.linger||0), easing:'ease-out', fill:'forwards'});
        b.fadeA.finished.then(()=>{ b.fadeA=null; res(done(true)); }).catch(()=>res(done(false)));
      }});
  });
}
/* an accent that skips the droplet (Reduce Motion, a fast fling, more than three at once): a quick 140 ms CSS fade */
function guideFadeIn(el){
  el.classList.remove('guide-wait'); GUIDE.waits.delete(el); el.classList.remove('guide-fadein'); void el.offsetWidth; el.classList.add('guide-fadein');
  clearTimeout(el._gfi); el._gfi=setTimeout(()=>el.classList.remove('guide-fadein'), 200);
}
function guideMergeNow(){
  for(const x of GUIDE.extras) guideBodyKill(x.body);
  GUIDE.extras=[]; GUIDE.splitOn=false; if(GUIDE.layer){ delete GUIDE.layer.dataset.split; delete GUIDE.layer.dataset.merging; }
}
/* merge: the droplets are drawn back, touch, and are absorbed with a little ripple; then it moves on as one */
function guideMerge(tok){
  if(!GUIDE.splitOn || !GUIDE.rest) { guideMergeNow(); return Promise.resolve(); }
  const P=guideParams(), c=guideC(GUIDE.rest.b), main=GUIDE.shapes[GUIDE.cur];
  if(GUIDE.layer) GUIDE.layer.dataset.merging='1';
  const jobs=GUIDE.extras.map((x,k)=>new Promise(res=>{
    const d=x.body; if(!d){ res(); return; }
    if(!P.fly){ guideAnim(d.wrap, [{opacity:1},{opacity:0}], {duration:P.fade, easing:'ease-out'}).finished.then(()=>res()).catch(()=>res()); return; }
    const pl=guidePlan({x:d.c.x, y:d.c.y}, c, P, {wake:true, delay:k*.03, peel:0, T:P.T*.5, rT:1.5, kind:'merge', settle:.02, r:GUIDE_DROP});
    guidePlay(d, pl, P, {onArrive:(b)=>{
      guideBodyStop(b); b.op=0; guideBodyPlace(b);
      if(main) main.firstChild.animate([{transform:'scale(1.35,1.6)'},{transform:'scale(.9,.85)', offset:.45},{transform:'scale(1.04,1.05)', offset:.75},{transform:'scale(1)'}], {duration:220, easing:'ease-out'});
      res();
    }});
  }));
  return Promise.all(jobs).catch(()=>{}).then(()=>{
    if(GUIDE.layer) delete GUIDE.layer.dataset.merging;
    if(tok!==GUIDE.token) return;
    guideMergeNow();
  });
}
/* the director: screens call this when they appear. targets: up to 3 elements or {el, kind}; opts.main: the one the
   character goes to first (index or element; default the first); opts.snap: no motion (resize, rotation, re-render). */
function guideTo(targets, opts){
  opts=opts||{};
  if(!GUIDE.on) return Promise.resolve(false);
  guideMount();
  let list=(Array.isArray(targets)?targets:[targets]).map(guideNorm).filter(Boolean);
  if(!list.length) return Promise.resolve(false);
  if(GUIDE.tether && !opts.force){ /* the Source is held on its tether: only its home moves (no flight) */
    const m0=list[typeof opts.main==='number'&&list[opts.main]?opts.main:0], b0=guideBox(m0); if(b0){ GUIDE.rest={t:m0, b:b0}; guideTetherHome(); }
    return Promise.resolve(true);
  }
  let main=list[0];
  if(typeof opts.main==='number' && list[opts.main]) main=list[opts.main];
  else if(opts.main){ const m=list.find(x=>x.el===opts.main || x.el===(opts.main.el||null)); if(m) main=m; }
  list=[main, ...list.filter(x=>x!==main)].slice(0, GUIDE_MAX);
  const b=guideBox(main); if(!b) return Promise.resolve(false);
  const extras=list.slice(1).map(t=>({t, b:guideBox(t)})).filter(x=>x.b);
  if(GUIDE.flying && !GUIDE.lifted && !opts.snap && GUIDE.flyTo && GUIDE.flyTo.el===main.el && guideSame(GUIDE.flyTo.b, b) && !extras.length) return GUIDE.flyTo.p; /* already on its way there */
  const tok=++GUIDE.token;
  const P=guideParams();
  const prev=GUIDE.rest;
  const same=!GUIDE.flying && !GUIDE.lifted && prev && guideSame(prev.b, b) && prev.t.kind===main.kind;
  if(same && !opts.snap && extras.length && !GUIDE.splitOn){ guideRest(main, b); return guideSplit(b, extras, tok).then(()=>true); }
  if(opts.snap || same || (!prev && !GUIDE.flying && !GUIDE.lifted)){
    const keepSplit=same && GUIDE.splitOn && extras.length;
    if(!keepSplit) guideMergeNow();
    guideRest(main, b);
    if(extras.length && !keepSplit){
      GUIDE.extras=extras.slice(0,GUIDE_MAX-1).map(x=>{ if(x.t.kind==='fill') return {t:x.t, b:x.b, body:null}; /* a filled control shows its own real fill */
        const d=guideBodyNew('gdrop',GUIDE_DROP); d.c=guideDropAt(x.b); guideBodySet(d, guideCircle(GUIDE_DROP)); d.op=1; guideBodyPlace(d); return {t:x.t, b:x.b, body:d}; });
      GUIDE.splitOn=true; GUIDE.layer.dataset.split=String(GUIDE.extras.length+1);
    }
    return Promise.resolve(true);
  }
  const go=()=>{
    if(tok!==GUIDE.token) return false;
    const src=GUIDE.main && (GUIDE.main.anim || GUIDE.lifted || GUIDE.held) ? {...guideBodyNow(GUIDE.main).c} : (GUIDE.rest?guideC(GUIDE.rest.b):null);
    const p=(P.fly && !opts.fade)?guideFly(main, b, tok):guideFade(main, b, tok);
    GUIDE.flyTo={el:main.el, b, p};
    /* filled controls among the extras (Back: Continue) are child blobs that bud off the Source as it leaves and fill
       them while it flies home; their own fill stays off from now until the child pours in (one accent, no flash) */
    const kids=extras.filter(x=>x.t.kind==='fill').slice(0, GUIDE_MAX-1), marks=extras.filter(x=>x.t.kind!=='fill');
    if(kids.length){
      GUIDE.extras=kids.map(x=>({t:x.t, b:x.b, body:null})); GUIDE.splitOn=true; if(GUIDE.layer) GUIDE.layer.dataset.split=String(kids.length+1);
      const from=src||guideC(b);
      kids.forEach((x,k)=>guideChildFly(from, x.t.el, {kind:'fill', box:x.b, delay:(P.fly&&!opts.fade?P.A*.8:0)+k*.05}));
    }
    return p.then(ok=>{ if(ok && tok===GUIDE.token && marks.length) return guideSplit(b, marks, tok).then(()=>true); return ok; });
  };
  guideKidsStop();
  if(GUIDE.splitOn && !GUIDE.flying) return guideMerge(tok).then(go);
  guideMergeNow();
  return go();
}
function guideReaderTarget(){
  const v=$('#v-reader'); if(!v || v.hidden || !R.meta) return null;
  const bar=$('#ttsBar');
  if(bar && !bar.hidden) return {el:$('#ttsPlay'), kind:'fill'};
  if(R.mode==='speed') return {el:$('#playBtn'), kind:'fill'};
  const bp=$('#backPill'); if(bp && !bp.hidden && $('#backGo')) return {el:$('#backGo'), kind:'mark'}; /* Tethered Return: still on "Back to where you were" */
  if(!v.classList.contains('chrome-off')) return {el:$('#rScrub'), kind:'thumb'};
  return {el:$('#runFoot'), kind:'strip'};
}
function guideScreenTargets(){
  if(typeof TOUR!=='undefined' && TOUR.on) return GUIDE.tour;
  const v=$('#v-reader');
  if(v && !v.hidden){ const t=guideReaderTarget(); return t?[t]:null; }
  /* outside the reader the Source's home is the bottom tab bar (under the active tab's label); on the Library a child
     fills Continue (no Continue card: the Add to library fill) */
  const tab=document.querySelector('#tabs button[aria-current="page"]'), list=[];
  if(tab && !$('#tabs').hidden) list.push({el:tab, kind:'mark'});
  const lib=$('#v-library');
  if(lib && !lib.hidden){
    const go=document.querySelector('#v-library .continue-hero .hero-go');
    if(go) list.push({el:go, kind:'fill'});
    else { const add=$('#addBtn'); if(add && add.classList.contains('primary')) list.push({el:add, kind:'fill'}); else if(add && !list.length) list.push({el:add, kind:'mark'}); }
  }
  return list.length?list:null;
}
function guideScreen(opts){
  const t=guideScreenTargets(); if(!t || !t.length) return Promise.resolve(false);
  return guideTo(t, Object.assign({main:0}, opts||{}));
}
/* resolves once every running animation or transition on these elements (and their ancestors) has finished (max ms) */
function guideSettled(els, max){
  const list=[];
  for(const el of els||[]) for(let a=el; a && a!==document.body; a=a.parentElement){ let an=[]; try{ an=a.getAnimations(); }catch(e){}
    for(const x of an) if(x.playState==='running' && isFinite(x.effect && x.effect.getComputedTiming().endTime)) list.push(x.finished.catch(()=>{})); }
  return Promise.race([Promise.all(list), new Promise(r=>setTimeout(r, max||1000))]).then(()=>new Promise(r=>setTimeout(r, 20)));
}
/* the tour: each step names its targets; the first is the main spot */
function guideTour(targets){ GUIDE.tour=(targets||[]).filter(Boolean); if(GUIDE.tour.length) return guideTo(GUIDE.tour, {main:0}); return Promise.resolve(false); }
/* the guide on or off (tests compare layout with it on and off; it never changes layout either way) */
function guideSet(on){
  GUIDE.on=!!on; GUIDE.token++; guideStopAnims(); guideTetherEnd(true); guideKidsStop(); guideFocusOff(true); guideWaitsClear(); guideMergeNow(); guideClearOff(null); clearTimeout(GUIDE.liftTimer); GUIDE.lifted=false; GUIDE.held=false; GUIDE.flying=false;
  guideSleep(); for(const b of [...GUIDE.bodies]) guideBodyKill(b);
  if(!on){ if(GUIDE.layer) GUIDE.layer.remove(); GUIDE.layer=null; GUIDE.rest=null; GUIDE.main=null; GUIDE.bodies=[]; GUIDE.pool=[]; return; }
  guideMount(); GUIDE.rest=null; guideScreen({snap:true});
}
/* ---------- personality at rest: a happy squish when you tap the button it fills; one idle hop (outside the reader) ---------- */
function guideRingOn(b){
  const g=GUIDE.ring; if(!g) return null;
  g.style.width=b.w+'px'; g.style.height=b.h+'px'; g.style.transform=`translate(${b.x}px,${b.y}px)`;
  g.firstChild.style.borderRadius=b.rad; return g.firstChild;
}
function guidePulse(){
  const r=GUIDE.rest; if(!r || GUIDE.flying || GUIDE.lifted || !GUIDE.on) return;
  if(!guideParams().fly) return;
  GUIDE.pulses++;
  if(r.b.fill){ const i=guideRingOn(r.b); if(i) i.animate([{opacity:.9, transform:'scale(.95,.86)'},{opacity:.7, transform:'scale(1.05,1.08)', offset:.45},{opacity:0, transform:'scale(1.12)'}], {duration:340, easing:'cubic-bezier(.34,1.56,.64,1)'}); }
  else { const i=GUIDE.shapes[GUIDE.cur].firstChild; i.animate([{transform:'scale(1)'},{transform:'scale(1.25,.6)', offset:.3},{transform:'scale(.92,1.2)', offset:.65},{transform:'scale(1)'}], {duration:300, easing:'ease-out'}); }
}
function guideIdleReset(){
  clearTimeout(GUIDE.idleTimer);
  if(GUIDE.nudgeAnim){ try{ GUIDE.nudgeAnim.cancel(); }catch(e){} GUIDE.nudgeAnim=null; } /* any touch cancels a hop under way */
  if(GUIDE.on) GUIDE.idleTimer=setTimeout(guideNudge, GUIDE.idleMs);
}
function guideNudge(){
  const r=GUIDE.rest, v=$('#v-reader');
  if(!r || !GUIDE.on || GUIDE.flying || GUIDE.lifted || GUIDE.splitOn) return;
  if(v && !v.hidden) return;                                   /* never in the reader */
  if(GUIDE.nudged===GUIDE.screenSeq || !guideParams().fly || document.hidden) return; /* once per screen; never with Reduce Motion */
  if(document.documentElement.classList.contains('guide-under') || !guideVisible(r.t.el)) return;
  GUIDE.nudged=GUIDE.screenSeq; GUIDE.nudges++;
  if(r.b.fill){ const i=guideRingOn(r.b); if(i) GUIDE.nudgeAnim=i.animate([{opacity:0, transform:'translateY(0) scale(1)'},{opacity:.8, transform:'translateY(1px) scale(1.03,.92)', offset:.2},{opacity:.7, transform:'translateY(-4px) scale(.98,1.04)', offset:.5},{opacity:.4, transform:'translateY(0) scale(1.02,.97)', offset:.78},{opacity:0, transform:'translateY(0) scale(1)'}], {duration:520, easing:'ease-out'}); }
  else { const i=GUIDE.shapes[GUIDE.cur].firstChild; GUIDE.nudgeAnim=i.animate([{transform:'translateY(0)'},{transform:'translateY(1px) scale(1.2,.7)', offset:.2},{transform:'translateY(-4px) scale(.9,1.15)', offset:.5},{transform:'translateY(0) scale(1.08,.9)', offset:.78},{transform:'none'}], {duration:480, easing:'ease-out'}); }
}
/* ---------- v40: colours follow a Style or page-colour change, even mid-flight ---------- */
function guideRecolour(){
  if(!GUIDE.layer) return;
  const mc=guideMarkColour();
  for(const b of GUIDE.bodies){
    if(b.free) continue; const t=b.tgt; let c=mc;
    if(t && t.kind==='fill' && t.el && t.el.isConnected) c=guideRealStyle(t.el).bg;
    b.path.style.transition='none'; b.strand.style.transition='none'; b.path.style.fill=c; b.strand.style.fill=c;
    if(b.inkOn && b.inkEl && b.inkEl.isConnected) b.ink.style.color=guideRealStyle(b.inkEl).color;
  }
  const r=GUIDE.rest; if(r && r.b.fill && r.t.el && r.t.el.isConnected) r.b.bg=guideRealStyle(r.t.el).bg;
  const f=GUIDE.flyTo; if(f && f.b && f.b.fill && f.el && f.el.isConnected) f.b.bg=guideRealStyle(f.el).bg;
  for(const x of GUIDE.extras) if(x.b && x.b.fill && x.t.el && x.t.el.isConnected) x.b.bg=guideRealStyle(x.t.el).bg;
}
/* ---------- v40: option-to-option transfers ([data-accent-group]) ----------
   Changing the selection in a group of mutually exclusive options: a child blob shrinks out of the option that was on
   and arcs straight into the new one (its fill, or a small drop under it when the option shows its state by a ring). */
const GUIDE_ACTIVE='[aria-pressed="true"],[aria-checked="true"],input:checked';
const GUIDE_OPT='[data-accent-group] button,[data-accent-group] [role="radio"]';
function guideGroupActive(g){ if(!g) return null; for(const x of g.querySelectorAll(GUIDE_ACTIVE)) if(x.closest('[data-accent-group]')===g && guideVisible(x)) return x; return null; }
function guideAccentEl(opt){ return (opt && opt.querySelector('[data-accent-fill]')) || opt; }
function guideRawBg(el){
  const off=el.classList.contains('guide-off'), wt=el.classList.contains('guide-wait');
  if(!off && !wt) return getComputedStyle(el).backgroundColor;
  const tr=el.style.transition; el.style.transition='none'; el.classList.remove('guide-off','guide-wait'); const bg=getComputedStyle(el).backgroundColor;
  if(off) el.classList.add('guide-off'); if(wt) el.classList.add('guide-wait'); void getComputedStyle(el).backgroundColor; el.style.transition=tr; return bg;
}
/* fill: the accent is the control's own fill (a pill, a switch, a check badge); mark: it shows its state another way */
function guideAccentKind(el){
  const bg=guideRawBg(el); if(guideClear(bg)) return 'mark';
  if(el.hasAttribute('data-accent-fill') || el.matches('.switch,.hero-go,.btn.primary')) return 'fill';
  const opt=el.closest(GUIDE_OPT), g=opt && opt.closest('[data-accent-group]');
  if(g){ const other=[...g.querySelectorAll('button,[role="radio"]')].find(x=>x!==opt && !x.matches(GUIDE_ACTIVE)); if(other && guideRawBg(other)===bg) return 'mark'; }
  return 'fill';
}
function guideXferDown(e){
  GUIDE.xfer=null;
  const opt=e.target && e.target.closest && e.target.closest(GUIDE_OPT); if(!opt || !GUIDE.on) return;
  const g=opt.closest('[data-accent-group]'), prev=guideGroupActive(g); if(!prev || prev===opt) return;
  const key=g.getAttribute('data-accent-group'), idx=[...document.querySelectorAll(`[data-accent-group="${key}"]`)].indexOf(g);
  const pel=guideAccentEl(prev), kind=guideAccentKind(pel), box=guideBox({el:pel, kind:kind==='fill'?'fill':'mark'}); if(!box) return;
  GUIDE.xfer={key, idx, kind, box, bg:kind==='fill'?box.bg:null, prevV:prev.dataset.v||prev.dataset.stylePick||'', t:performance.now()};
}
function guideXferClick(){
  const x=GUIDE.xfer; if(!x || performance.now()-x.t>1500) return; GUIDE.xfer=null;
  let tries=0; const go=()=>{
    const gs=document.querySelectorAll(`[data-accent-group="${x.key}"]`), g=gs[x.idx]||gs[0], act=guideGroupActive(g);
    const v=act && (act.dataset.v||act.dataset.stylePick||'');
    if(!act || (v===x.prevV && tries<6)){ if(++tries<=6) setTimeout(go, 50); return; } /* a re-render (a view transition) still on its way */
    if(v===x.prevV) return;
    const el=guideAccentEl(act), kind=guideAccentKind(el), bx=guideBox({el, kind:kind==='fill'?'fill':'mark'}); if(!bx || guideSame(bx, x.box)) return;
    GUIDE.seen.add(el); GUIDE.seen.add(act); GUIDE.transfers++;
    el.classList.remove('guide-wait'); GUIDE.waits.delete(el);
    guideChildFly(guideC(x.box), el, {kind, box:bx, from:guideOutline(x.box.w, x.box.h, guideRadPx(x.box)), fromBox:x.box, fromBg:x.bg, linger:kind==='fill'?0:420});
  };
  setTimeout(go, 0);
}
/* ---------- v40: focus-border wrap ----------
   Focusing a search field sends a droplet from the Source to the field; a strand then traces its border
   (stroke-dashoffset on the one focus <rect>, as a CSS transition). Blur unzips it and a droplet goes home. */
const GUIDE_FINDS='#libFind,#notesFind,#srchIn,#hlFind';
function guideFocusBox(el){
  const r=el.getBoundingClientRect(), cs=getComputedStyle(el), rad=parseFloat(cs.borderTopLeftRadius)||0;
  const x=r.left-2, y=r.top-2, w=r.width+4, h=r.height+4, rx=Math.max(0, Math.min(rad+2, h/2, w/2));
  return {x, y, w, h, rx, len:2*(w+h-4*rx)+2*Math.PI*rx};
}
function guideFocusPlace(b){ const R_=GUIDE.focusRect; R_.setAttribute('x',gf(b.x)); R_.setAttribute('y',gf(b.y)); R_.setAttribute('width',gf(b.w)); R_.setAttribute('height',gf(b.h)); R_.setAttribute('rx',gf(b.rx)); R_.style.strokeDasharray=gf(b.len)+' '+gf(b.len+4); }
function guideFocusOn(el){
  if(!GUIDE.on || !el || !guideVisible(el)) return;
  guideMount(); const P=guideParams(), R_=GUIDE.focusRect, tk=++GUIDE.focusT, b=guideFocusBox(el);
  GUIDE.focusEl=el; GUIDE.focusBox=b; el.classList.add('guide-focus');
  R_.style.transition='none'; guideFocusPlace(b); R_.style.strokeDashoffset=gf(b.len); R_.style.opacity='1'; void R_.getBoundingClientRect();
  if(!P.fly){ R_.style.strokeDashoffset='0'; R_.style.opacity='0'; void getComputedStyle(R_).opacity; R_.style.transition=`opacity ${P.fade}ms ease-out`; R_.style.opacity='1'; GUIDE.traces++; return; }
  const trace=()=>{ if(tk!==GUIDE.focusT) return; R_.style.transition=`stroke-dashoffset ${P.trace}ms cubic-bezier(.45,0,.2,1)`; R_.style.strokeDashoffset='0'; GUIDE.traces++; };
  const from=GUIDE.pourFrom||guideSourceAt(); GUIDE.pourFrom=null;
  const start={x:b.x+b.rx, y:b.y};
  guideChildFly(from, el, {kind:'drop', point:start, box:{x:start.x-1, y:start.y-1, w:2, h:2, rad:'50%', fill:false}, onArrive:trace}).then(ok=>{ if(!ok) trace(); });
}
function guideFocusOff(instant){
  const el=GUIDE.focusEl; if(!el) return; GUIDE.focusEl=null; el.classList.remove('guide-focus');
  const R_=GUIDE.focusRect, P=guideParams(), b=GUIDE.focusBox, tk=++GUIDE.focusT; if(!R_) return;
  const hide=()=>{ if(tk!==GUIDE.focusT) return; R_.style.transition='none'; R_.style.opacity='0'; R_.setAttribute('width','0'); R_.setAttribute('height','0'); };
  if(instant || !b || !guideVisible(el)){ hide(); return; }
  GUIDE.unzips++;
  if(!P.fly){ R_.style.transition=`opacity ${P.fade}ms ease-out`; R_.style.opacity='0'; setTimeout(hide, P.fade+20); return; }
  const dur=Math.round(P.trace*.7); R_.style.transition=`stroke-dashoffset ${dur}ms cubic-bezier(.5,0,.75,0)`; R_.style.strokeDashoffset=gf(-b.len);
  setTimeout(()=>{ hide(); if(GUIDE.on && GUIDE.rest){ const home=guideSourceAt(); guideChildFly({x:b.x+b.rx, y:b.y}, el, {kind:'drop', point:home, box:{x:home.x-1,y:home.y-1,w:2,h:2,rad:'50%',fill:false}}); } }, dur);
}
function guideFocusSync(){ const el=GUIDE.focusEl; if(!el || !GUIDE.focusRect) return; if(!guideVisible(el)){ guideFocusOff(true); return; } const b=guideFocusBox(el); GUIDE.focusBox=b; guideFocusPlace(b); }
/* ---------- v40: child blobs fill accented controls as Settings (or Notes, Stats) scroll them into view ----------
   An IntersectionObserver (threshold .92, a little inward) watches the accented controls; a velocity + ~120 ms settle
   gate decides: a fast fling (over 900 px/s) just fades them in (140 ms CSS), a normal scroll sends staggered droplets
   from the Source, at most 3 per wave. Each control fires once per visit (reset on a tab switch). Until then an accent
   that is coming into view waits without its fill (guide-wait), so it never flashes filled, empty, filled. */
const GUIDE_WATCH=['settings','stats','words'];
const GUIDE_ACC='.switch:checked,.seg button[aria-pressed="true"],.chip[aria-pressed="true"],[aria-checked="true"] [data-accent-fill]';
function guideWaitsClear(){ for(const el of [...GUIDE.waits]) el.classList.remove('guide-wait'); GUIDE.waits.clear(); }
function guideView(v){
  const w=GUIDE.wave;
  guideKidsStop(); guideWaitsClear(); GUIDE.seen=new WeakSet(); w.pending.clear(); clearTimeout(w.timer); w.peak=0; w.lastY=null; w.view=v;
  if(w.io){ w.io.disconnect(); w.io=null; } if(w.mo){ w.mo.disconnect(); w.mo=null; }
  if(GUIDE.focusEl && !guideVisible(GUIDE.focusEl)) guideFocusOff(true);
  if(!GUIDE.on || !GUIDE_WATCH.includes(v) || typeof IntersectionObserver!=='function') return;
  const view=$('#v-'+v); if(!view) return;
  w.io=new IntersectionObserver(guideWaveSeen, {root:view, threshold:[0,.92], rootMargin:'-6px 0px -6px 0px'});
  w.mo=new MutationObserver(()=>{ clearTimeout(w.moT); w.moT=setTimeout(()=>guideWaveScan(view), 60); });
  w.mo.observe(view, {childList:true, subtree:true});
  guideWaveScan(view);
}
function guideWaveScan(view){ const w=GUIDE.wave; if(!w.io || view.hidden) return; for(const el of view.querySelectorAll(GUIDE_ACC)) if(!GUIDE.seen.has(el)) w.io.observe(el); }
function guideWaveSeen(entries){
  const w=GUIDE.wave;
  for(const e of entries){
    const el=e.target; if(GUIDE.seen.has(el) || guideKidOwns(el)){ w.io && w.io.unobserve(el); continue; }
    if(!el.isConnected || !el.matches(GUIDE_ACC)){ el.classList.remove('guide-wait'); GUIDE.waits.delete(el); w.pending.delete(el); w.io && w.io.unobserve(el); continue; }
    if(e.isIntersecting && !GUIDE.tether){
      if(!el.classList.contains('guide-wait')){ el.classList.add('guide-wait'); GUIDE.waits.add(el); }
      if(e.intersectionRatio>=.9) w.pending.add(el); else w.pending.delete(el);
    } else { el.classList.remove('guide-wait'); GUIDE.waits.delete(el); w.pending.delete(el); }
  }
  guideWaveArm();
}
function guideWaveScroll(e){
  const w=GUIDE.wave; if(!w.io) return; const t=e.target, view=$('#v-'+w.view); if(!view || (t!==view && !(t.closest && view.contains(t)))) return;
  const now=performance.now(), y=t.scrollTop||0;
  if(w.lastY!=null){ const dt=now-w.lastT; if(dt>0 && dt<120){ const sp=Math.abs(y-w.lastY)/dt*1000; if(sp>w.peak) w.peak=sp; } }
  w.lastY=y; w.lastT=now; w.lastScroll=now; guideWaveArm();
}
function guideWaveArm(){ const w=GUIDE.wave; clearTimeout(w.timer); if(!w.pending.size && !GUIDE.waits.size) return; w.timer=setTimeout(guideWaveFlush, 120); }
function guideWaveFlush(){
  const w=GUIDE.wave;
  if(performance.now()-w.lastScroll<110){ guideWaveArm(); return; }  /* still moving: wait for the settle */
  const fast=w.peak>900; w.peak=0; w.lastY=null;
  const list=[...w.pending].filter(el=>el.isConnected && guideVisible(el) && el.matches(GUIDE_ACC)); w.pending.clear();
  for(const el of [...GUIDE.waits]) if(!list.includes(el)){ GUIDE.seen.add(el); guideFadeIn(el); }   /* half in view at the settle: just fade in */
  if(!list.length) return;
  list.sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1);
  for(const el of list){ GUIDE.seen.add(el); w.io && w.io.unobserve(el); }
  const P=guideParams(), under=document.documentElement.classList.contains('guide-under');
  if(fast || !P.fly || GUIDE.tether || under || !GUIDE.on){ list.forEach(guideFadeIn); w.faded+=list.length; return; }
  const send=list.slice(0,3), rest=list.slice(3); rest.forEach(guideFadeIn); w.faded+=rest.length;
  w.waves++; w.sent+=send.length; w.maxWave=Math.max(w.maxWave, send.length);
  const src=guideSourceAt();
  send.forEach((el,k)=>{ el.classList.remove('guide-wait'); GUIDE.waits.delete(el); guideChildFly(src, el, {kind:guideAccentKind(el), delay:k*.06, linger:300}); });
}
/* ---------- v40: tap-and-hold tether + Accent Gravity ----------
   Hold the Source (its tab, or in the reader the scrubber / the bottom progress mark) or an active accent (Continue,
   the chosen option) for ~240 ms without moving more than 8 px (moving first is a scroll and native scrolling wins;
   reading prose is never a grab point). The blob is pulled out above the thumb on a live tapered strand (one rAF only
   while held) and drags: onto a book (opens it), a Style tile or page colour (live preview; release commits, pulling
   away reverts), a search field (focuses it and pours into its border), along the tabs (scrubs them), or, on the
   scrubber, upward (finer scrubbing). Release anywhere else: it snaps home and nothing changes. */
const GUIDE_PROSE='#pagesView,#scFlow,#pgClip,#scView,#scrollView,#stage,#tour,#pgMeasure';
function guideGrab(e){
  const t=e.target; if(!t || !t.closest || !GUIDE.layer) return null;
  if(t.closest(GUIDE_PROSE)) return null;                                   /* never on reading prose */
  if(t.closest('textarea,[contenteditable],input:not([type="range"]):not([type="checkbox"])')) return null;
  const v=$('#v-reader'), inReader=!!(v && !v.hidden);
  if(inReader){
    const sc=$('#rScrub');
    if(sc && t===sc && !v.classList.contains('chrome-off')) return {kind:'scrub', el:sc};
    if(v.classList.contains('chrome-off')){ const f=$('#runFoot'), r=f && f.getBoundingClientRect(); if(r && r.width && e.clientY>=r.top-14 && !t.closest('.rchrome,#ttsBar,#backPill,#sheet')) return {kind:'strip', el:f}; }
  } else {
    const r=GUIDE.rest; if(r && r.t.el && (r.t.el===t || r.t.el.contains(t))) return {kind:'source', el:r.t.el};
    const go=t.closest('#v-library .hero-go'); if(go) return {kind:'accent', el:go};
  }
  const opt=t.closest(GUIDE_OPT); if(opt && opt.matches(GUIDE_ACTIVE) && (opt.closest('#v-settings') || opt.closest('#sheet .themes'))) return {kind:'accent', el:opt};
  return null;
}
function guideTouchBlock(e){ if(GUIDE.tether && e.cancelable) e.preventDefault(); }
function guideTetherDown(e){
  if(!GUIDE.on || GUIDE.tether || (e.button||0)>0 || e.isPrimary===false) return;
  if(typeof TOUR!=='undefined' && TOUR.on) return;
  const g=guideGrab(e); if(!g) return;
  guideTetherCancel();
  document.addEventListener('touchmove', guideTouchBlock, {passive:false, capture:true});
  GUIDE.pend={x:e.clientX, y:e.clientY, id:e.pointerId, g, timer:setTimeout(guideTetherStart, guideParams().hold)};
}
function guideTetherCancel(){ const p=GUIDE.pend; if(!p) return; clearTimeout(p.timer); GUIDE.pend=null; if(!GUIDE.tether) document.removeEventListener('touchmove', guideTouchBlock, {capture:true}); }
function guideTetherMove(e){
  const p=GUIDE.pend;
  if(p && e.pointerId===p.id && Math.hypot(e.clientX-p.x, e.clientY-p.y)>8) guideTetherCancel(); /* it's a scroll or a drag of its own */
  const T=GUIDE.tether; if(T && e.pointerId===T.id){ T.x=e.clientX; T.y=e.clientY; guideTetherKick(); }
}
function guideTetherUp(e){
  if(GUIDE.pend && e.pointerId===GUIDE.pend.id) guideTetherCancel();
  const T=GUIDE.tether; if(T && e.pointerId===T.id){ T.x=e.clientX||T.x; T.y=e.clientY||T.y; guideTetherRelease(e.type==='pointercancel'); }
}
function guideTetherHomeAt(T){
  if(T.sc){ const k=T.kind==='scrub'?{el:T.sc, kind:'thumb'}:{el:T.el, kind:'strip'}; const b=guideBox(k); return b?guideC(b):T.home; }
  if(T.kind==='source' && GUIDE.rest) return guideC(GUIDE.rest.b);
  return T.home;
}
function guideTetherHome(){ const T=GUIDE.tether; if(T){ T.home=guideTetherHomeAt(T); guideTetherKick(); } }
function guideTetherStart(){
  const p=GUIDE.pend; GUIDE.pend=null; if(!p || !GUIDE.on) return;
  const P=guideParams(), g=p.g, r=g.el.getBoundingClientRect();
  ++GUIDE.token; guideStopAnims(); clearTimeout(GUIDE.liftTimer); guideKidsStop(); guideSleep();
  const T={kind:g.kind, el:g.el, id:p.id, x:p.x, y:p.y, x0:p.x, y0:p.y, over:null, paint:null, raf:0, sens:1, t0:performance.now(),
    home:g.kind==='source'&&GUIDE.rest?guideC(GUIDE.rest.b):{x:r.left+r.width/2, y:r.top+r.height/2}, gooTill:performance.now()+110};
  if(g.kind==='scrub' || g.kind==='strip'){ const sc=$('#rScrub'); T.sc=sc; T.v=+sc.value||0; T.vf=T.v; T.track=(g.kind==='scrub'?sc:g.el).getBoundingClientRect(); T.lx=p.x; T.home=guideTetherHomeAt(T); }
  GUIDE.tether=T; GUIDE.flying=false; GUIDE.lifted=false; GUIDE.held=false;
  document.documentElement.classList.add('guide-tether');
  if(P.fly){
    guideHideShapes(null);
    const b=guideMainBody(); guideBodyStop(b); b.r=P.size/2; b.c={x:T.home.x, y:T.home.y}; b.op=1; guideBodySet(b, guideCircle(b.r)); guideColour(b, null); b.tgt=null; guideBodyPlace(b);
    GUIDE.tetherPath.style.fill=guideMarkColour(); GUIDE.tetherPath.style.opacity=String(P.top);
    if(!guideGooBlocked()) GUIDE.tetherPath.setAttribute('filter','url(#gGoo)');
  }
  guideTetherKick();
}
function guideTetherKick(){ const T=GUIDE.tether; if(!T) return; if(!guideParams().fly){ guideTetherFrame(); return; } if(!T.raf) T.raf=requestAnimationFrame(guideTetherFrame); }
function guideTetherFrame(now){
  const T=GUIDE.tether; if(!T) return; T.raf=0; GUIDE.tetherFrames++;
  const P=guideParams(), fly=P.fly, W=innerWidth, H=innerHeight, rr=P.size/2;
  if(fly){ GUIDE.rafCount++; now=+now||performance.now(); const dt=GUIDE.lastFrameT?now-GUIDE.lastFrameT:0; GUIDE.lastFrameT=now; if(dt>24 && GUIDE.tetherPath.hasAttribute('filter')) guideGooTrip(dt); }
  const bx=Math.max(rr+2, Math.min(W-rr-2, T.x)), by=Math.max(rr+2, Math.min(H-rr-2, T.y-P.lift));
  T.bx=bx; T.by=by;
  /* fine scrubbing: pulling up off the track lowers the sensitivity smoothly */
  if(T.sc){
    const tr=T.track, mn=+T.sc.min||0, mx=+T.sc.max||1, span=Math.max(1, mx-mn), up=Math.max(0, tr.top-T.y);
    T.sens=Math.max(.05, 1/(1+up/50));
    const dx=T.x-T.lx; T.lx=T.x;
    T.vf=Math.max(mn, Math.min(mx, T.vf+dx/Math.max(40, tr.width-16)*span*T.sens));
    const nv=Math.round(T.vf); if(nv!==T.v){ T.v=nv; T.self=true; T.sc.value=String(nv); T.sc.dispatchEvent(new Event('input', {bubbles:true})); T.self=false; }
  } else {
    const over=guideGravityAt(bx, by, T.x, T.y);
    if((over&&over.el)!==(T.over&&T.over.el)) guideGravitySwap(T, over);
  }
  T.home=guideTetherHomeAt(T);
  if(!fly) return;
  const b=GUIDE.main; if(!b) return;
  const hx=T.home.x, hy=T.home.y, dx=bx-hx, dy=by-hy, dist=Math.hypot(dx,dy)||1, ux=dx/dist, uy=dy/dist, ten=Math.min(1, dist/240);
  const st=Math.min(P.curve, 1+(P.curve-1)*ten*.6), pts=[];
  for(let i=0;i<GUIDE_N;i++){ const u=GUIDE_UC[i]; let al=(u.x*ux+u.y*uy)*rr, pp=(-u.x*uy+u.y*ux)*rr; al*= al<0?st:1+(st-1)*.35; pp/=Math.sqrt(st); pts.push({x:ux*al-uy*pp, y:uy*al+ux*pp}); }
  b.c={x:bx, y:by}; guideBodySet(b, pts);
  b.wrap.style.transform=`translate(${gf(bx)}px,${gf(by)}px)`; b.wrap.style.opacity='1'; b.path.setAttribute('d', guidePathD(b.p));
  /* the strand: a tapered quadratic ribbon from home to the blob, sagging with the Style's gravity (--guide-sag) */
  const wa=P.tw*(1.7-ten*.6), wb=Math.max(.8, P.tw*.8), sag=P.sag*ten, mx_=(hx+bx)/2, my_=(hy+by)/2+sag, nx=-uy, ny=ux, wm=Math.max(.5, P.tw*(1-ten*.55));
  GUIDE.tetherPath.setAttribute('d', `M${gf(hx+nx*wa)} ${gf(hy+ny*wa)}Q${gf(mx_+nx*wm)} ${gf(my_+ny*wm)} ${gf(bx+nx*wb)} ${gf(by+ny*wb)}L${gf(bx-nx*wb)} ${gf(by-ny*wb)}Q${gf(mx_-nx*wm)} ${gf(my_-ny*wm)} ${gf(hx-nx*wa)} ${gf(hy-ny*wa)}Z`);
  if(GUIDE.tetherPath.hasAttribute('filter') && performance.now()>T.gooTill) GUIDE.tetherPath.removeAttribute('filter');
}
function guideGravityAt(bx, by, fx, fy){
  const tabs=$('#tabs');
  if(tabs && !tabs.hidden){ const r=tabs.getBoundingClientRect(); if(r.height && fy>=r.top-28 && fy<=r.bottom+12){
    const btn=[...tabs.querySelectorAll('button[data-tab]')].find(x=>{ const q=x.getBoundingClientRect(); return fx>=q.left && fx<q.right; }); return btn?{type:'tab', el:btn}:null; } }
  const hit=document.elementFromPoint(bx, by); if(!hit || !hit.closest) return null;
  const inp=hit.closest(GUIDE_FINDS); if(inp) return {type:'search', el:inp};
  const tile=hit.closest('#stylePick [data-style-pick]'); if(tile) return {type:'style', el:tile, v:tile.dataset.stylePick};
  const sw=hit.closest('.themes button[data-v]'); if(sw) return {type:'theme', el:sw, v:sw.dataset.v};
  const bk=hit.closest('#v-library [data-open]'); if(bk) return {type:'book', el:bk.closest('.doc')||bk, id:bk.dataset.open};
  return null;
}
function guideGravitySwap(T, over){
  const prev=T.over; if(prev){ prev.el.classList.remove('guide-drop'); if(prev.type==='style' || prev.type==='theme') guideLivePaint(T, null); }
  T.over=over; if(!over) return;
  GUIDE.gravity.push(over.type); if(GUIDE.gravity.length>40) GUIDE.gravity.shift();
  if(over.type!=='tab') over.el.classList.add('guide-drop');
  if(over.type==='style' || over.type==='theme') guideLivePaint(T, over);
  if(over.type==='tab' && over.el.getAttribute('aria-current')!=='page') over.el.click();   /* horizontal tab scrub */
}
/* live paint: a preview only (nothing saved); the app's own pick runs on release */
function guideLivePaint(T, over){
  const root=document.documentElement;
  if(!T.paint) T.paint={style:root.getAttribute('data-style'), theme:S.theme};
  if(root.getAttribute('data-style')!==T.paint.style) root.setAttribute('data-style', T.paint.style);
  if(S.theme!==T.paint.theme){ S.theme=T.paint.theme; applyLook(); }
  if(!over) return;
  if(over.type==='style') root.setAttribute('data-style', over.v);
  else if(over.type==='theme'){ S.theme=over.v; applyLook(); }
}
function guideSwallowClick(){
  const until=performance.now()+450;
  const h=e=>{ document.removeEventListener('click', h, true); if(performance.now()<until){ e.stopPropagation(); e.preventDefault(); } };
  document.addEventListener('click', h, true); setTimeout(()=>document.removeEventListener('click', h, true), 470);
}
function guideTetherRelease(cancel){
  const T=GUIDE.tether; if(!T) return;
  const P=guideParams(), over=cancel?null:T.over, at={x:T.bx!=null?T.bx:T.x, y:T.by!=null?T.by:T.y-P.lift};
  if(T.sc){ T.self=true; T.sc.value=String(T.v); T.sc.dispatchEvent(new Event('change', {bubbles:true})); T.self=false; GUIDE.scrubs++; T.scrubEnd=performance.now(); GUIDE.lastScrubEnd=T.scrubEnd; }
  let act=null;
  if(over) over.el.classList.remove('guide-drop');
  if(over && over.type==='style'){ T.paint=null; over.el.click(); act='style'; }
  else if(over && over.type==='theme'){ if(T.paint) S.theme=T.paint.theme; T.paint=null; over.el.click(); act='theme'; }
  else if(T.paint){ guideLivePaint(T, null); T.paint=null; }
  if(over && over.type==='search'){ act='search'; GUIDE.pours++; GUIDE.pourFrom=at; }
  if(over && over.type==='book'){ act='book'; GUIDE.pours++; }
  if(over && over.type==='tab') act='tab';
  guideTetherEnd(false, at, act, over);
}
function guideTetherEnd(instant, at, act, over){
  guideTetherCancel();
  const T=GUIDE.tether; if(!T) return;
  if(T.raf) cancelAnimationFrame(T.raf); GUIDE.tether=null; GUIDE.lastFrameT=0;
  document.removeEventListener('touchmove', guideTouchBlock, {capture:true});
  document.documentElement.classList.remove('guide-tether');
  if(GUIDE.tetherPath){ GUIDE.tetherPath.setAttribute('d',''); GUIDE.tetherPath.removeAttribute('filter'); }
  if(T.over) T.over.el.classList.remove('guide-drop');
  if(T.paint){ guideLivePaint(T, null); T.paint=null; }
  if(instant){ if(GUIDE.main) guideBodyQuiet(GUIDE.main, null); return; }
  guideSwallowClick();
  const P=guideParams(), b=GUIDE.main;
  if(act==='book' && over){ /* it pours into the cover, then the book opens and it comes up in the reader */
    if(b && P.fly){ const r=over.el.getBoundingClientRect(), c={x:r.left+r.width/2, y:r.top+Math.min(r.height/2, 60)};
      const pl=guidePlan(at, c, P, {kind:'pour', r:P.size/2, T:P.T*.55, rT:5, hover:true, settle:.04}); guidePlay(b, pl, P, {});
      GUIDE.lifted=true; GUIDE.flying=true; GUIDE.liftT0=performance.now(); GUIDE.holdT0=0; if(GUIDE.layer) GUIDE.layer.dataset.at='flight';
      clearTimeout(GUIDE.liftTimer); GUIDE.liftTimer=setTimeout(()=>{ if(GUIDE.lifted) guideScreen(); }, 1600); }
    const id=over.id; setTimeout(()=>{ try{ openDoc(id); }catch(e){} }, P.fly?120:0);
    return;
  }
  if(act==='search' && over){ if(b) guideBodyQuiet(b, null); if(GUIDE.rest) guideRest(GUIDE.rest.t, GUIDE.rest.b); over.el.focus(); return; }
  guideTetherHomeFly(at);
}
/* release: the blob springs home along its strand (one baked flight, then still) */
function guideTetherHomeFly(at){
  const P=guideParams(), b=GUIDE.main;
  const v=$('#v-reader'), r=(v && !v.hidden) ? (guideReaderTarget() && {t:guideReaderTarget(), b:guideBox(guideReaderTarget())}) : GUIDE.rest;
  if(!r || !r.b){ if(b) guideBodyQuiet(b, null); guideScreen({snap:true}); return; }
  if(!b || !P.fly){ if(b) guideBodyQuiet(b, null); guideRest(r.t, r.b); return; }
  const home=guideC(r.b), tok=++GUIDE.token, start=performance.now();
  guideBodyStop(b); b.c={x:at.x, y:at.y}; b.v={x:0,y:0}; b.op=1;
  const len=Math.hypot(home.x-at.x, home.y-at.y);
  guideColour(b, r.b); b.tgt={el:r.t.el, kind:r.t.kind};
  const pl=guidePlan(at, home, P, {kind:'home', r:P.size/2, T:P.T*.8, settle:P.settle*(1+P.tjig*.6), mould:guideOutline(r.b.w, r.b.h, guideRadPx(r.b)),
    rT:r.b.fill?P.size/2:Math.max(2, Math.min(P.size/2, Math.min(r.b.w,r.b.h)/2)), strand:{a:{x:home.x, y:home.y}, ra:Math.max(1.2,P.tw), snap:len+60}});
  if(r.b.fill) guideOff(r.t.el, true);
  GUIDE.flying=true; GUIDE.flyTo={el:r.t.el, b:r.b, p:null}; if(GUIDE.layer) GUIDE.layer.dataset.at='flight';
  const sim=guidePlay(b, pl, P, {onArrive:()=>{ if(tok===GUIDE.token && r.b.fill) guideInkOn(b, r.t.el); }, onFill:()=>{ if(tok===GUIDE.token && r.b.fill) guideOff(r.t.el, false); },
    onEnd:(body)=>guideHandOff(r.t, r.b, tok, body, {start, hold:0, launch:start, sim})});
}
/* test/diagnostic view of the guide */
function guideState(){
  const L=GUIDE.layer; if(!L) return {on:GUIDE.on, layers:document.querySelectorAll('#guide').length};
  const shapesVis=GUIDE.shapes.filter(o=>+getComputedStyle(o.firstChild).opacity>.05).length;
  const pathsVis=GUIDE.bodies.filter(b=>+getComputedStyle(b.wrap).opacity>.05).length;
  const r=GUIDE.rest, shape=GUIDE.shapes[GUIDE.cur], m=GUIDE.main;
  return {on:GUIDE.on, layers:document.querySelectorAll('#guide').length, at:L.dataset.at||'', split:+(L.dataset.split||1), flying:GUIDE.flying, lifted:GUIDE.lifted, held:GUIDE.held,
    visible:shapesVis+pathsVis, shapesVis, pathsVis, realFill:!!(r && r.b.fill && !r.t.el.classList.contains('guide-off')),
    target:r?{id:r.t.el.id||'', kind:r.t.kind, box:r.b}:null,
    shape:shape?{rect:shape.getBoundingClientRect().toJSON(), rad:getComputedStyle(shape.firstChild).borderRadius, op:+getComputedStyle(shape.firstChild).opacity}:null,
    path:m?{n:(m.path.getAttribute('d').match(/C/g)||[]).length, tag:m.path.tagName, inSvg:!!m.path.closest('svg')}:null,
    bodies:GUIDE.bodies.length, strands:GUIDE.bodies.filter(b=>(b.strand.getAttribute('d')||'').length>2).length, playing:GUIDE.bodies.filter(b=>b.anim).length, raf:!!GUIDE.raf, rafCount:GUIDE.rafCount, snaps:GUIDE.snaps,
    nudges:GUIDE.nudges, pulses:GUIDE.pulses, under:document.documentElement.classList.contains('guide-under'), pe:getComputedStyle(L).pointerEvents, aria:L.getAttribute('aria-hidden'),
    svgs:L.querySelectorAll('svg').length, pool:GUIDE.pool.length, poolFree:GUIDE.pool.filter(b=>b.free).length, kids:GUIDE.kids.size, goo:GUIDE.bodies.some(b=>b.goo), gooTrips:GUIDE.gooTrips, gooBlocked:guideGooBlocked(),
    tether:GUIDE.tether?{kind:GUIDE.tether.kind, over:GUIDE.tether.over?GUIDE.tether.over.type:'', sens:GUIDE.tether.sens}:null, focus:GUIDE.focusEl?GUIDE.focusEl.id:'', waits:GUIDE.waits.size,
    wave:{waves:GUIDE.wave.waves, sent:GUIDE.wave.sent, faded:GUIDE.wave.faded, maxWave:GUIDE.wave.maxWave}, transfers:GUIDE.transfers, settles:GUIDE.settles, traces:GUIDE.traces, unzips:GUIDE.unzips, pours:GUIDE.pours};
}
(function bindGuide(){
  const ready=()=>{
    guideMount();
    /* a tap on a book's Continue gathers the fill into the character; the tap itself is untouched (passive listeners) */
    document.addEventListener('click', e=>{
      const go=e.target && e.target.closest && e.target.closest('#v-library .hero-go');
      if(go && GUIDE.rest && !GUIDE.flying && !GUIDE.tether) guideLift(go);
    }, {capture:true, passive:true});
    document.addEventListener('pointerdown', e=>{
      guideIdleReset();
      const r=GUIDE.rest; if(r && e.target && (r.t.el===e.target || (r.t.el.contains && r.t.el.contains(e.target)))) guidePulse();
    }, {capture:true, passive:true});
    for(const ev of ['keydown','wheel','touchstart','scroll']) document.addEventListener(ev, guideIdleReset, {capture:true, passive:true});
    /* v40: hold-to-tether, option transfers, focus wraps, scroll waves (all passive; the tether's touchmove blocker is
       added only while a grab point is held, and only blocks once the hold has started) */
    document.addEventListener('pointerdown', e=>{ guideXferDown(e); guideTetherDown(e); }, {capture:true, passive:true});
    document.addEventListener('pointermove', guideTetherMove, {capture:true, passive:true});
    document.addEventListener('pointerup', guideTetherUp, {capture:true, passive:true});
    document.addEventListener('pointercancel', guideTetherUp, {capture:true, passive:true});
    document.addEventListener('contextmenu', e=>{ if(GUIDE.tether || GUIDE.pend) e.preventDefault(); }, true);
    document.addEventListener('click', e=>{ if(e.target && e.target.closest && e.target.closest(GUIDE_OPT)) guideXferClick(); }, {capture:true, passive:true});
    document.addEventListener('focusin', e=>{ const t=e.target; if(t && t.matches && t.matches(GUIDE_FINDS)) guideFocusOn(t); }, true);
    document.addEventListener('focusout', e=>{ const t=e.target; if(t && t===GUIDE.focusEl) guideFocusOff(false); }, true);
    document.addEventListener('scroll', e=>{ guideWaveScroll(e); if(GUIDE.focusEl) guideFocusSync(); }, {capture:true, passive:true});
    if(window.visualViewport) visualViewport.addEventListener('resize', ()=>{ if(GUIDE.focusEl) guideFocusSync(); });
    /* the scrubber held on the tether: the native drag never fights the fine scrub */
    document.addEventListener('input', e=>{ const T=GUIDE.tether; if(T && T.sc && e.target===T.sc && !T.self){ T.sc.value=String(T.v); } }, true);
    document.addEventListener('change', e=>{ const T=GUIDE.tether, sc=$('#rScrub'); if(!sc || e.target!==sc) return;
      if(T && T.sc && !T.self) e.stopImmediatePropagation(); else if(!T && e.isTrusted && GUIDE.lastScrubEnd && performance.now()-GUIDE.lastScrubEnd<250) e.stopImmediatePropagation(); }, true);
    /* a user's own tap on a control means it is already "seen" (no droplet re-fills it) */
    document.addEventListener('click', e=>{ const c=e.target && e.target.closest && e.target.closest('button,input,[role="radio"]'); if(c){ GUIDE.seen.add(c); const f=c.querySelector && c.querySelector('[data-accent-fill]'); if(f) GUIDE.seen.add(f); } }, {capture:true, passive:true});
    /* it steps aside (opacity 0) under anything that sits on top: a sheet, the selection bar, the image viewer, the
       "Back to where you were" chip and toasts. A class, set from their own open/close (no :has(), so iOS < 15.4 too). */
    /* v40: the "Back to where you were" chip is where it rests (Tethered Return), and a toast hides it only where they
       actually overlap */
    const toastOver=()=>{
      const t=document.getElementById('toast'); if(!t || t.hidden) return false; const a=guideStillRect(t); if(!a.width) return false;
      const rs=[]; if(GUIDE.rest) rs.push(GUIDE.rest.b); if(GUIDE.flying && GUIDE.flyTo && GUIDE.flyTo.b) rs.push(GUIDE.flyTo.b);
      for(const b of GUIDE.bodies) if(!b.free && b.op>.05) rs.push({x:b.c.x-16, y:b.c.y-16, w:32, h:32});
      return rs.some(r=>r.x<a.right+4 && r.x+r.w>a.left-4 && r.y<a.bottom+4 && r.y+r.h>a.top-4);
    };
    const under=()=>{
      const vis=id=>{ const e=document.getElementById(id); return !!(e && !e.hidden); };
      const on=vis('sheet') || vis('selBar') || !!document.getElementById('imgOverlay') || toastOver();
      document.documentElement.classList.toggle('guide-under', on);
    };
    GUIDE.under=under;
    for(const id of ['sheet','selBar','backPill','toast']){ const e=document.getElementById(id); if(e) new MutationObserver(under).observe(e, {attributes:true, attributeFilter:['hidden']}); }
    new MutationObserver(under).observe(document.body, {childList:true});
    under();
    /* resize and rotation re-snap it (rects are measured again once, after the layout settles) */
    let rt=0; const resnap=()=>{ cancelAnimationFrame(rt); rt=requestAnimationFrame(()=>requestAnimationFrame(()=>{ GUIDE.safe=null; if(GUIDE.focusEl) guideFocusSync(); if(GUIDE.tether) return; if(!GUIDE.flying && !GUIDE.lifted) guideScreen({snap:true}); else guideScreen(); })); };
    window.addEventListener('resize', resnap); window.addEventListener('orientationchange', resnap);
    /* the library re-rendering (a Style switch, the first render, an empty shelf) snaps it into place: the real fill
       shows at once, no flight. Only navigation flies. */
    let mt=0; const later=(o)=>{ cancelAnimationFrame(mt); mt=requestAnimationFrame(()=>{ if(typeof TOUR!=='undefined' && TOUR.on) return; guideScreen(o); }); };
    const list=$('#docList'); if(list) new MutationObserver(()=>{
      if(GUIDE.lifted || GUIDE.held) return; /* a book is opening: the reader takes over */
      /* a flight whose target was just re-rendered away (a re-render or an emptied shelf while it flies home) snaps too */
      const ft=GUIDE.flying && GUIDE.flyTo && GUIDE.flyTo.el;
      later(!GUIDE.flying || (ft && !ft.isConnected) ? {snap:true} : null);
    }).observe(list, {childList:true});
    /* a Style or page-colour change (data-style, data-theme, or the page colours on the root's style): colours refresh
       at once, resting or mid-flight, so nothing keeps a stale colour; a resting Guide re-snaps */
    new MutationObserver(ms=>{
      guideRecolour();
      if(!ms.some(m=>m.attributeName!=='style')) return;
      if(!GUIDE.flying && !GUIDE.lifted && !GUIDE.tether && !(typeof TOUR!=='undefined' && TOUR.on)) guideScreen({snap:true});
    }).observe(document.documentElement, {attributes:true, attributeFilter:['data-style','data-theme','style']});
    const v=$('#v-reader');
    if(v){
      let was={off:v.classList.contains('chrome-off'), pill:v.classList.contains('tts-pill-on')};
      new MutationObserver(()=>{
        const now={off:v.classList.contains('chrome-off'), pill:v.classList.contains('tts-pill-on')};
        if(v.hidden || !R.meta){ was=now; return; } /* kept current even while the reader closes (no stale bars state next open) */
        if(now.off===was.off && now.pill===was.pill) return;
        const barsOnly=now.pill===was.pill; was=now;
        /* the bars hiding: the mark on them goes with them at once (never left over the page) */
        if(barsOnly && now.off && GUIDE.rest && GUIDE.rest.t.el.closest && GUIDE.rest.t.el.closest('.rchrome') && !GUIDE.flying) guideHideShapes(null);
        later(barsOnly?{fade:true}:null); /* the bars hiding or coming back only cross-fades the mark: it never travels while you read */
      }).observe(v, {attributes:true, attributeFilter:['class']});
      /* only a real open or close counts: the reader re-sets hidden on every page turn, and the mark must not move while you read */
      const bar=$('#ttsBar'); let barWas=bar?bar.hidden:true;
      if(bar) new MutationObserver(()=>{
        if(bar.hidden===barWas) return; barWas=bar.hidden;
        if(!bar.hidden){ const p=$('#ttsPlay'); if(p && guideParams().fly) guideOff(p, true); } /* Play's own fill stays off from the pill's first frame until the blob lands */
        if(!v.hidden && R.meta) later(null);
      }).observe(bar, {attributes:true, attributeFilter:['hidden']});
      /* Tethered Return: when "Back to where you were" shows, it settles still on it (a calm fade); tapping Back springs it
         back to your reading strip, dismissing it (or the chip timing out) returns calmly */
      const bp=$('#backPill'); let bpWas=bp?bp.hidden:true;
      if(bp){
        new MutationObserver(()=>{
          if(bp.hidden===bpWas) return; bpWas=bp.hidden; if(v.hidden || !R.meta) return;
          const how=GUIDE.backHow; GUIDE.backHow='';
          later(bp.hidden && how==='go' ? null : {fade:true});
        }).observe(bp, {attributes:true, attributeFilter:['hidden']});
        const bg=$('#backGo'), bx=$('#backX');
        if(bg) bg.addEventListener('click', ()=>{ GUIDE.backHow='go'; }, {capture:true, passive:true});
        if(bx) bx.addEventListener('click', ()=>{ GUIDE.backHow='x'; }, {capture:true, passive:true});
      }
      /* your progress: on a page turn the faint mark is put at the new place instantly (no motion) */
      const foot=$('#runFoot');
      if(foot) new MutationObserver(()=>{
        const r=GUIDE.rest; if(!r || GUIDE.flying || GUIDE.lifted || v.hidden) return;
        if(r.t.kind!=='strip' && r.t.kind!=='thumb') return;
        const b=guideBox(r.t); if(b && !guideSame(b, r.b)) guideRest(r.t, b);
      }).observe(foot, {childList:true, characterData:true, subtree:true});
    }
    /* scrubbing moves the progress mark with the thumb (no flight) */
    const sc=$('#rScrub'); if(sc) sc.addEventListener('input', ()=>{ if(GUIDE.rest && GUIDE.rest.t.el===sc && !GUIDE.flying) guideTo([{el:sc, kind:'thumb'}], {snap:true}); }, {passive:true});
    requestAnimationFrame(()=>guideScreen({snap:true}));
    /* warm the simulator once while idle, so the first real flight doesn't pay for it */
    const warm=()=>{ try{ const P=guideParams(), b={c:{x:100,y:100}, v:{x:0,y:0}, r:P.size/2, p:guideCircle(P.size/2), pv:Array.from({length:GUIDE_N},()=>({x:0,y:0})), op:1, phase:0};
      guideSimulate(b, guidePlan({x:100,y:100}, {x:200,y:400}, P, {wake:true, from:guideOutline(80,40,12), mould:guideOutline(14,14,7), rT:7, strand:{a:{x:100,y:100}, ra:8, snap:10}}), P); }catch(e){} };
    if(window.requestIdleCallback) requestIdleCallback(warm, {timeout:2000}); else setTimeout(warm, 1200);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
