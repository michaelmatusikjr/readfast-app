/* ---------- the Guide (v39): one soft-body accent character that sits where you look or tap next ----------
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
const GUIDE_N=12, GUIDE_DT=1/240, GUIDE_FR=1000/60, GUIDE_MAX=3, GUIDE_NS='http://www.w3.org/2000/svg';
const GUIDE={on:true, layer:null, shapes:[], cur:0, ring:null, bodies:[], main:null, anims:[],
  rest:null, extras:[], token:0, flying:false, lifted:false, held:false, liftTimer:0, offEls:new Set(), tour:null,
  raf:0, rafCount:0, manual:false, flyTo:null, splitOn:false, snaps:0,
  idleMs:6000, idleTimer:0, screenSeq:0, nudged:-1, nudges:0, nudgeAnim:null, pulses:0, flights:[]};
function guideCss(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function guideNum(name, def){ const v=parseFloat(guideCss(name)); return isFinite(v)?v:def; }
function guideMs(name, def){ const s=guideCss(name); const v=parseFloat(s); if(!isFinite(v)) return def; return /ms$/.test(s)?v:(/s$/.test(s)?v*1000:v); }
/* the Style's temperament, read once per flight */
function guideParams(){
  return { A:guideMs('--guide-anticip',80)/1000, T:guideMs('--guide-travel',250)/1000, k:guideNum('--guide-stiffness',700),
    zeta:guideNum('--guide-damping',.5), wob:guideNum('--guide-wobble',.03), squash:guideNum('--guide-squash',.15),
    jig:guideNum('--guide-jiggles',1), settle:guideMs('--guide-settle',130)/1000, stretch:guideNum('--guide-stretch',.3),
    arc:guideNum('--guide-arc',.12), over:guideNum('--guide-overshoot',.5), fly:guideNum('--guide-fly',1)>0,
    size:guideNum('--guide-size',26), fade:guideMs('--guide-fade',160), thumb:guideNum('--guide-thumb',16) };
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
  const svg=guideSvg('svg', {class:'gdefs', width:'0', height:'0', 'aria-hidden':'true', focusable:'false'}, L);
  const f=guideSvg('filter', {id:'gGoo', x:'-60%', y:'-60%', width:'220%', height:'220%', 'color-interpolation-filters':'sRGB'}, guideSvg('defs', {}, svg));
  guideSvg('feGaussianBlur', {in:'SourceGraphic', stdDeviation:'2.4', result:'b'}, f);
  guideSvg('feColorMatrix', {in:'b', mode:'matrix', values:'1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8', result:'g'}, f);
  guideSvg('feComposite', {in:'SourceGraphic', in2:'g', operator:'atop'}, f);
  GUIDE.layer=L; GUIDE.cur=0; GUIDE.bodies=[]; GUIDE.main=null; GUIDE.extras=[];
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
    return {x:r.left, y:r.top, w:r.width, h:r.height, rad:[cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius].join(' '), bg:cs.backgroundColor, fill:true};
  }
  if(t.kind==='thumb'){ /* the native thumb's width is the platform's: --guide-thumb (16px Chromium, 28px iOS WebKit) */
    const th=guideParams().thumb;
    const mn=+el.min||0, mx=+el.max||1, v=+el.value||0, f=mx>mn?Math.min(1,Math.max(0,(v-mn)/(mx-mn))):0;
    const d=14, cx=r.left+th/2+f*(r.width-th), cy=r.top+r.height/2;
    return {x:cx-d/2, y:cy-d/2, w:d, h:d, rad:'50%', bg:'', fill:false};
  }
  if(t.kind==='strip'){
    /* your progress along the bottom strip, never on the footer text: below it when there is room (the home-indicator
       inset), otherwise along the strip with the text's span skipped */
    const sc=$('#rScrub'); const mn=sc?(+sc.min||0):0, mx=sc?(+sc.max||1):1, v=sc?(+sc.value||0):0, f=mx>mn?Math.min(1,Math.max(0,(v-mn)/(mx-mn))):0;
    const w=14, h=3, pad=20, x0=r.left+pad, x1=r.right-pad, tr=guideTextRect(el);
    if(!tr || tr.bottom+2+h<=innerHeight-1){ const y=tr?tr.bottom+2:r.bottom-h-1; const cx=x0+f*Math.max(0,x1-x0); return {x:cx-w/2, y, w, h, rad:'2px', bg:'', fill:false}; }
    const g=6, aL=x0+w/2, aR=Math.max(aL, tr.left-g-w/2), bL=Math.min(x1-w/2, tr.right+g+w/2), bR=x1-w/2;
    const la=Math.max(0,aR-aL), lb=Math.max(0,bR-bL), d=f*(la+lb);
    const cx=d<=la?aL+d:bL+(d-la);
    return {x:cx-w/2, y:r.bottom-h-1, w, h, rad:'2px', bg:'', fill:false};
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
function guideClearOff(keep){ for(const el of [...GUIDE.offEls]) if(el!==keep) guideOff(el,false); }
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
function guideBodyNew(cls, r){
  const wrap=document.createElement('div'); wrap.className='gbod '+(cls||'');
  const svg=guideSvg('svg', {class:'gsvg', width:'1', height:'1', 'aria-hidden':'true', focusable:'false'}, wrap);
  const g=guideSvg('g', {}, svg);
  const strand=guideSvg('path', {class:'gstrand', d:''}, g);
  const path=guideSvg('path', {class:'gblob', d:''}, g);
  GUIDE.layer.appendChild(wrap);
  const b={wrap, svg, g, path, strand, c:{x:0,y:0}, v:{x:0,y:0}, r, p:[], pv:[], op:0, phase:(GUIDE.bodies.length*2.17)%6.28,
    anim:null, frames:null, plan:null, ev:null, goo:false, lastIdx:-1};
  for(let i=0;i<GUIDE_N;i++){ b.p.push({x:0,y:0}); b.pv.push({x:0,y:0}); }
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
  if(!b) return; guideBodyStop(b); b.wrap.remove(); GUIDE.bodies=GUIDE.bodies.filter(x=>x!==b); if(GUIDE.main===b) GUIDE.main=null;
}
function guideMainBody(){
  guideMount();
  if(!GUIDE.main || !GUIDE.main.wrap.isConnected){ GUIDE.main=guideBodyNew('gmain', guideParams().size/2); }
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
  const frames=[]; let t=0, next=0;
  const snap=()=>{
    const pts=new Float32Array(2*GUIDE_N), pvs=new Float32Array(2*GUIDE_N);
    for(let k=0;k<GUIDE_N;k++){ pts[2*k]=s.p[k].x; pts[2*k+1]=s.p[k].y; pvs[2*k]=s.pv[k].x; pvs[2*k+1]=s.pv[k].y; }
    const st=pl.strand; let sd=null;
    if(st && !st.dead){ const ar=st.snapped?st.ra*Math.max(0,1-(t-st.tSnap)/.09):st.ra; sd={ax:st.a.x, ay:st.a.y, ar, conn:!st.snapped, snap:st.snap}; }
    frames.push({t:t*1000, cx:s.c.x, cy:s.c.y, vx:s.v.x, vy:s.v.y, op:s.op, r:s.r, pts, pvs, strand:sd});
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
  const goo=!!sd; if(goo!==b.goo){ b.goo=goo; if(goo) b.g.setAttribute('filter','url(#gGoo)'); else b.g.removeAttribute('filter'); }
}
/* the loop: only while a flight plays; it reads the animation's own clock, so a busy main thread only delays the outline */
function guideKick(){ if(GUIDE.manual || GUIDE.raf) return; if(GUIDE.bodies.some(b=>b.anim)) GUIDE.raf=requestAnimationFrame(guideFrame); }
function guideFrame(){
  GUIDE.raf=0; GUIDE.rafCount++;
  for(const b of [...GUIDE.bodies]){ if(!b.anim || !b.frames) continue; const ms=+b.anim.currentTime||0; guideBodyDraw(b, Math.min(b.frames.length-1, Math.floor(ms/GUIDE_FR))); guideBodyFire(b, ms); }
  if(!GUIDE.manual && GUIDE.bodies.some(b=>b.anim)) GUIDE.raf=requestAnimationFrame(guideFrame);
}
function guideSleep(){ if(GUIDE.raf){ cancelAnimationFrame(GUIDE.raf); GUIDE.raf=0; } }
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
  GUIDE.rest={t, b}; GUIDE.flying=false; GUIDE.lifted=false; GUIDE.held=false;
  if(GUIDE.layer) GUIDE.layer.dataset.at=b.fill?'fill':(t.kind||'mark');
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
function guideColour(b, box){ b.path.style.fill=box && box.fill && box.bg ? box.bg : ''; b.strand.style.fill=b.path.style.fill; }
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
  if(rb.fill) guideOff(GUIDE.rest.t.el, true);
  const down={x:innerWidth/2-src.x, y:innerHeight-src.y}, dl=Math.hypot(down.x,down.y)||1;
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
      if(prev.b.fill) guideOff(prev.t.el, true);
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
  guideColour(b, bx);
  const pl=guidePlan(src, to, P, o);
  return new Promise(res=>{
    const sim=guidePlay(b, pl, P, {resolve:res,
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
    guideStopAnims(); guideShapeAt(s, bx, bx.fill?0:1); guideBodyQuiet(body, bx);
    guideSetRest(t, bx);
  }).catch(()=>{});
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
  const jobs=GUIDE.extras.map((x,k)=>new Promise(res=>{
    const d=guideBodyNew('gdrop', R); x.body=d; const dst=guideDropAt(x.b);
    if(!P.fly){ d.c=dst; guideBodySet(d, guideCircle(R)); d.op=0; guideBodyPlace(d); guideAnim(d.wrap, [{opacity:0},{opacity:1}], {duration:P.fade, easing:'ease-out'}).finished.then(()=>{ d.op=1; d.wrap.style.opacity='1'; res(true); }).catch(()=>res(false)); return; }
    d.c={x:c.x, y:c.y}; guideBodySet(d, guideCircle(1.5)); d.r=1.5; d.op=1;
    const pl=guidePlan(c, dst, P, {wake:true, delay:k*.04, peel:6, r0wake:1.5, rT:R, T:P.T*.75, mould:guideCircle(R), hover:true, kind:'split', r:R,
      strand:{a:{x:c.x,y:c.y}, ra:2.4, snap:13}});
    guidePlay(d, pl, P, {onEnd:()=>{ GUIDE.snaps++; res(true); }});
  }));
  return Promise.all(jobs).then(()=>{ if(tok!==GUIDE.token) return; });
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
      GUIDE.extras=extras.slice(0,GUIDE_MAX-1).map(x=>{ const d=guideBodyNew('gdrop',GUIDE_DROP); d.c=guideDropAt(x.b); guideBodySet(d, guideCircle(GUIDE_DROP)); d.op=1; guideBodyPlace(d); return {t:x.t, b:x.b, body:d}; });
      GUIDE.splitOn=true; GUIDE.layer.dataset.split=String(GUIDE.extras.length+1);
    }
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
    const add=$('#addBtn'); return add?[{el:add, kind:add.classList.contains('primary')?'fill':'mark'}]:null; /* no Continue card: Add to library is the primary fill */
  }
  const tab=document.querySelector('#tabs button[aria-current="page"]');
  return tab?[{el:tab, kind:'mark'}]:null; /* under the tab's label */
}
function guideScreen(opts){
  const t=guideScreenTargets(); if(!t || !t.length) return Promise.resolve(false);
  return guideTo(t, Object.assign({main:0}, opts||{}));
}
/* the tour: each step names its targets; the first is the main spot */
function guideTour(targets){ GUIDE.tour=(targets||[]).filter(Boolean); if(GUIDE.tour.length) return guideTo(GUIDE.tour, {main:0}); return Promise.resolve(false); }
/* the guide on or off (tests compare layout with it on and off; it never changes layout either way) */
function guideSet(on){
  GUIDE.on=!!on; GUIDE.token++; guideStopAnims(); guideMergeNow(); guideClearOff(null); clearTimeout(GUIDE.liftTimer); GUIDE.lifted=false; GUIDE.held=false; GUIDE.flying=false;
  guideSleep(); for(const b of [...GUIDE.bodies]) guideBodyKill(b);
  if(!on){ if(GUIDE.layer) GUIDE.layer.remove(); GUIDE.layer=null; GUIDE.rest=null; GUIDE.main=null; GUIDE.bodies=[]; return; }
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
    nudges:GUIDE.nudges, pulses:GUIDE.pulses, under:document.documentElement.classList.contains('guide-under'), pe:getComputedStyle(L).pointerEvents, aria:L.getAttribute('aria-hidden')};
}
(function bindGuide(){
  const ready=()=>{
    guideMount();
    /* a tap on a book's Continue gathers the fill into the character; the tap itself is untouched (passive listeners) */
    document.addEventListener('click', e=>{
      const go=e.target && e.target.closest && e.target.closest('#v-library .hero-go');
      if(go && GUIDE.rest && GUIDE.rest.t.el===go && !GUIDE.flying) guideLift(go);
    }, {capture:true, passive:true});
    document.addEventListener('pointerdown', e=>{
      guideIdleReset();
      const r=GUIDE.rest; if(r && e.target && (r.t.el===e.target || (r.t.el.contains && r.t.el.contains(e.target)))) guidePulse();
    }, {capture:true, passive:true});
    for(const ev of ['keydown','wheel','touchstart','scroll']) document.addEventListener(ev, guideIdleReset, {capture:true, passive:true});
    /* it steps aside (opacity 0) under anything that sits on top: a sheet, the selection bar, the image viewer, the
       "Back to where you were" chip and toasts. A class, set from their own open/close (no :has(), so iOS < 15.4 too). */
    const under=()=>{
      const vis=id=>{ const e=document.getElementById(id); return !!(e && !e.hidden); };
      const on=vis('sheet') || vis('selBar') || !!document.getElementById('imgOverlay') || vis('backPill') || vis('toast');
      document.documentElement.classList.toggle('guide-under', on);
    };
    for(const id of ['sheet','selBar','backPill','toast']){ const e=document.getElementById(id); if(e) new MutationObserver(under).observe(e, {attributes:true, attributeFilter:['hidden']}); }
    new MutationObserver(under).observe(document.body, {childList:true});
    under();
    /* resize and rotation re-snap it (rects are measured again once, after the layout settles) */
    let rt=0; const resnap=()=>{ cancelAnimationFrame(rt); rt=requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(!GUIDE.flying && !GUIDE.lifted) guideScreen({snap:true}); else guideScreen(); })); };
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
    new MutationObserver(()=>{ if(!GUIDE.flying && !GUIDE.lifted && !(typeof TOUR!=='undefined' && TOUR.on)) guideScreen({snap:true}); }).observe(document.documentElement, {attributes:true, attributeFilter:['data-style']});
    const v=$('#v-reader');
    if(v){
      let was={off:v.classList.contains('chrome-off'), pill:v.classList.contains('tts-pill-on')};
      new MutationObserver(()=>{
        if(v.hidden || !R.meta) return;
        const now={off:v.classList.contains('chrome-off'), pill:v.classList.contains('tts-pill-on')};
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
