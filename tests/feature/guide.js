/* The Guide (v39, soft-body character): rest spots, the SVG body asleep at rest (no rAF), flights under 550ms with no
   dwell over the text, the idle nudge, the tap pulse, the tour split/merge, the strip vs the footer text, overlays,
   the tab mark, one accent on Add, Play and label ink, contrast, 1x/4x frames, Reduce Motion fades, resize, in all
   three Styles. node tests/feature/guide.js */
const __E=require('../env');
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __E.SCRATCH+'guide';
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.PLAYWRIGHT_CHROME || '';
const URL = process.env.TOOZ_URL || __E.URL;
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function fail(msg, extra){ failed++; console.error('FAIL:', msg, extra!==undefined?JSON.stringify(extra):''); }
function pass(msg, extra){ console.log('PASS:', msg, extra!==undefined?JSON.stringify(extra):''); }
function ok(n, c, x){ (c?pass:fail)(n, x); }

const voiceMock = ()=>{
  window.__toozKeepSample = true;
  const voices = [{voiceURI:'mock-samantha', name:'Samantha', lang:'en-US', localService:true, default:true}];
  const fake = {
    speaking:false, pending:false, paused:false,
    getVoices(){ return voices; },
    addEventListener(){}, removeEventListener(){},
    cancel(){ this.speaking=false; this._seq=(this._seq||0)+1; if(this._timer){ clearTimeout(this._timer); this._timer=0; } },
    pause(){ this.paused=true; }, resume(){ this.paused=false; },
    speak(u){
      this.speaking=true; this.paused=false; const seq=this._seq||0;
      if(this._timer){ clearTimeout(this._timer); this._timer=0; }
      const text=u.text||'';
      const parts=text.split(/(\s+)/);
      let ci=0, steps=[];
      for(const part of parts){ if(/\S/.test(part)) steps.push(ci); ci+=part.length; }
      let k=0;
      const tick=()=>{
        if(seq!==this._seq) return;
        if(this.paused){ this._timer=setTimeout(tick, 20); return; }
        if(k<steps.length){
          try{ u.onboundary && u.onboundary({name:'word', charIndex:steps[k]}); }catch(e){}
          k++; this._timer=setTimeout(tick, 12);
        } else { this.speaking=false; try{ u.onend && u.onend(); }catch(e){} }
      };
      this._timer=setTimeout(tick, 8);
    }
  };
  try{ Object.defineProperty(window, 'speechSynthesis', {configurable:true, get(){ return fake; }}); }catch(e){ window.speechSynthesis = fake; }
  window.SpeechSynthesisUtterance = function(text){ this.text=text; this.rate=1; this.voice=null; this.lang=''; this.onboundary=null; this.onend=null; this.onerror=null; };
};

async function seedBook(pg){
  await pg.evaluate(async()=>{
    try{ if(R&&R.meta) closeReader(true);}catch(e){}
    try{ closeSheet(); }catch(e){}
    const words=[], ends=[];
    for(let i=0;i<120;i++) words.push(i===119 ? 'ending.' : ('alpha'+(i+1)));
    ends.push(119);
    window.__longSent={a:0,b:119};
    const sentence = 'The quick brown fox jumps over a lazy dog today.'.split(' ');
    for(let i=0, n=2400; i<n; i++){
      const w = sentence[i%sentence.length];
      words.push(i%9===8 ? w.replace(/[.,]?$/,'')+'.' : w);
      if(i%9===8) ends.push(120+i);
    }
    ends.push(2519);
    const a=await addDoc({title:'Pill Test Book', author:'Jane Austen', kind:'paste', words, ends, chapters:[{t:'One',i:0},{t:'Two',i:1200},{t:'Three',i:2000}]});
    a.pos=40; a.lastRead=Date.now(); a.finished=false; a.tags=['Classics']; touch(a);
    window.__pillTestId=a.id;
    const b=await addDoc({title:'Pill Test Companion', author:'Herman Melville', kind:'paste', words, ends, chapters:[]});
    b.pos=0; b.lastRead=Date.now()-5000; b.finished=false; touch(b);
    S.theme='white'; S.mode='pages'; S.focus=true; S.ttsEngine='natural'; saveSettings(); applyLook();
    renderLibrary();
  });
  await wait(300);
}

async function openBook(pg, mode){
  await pg.evaluate(async(mode)=>{
    LS.set('hintBar', 1);
    const d=LIB.find(x=>x.id===window.__pillTestId) || LIB.find(x=>x.title==='Pill Test Book');
    S.mode=mode; S.focus=true; saveSettings();
    if(R&&R.meta) closeReader(true);
    await openDoc(d.id);
    if(R.mode!==mode) await switchMode(mode);
    setChrome(true);
  }, mode);
  await pg.waitForFunction((mode)=>R && R.mode===mode && !$('#v-reader').hidden, mode, {timeout:15000});
  await wait(500);
}

function placeInfo(){
  if(R.mode==='pages'){
    const vis=[...pgView.querySelectorAll('w')].filter(w=>{
      const r=w.getBoundingClientRect(), c=$('#pgClip').getBoundingClientRect();
      return r.width>1 && r.bottom>c.top+1 && r.top<c.bottom-1 && r.right>c.left+1 && r.left<c.right-1;
    });
    const first=vis[0] ? idxOf(vis[0]) : P.topWord;
    const bp=typeof bookPages==='function'?bookPages():{page:P.page,total:P.pages};
    return {mode:R.mode, pos:R.pos, page:bp.page, secPage:P.page, first, topWord:P.topWord, pages:bp.total, n:R.n, sec:P.k, anchor:R.anchor};
  }
  if(R.mode==='scroll'){
    const v=scView.getBoundingClientRect();
    const vis=[...scFlow.querySelectorAll('w')].filter(w=>{
      const r=w.getBoundingClientRect();
      return r.width>1 && r.bottom>v.top+1 && r.top<v.bottom-1;
    });
    return {mode:R.mode, pos:R.pos, page:null, first:vis[0]?idxOf(vis[0]):scPos(), topWord:scPos(), pages:null, anchor:R.anchor, scrollTop:scView.scrollTop};
  }
  return {mode:R.mode, pos:R.pos};
}

function pillGeom(){
  const b=$('#ttsBar'), play=$('#ttsPlay'), speed=$('#ttsSpeed'), close=$('#ttsClose'), hint=$('#ttsHint'), chip=$('#ttsNatChip');
  const br=b.getBoundingClientRect(), pr=play.getBoundingClientRect(), sr=speed.getBoundingClientRect(), crx=close&&close.getBoundingClientRect();
  const clip=R.mode==='pages'?$('#pgClip'):scView;
  const cr=clip&&clip.getBoundingClientRect();
  const host=R.mode==='pages'?pgView:scFlow;
  const words=[...(host.querySelectorAll('w'))].filter(w=>{
    const r=w.getBoundingClientRect();
    if(!(r.width>1 && r.height>1 && r.bottom>0 && r.top<innerHeight)) return false;
    if(cr && (r.bottom<=cr.top+1 || r.top>=cr.bottom-1)) return false;
    return true;
  });
  const overlap=words.filter(w=>{
    const r=w.getBoundingClientRect();
    return r.bottom>br.top+1 && r.top<br.bottom-1 && r.right>br.left+1 && r.left<br.right-1;
  }).length;
  const under=words.filter(w=>{
    const r=w.getBoundingClientRect();
    return r.bottom>br.top+1 && r.top<br.top;
  }).length;
  return {
    hidden:b.hidden, pos:getComputedStyle(b).position,
    w:+br.width.toFixed(1), h:+br.height.toFixed(1),
    pillTop:+br.top.toFixed(1), pillBottom:+br.bottom.toFixed(1), pillLeft:+br.left.toFixed(1), pillRight:+br.right.toFixed(1),
    playW:+pr.width.toFixed(1), playH:+pr.height.toFixed(1),
    speedW:+sr.width.toFixed(1), speedH:+sr.height.toFixed(1),
    closeW:crx?+crx.width.toFixed(1):0, closeH:crx?+crx.height.toFixed(1):0,
    hasRange: !!b.querySelector('input[type=range]'),
    label:(speed.textContent||'').trim(),
    ariaPlay:play.getAttribute('aria-label'),
    ariaSpeed:speed.getAttribute('aria-label'),
    hint:!hint.hidden && hint.classList.contains('show'),
    chip:!chip.hidden && /Better voice/.test(chip.textContent||''),
    toastNat: !$('#toast').hidden && /more natural voice/i.test($('#toastMsg').textContent||''),
    clipBottom:cr&&+cr.bottom.toFixed(1), clipTop:cr&&+cr.top.toFixed(1),
    overlap, under, gap:+((br.top-(cr?cr.bottom:0))).toFixed(1),
    reserve:($('#v-reader').style.getPropertyValue('--tts-reserve')||''),
    pad: typeof ttsLinePad==='function'?ttsLinePad():null,
    inFoot:$('#rFoot').contains(b)
  };
}

function backPillGeom(){
  const b=$('#backPill'), p=$('#ttsBar');
  const br=b.getBoundingClientRect(), pr=p.getBoundingClientRect();
  const overlap= !b.hidden && !p.hidden && br.bottom>pr.top+1 && br.top<pr.bottom-1 && br.right>pr.left+1 && br.left<pr.right-1;
  return {hidden:b.hidden, z:+getComputedStyle(b).zIndex, y0:+br.top.toFixed(1), y1:+br.bottom.toFixed(1),
    pillY0:+pr.top.toFixed(1), pillY1:+pr.bottom.toFixed(1), overlap, above: br.bottom<=pr.top+1};
}

const STY=['quiet','paper','lively'];
function __rgba_node(s){ const m=String(s).match(/rgba?\(([^)]+)\)/); const p=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return {r:p[0],g:p[1],b:p[2]}; }
const SUG={quiet:'paper', paper:'sepia', lively:'white'};
const DAY={quiet:'white', paper:'sepia', lively:'white'}; /* QA v37c: theme auto's day page per Style */

async function info(pg){
  const p=await pg.evaluate(placeInfo);
  const x=await pg.evaluate(()=>({
    res:$('#v-reader').style.getPropertyValue('--tts-reserve')||'',
    clipH:Math.round(((R.mode==='pages')?$('#pgClip'):scView).getBoundingClientRect().height),
    rTop:Math.round($('#rTop').getBoundingClientRect().height), rFoot:Math.round($('#rFoot').getBoundingClientRect().height),
    style:document.documentElement.dataset.style, pill:!$('#ttsBar').hidden }));
  return Object.assign(p,x);
}
const same=(a,b,keys)=>keys.every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));

const SHOTS=OUT;

/* page-side helpers */
const PAGE_HELPERS=()=>{
  window.__gWords=()=>{
    const host=R.mode==='pages'?pgView:scFlow, clip=(R.mode==='pages'?$('#pgClip'):scView).getBoundingClientRect();
    /* what you can see of each word: clipped to the text box, and minus anything covered by the opaque reader bars */
    const v=$('#v-reader'), bars=v.classList.contains('chrome-off')?[]:['#rTop','#rFoot'].map(s=>$(s).getBoundingClientRect());
    const out=[];
    for(const w of host.querySelectorAll('w')){ const r0=w.getBoundingClientRect(); if(r0.width<=1||r0.height<=1) continue;
      let r={left:Math.max(r0.left,clip.left), right:Math.min(r0.right,clip.right), top:Math.max(r0.top,clip.top,0), bottom:Math.min(r0.bottom,clip.bottom,innerHeight)};
      if(r.right-r.left<=1 || r.bottom-r.top<=1) continue;
      for(const b of bars){ if(r.left>=b.left-1 && r.right<=b.right+1){ if(b.top<=r.top+.5 && b.bottom>r.top) r.top=b.bottom; if(b.bottom>=r.bottom-.5 && b.top<r.bottom) r.bottom=b.top; } }
      if(r.bottom-r.top>1) out.push(r); }
    return out;
  };
  window.__gHits=()=>{ /* visible guide pieces that overlap a visible word */
    const L=$('#guide'); if(!L) return {pieces:0, hits:0};
    const ps=[...L.querySelectorAll('.gpos')].filter(o=>+getComputedStyle(o.firstChild).opacity>.05).map(o=>o.getBoundingClientRect());
    const ws=__gWords(); let hits=0;
    for(const p of ps) for(const r of ws) if(r.right>p.left+.5 && r.left<p.right-.5 && r.bottom>p.top+.5 && r.top<p.bottom-.5) hits++;
    return {pieces:ps.length, hits, words:ws.length};
  };
  window.__gAnimProps=()=>{ /* every property animated by a guide animation */
    const L=$('#guide'); const set=new Set();
    for(const a of document.getAnimations()){ const t=a.effect&&a.effect.target; if(!t || !L || !L.contains(t)) continue;
      for(const k of a.effect.getKeyframes()) for(const p of Object.keys(k)) if(!['offset','computedOffset','easing','composite'].includes(p)) set.add(p); }
    return [...set];
  };
  window.__gSample=(ms)=>new Promise(res=>{ /* sample the flight: frame times, properties, blob count, transforms */
    const out={dup:0, flyFrames:0, dt:[], props:new Set(), maxVis:0, maxSplit:1, merging:false, transforms:[], fills:[], frames:0};
    let last=performance.now(); const t0=last; out.raf0=GUIDE.rafCount;
    const tick=(now)=>{
      out.dt.push(now-last); last=now; out.frames++;
      for(const p of __gAnimProps()) out.props.add(p);
      const s=guideState(); out.maxVis=Math.max(out.maxVis, s.visible + (s.realFill?1:0)); out.maxSplit=Math.max(out.maxSplit, s.split||1);
      if($('#guide') && $('#guide').dataset.merging) out.merging=true;
      const fl=document.querySelectorAll('.guide-off').length; out.fills.push(fl);
      /* in flight: the fill it is heading for must be hidden, and no split blobs are out */
      for(const bb of GUIDE.bodies) guideBodyNow(bb);
      if(GUIDE.flying){ out.flyFrames=(out.flyFrames||0)+1; const ft=GUIDE.flyTo; const mf=GUIDE.main && GUIDE.main.ev && GUIDE.main.ev.fired && GUIDE.main.ev.fired.fill; if(ft && ft.b.fill && !ft.el.classList.contains('guide-off') && GUIDE.layer.dataset.at==='flight' && GUIDE.main && GUIDE.main.anim && !mf) out.dup=(out.dup||0)+1; /* the real fill may only come back once the blob has filled its mould */ if(!(GUIDE.layer.dataset.merging) && GUIDE.extras.some(x=>x.body && x.body.op>.05)) out.dup=(out.dup||0)+1; }
      out.transforms.push(GUIDE.main && GUIDE.main.op>.05 ? Math.round(GUIDE.main.c.x)+','+Math.round(GUIDE.main.c.y) : 'none'); out.ticks=GUIDE.rafCount;
      if(now-t0<ms) requestAnimationFrame(tick); else { out.props=[...out.props]; res(out); }
    };
    requestAnimationFrame(tick);
  });
  window.__gArea=()=>{ /* the reading text area: the text box minus the opaque bars; null when the reader isn't up */
    const v=$('#v-reader'); if(!v || v.hidden || !R.meta) return null;
    const clip=(R.mode==='pages'?$('#pgClip'):scView); if(!clip) return null; const c=clip.getBoundingClientRect();
    let top=c.top, bottom=Math.min(c.bottom, innerHeight);
    if(!v.classList.contains('chrome-off')){ top=Math.max(top, $('#rTop').getBoundingClientRect().bottom); bottom=Math.min(bottom, $('#rFoot').getBoundingClientRect().top); }
    return {left:c.left, right:c.right, top, bottom};
  };
  window.__gDwell=(ms)=>new Promise(res=>{ /* every frame: is the visible character over the reading text, and how fast is it going */
    const out={frames:0, over:0, maxRun:0, run:0, slowOver:0, minOverSpeed:null, visHold:0, attrs:new Set(), pathStyle:new Set(), firstVis:null, arrive:null, log:[]};
    const mo=new MutationObserver(ms=>{ for(const m of ms){ out.attrs.add(m.attributeName); if(m.attributeName==='style' && m.target.tagName==='path'){ for(let i=0;i<m.target.style.length;i++) out.pathStyle.add(m.target.style[i]); } } });
    mo.observe($('#guide'), {attributes:true, subtree:true});
    const t0=performance.now(); let prev=null;
    const tick=(now)=>{
      out.frames++;
      const b=GUIDE.main; if(b) guideBodyNow(b); const area=__gArea(), vis=!!(b && b.op>.05);
      if(GUIDE.held && b && b.op>.05) out.visHold++;
      if(vis){
        const bb=guideBodyBox(b), sp=Math.hypot(b.v.x,b.v.y);
        const over=!!(area && bb.right>area.left && bb.left<area.right && bb.bottom>area.top && bb.top<area.bottom);
        if(over){ out.over++; out.run++; out.maxRun=Math.max(out.maxRun,out.run); out.minOverSpeed=out.minOverSpeed==null?sp:Math.min(out.minOverSpeed,sp); if(sp<60) out.slowOver++; } else out.run=0;
        out.log.push([Math.round(now-t0), Math.round(b.c.x), Math.round(b.c.y), Math.round(sp), over?1:0]);
      } else out.run=0;
      if(now-t0<ms) requestAnimationFrame(tick); else { mo.disconnect(); out.attrs=[...out.attrs]; out.pathStyle=[...out.pathStyle]; res(out); }
    };
    requestAnimationFrame(tick);
  });
  window.__gMark=()=>{ /* the reading mark: colour, opacity and the page behind it */
    const s=GUIDE.shapes[GUIDE.cur]; const i=s.firstChild;
    return {col:getComputedStyle(i).backgroundColor, op:+getComputedStyle(s).opacity * +getComputedStyle(i).opacity, bg:getComputedStyle($('#v-reader')).backgroundColor, at:$('#guide').dataset.at};
  };
  window.__gRest=()=>{ /* the resting blob vs its target */
    const s=guideState(); const r=GUIDE.rest; if(!r) return {s};
    const tb=guideBox(r.t); const el=r.t.el; const er=stillRect(el);
    return {s, tb, er:{x:er.left,y:er.top,w:er.width,h:er.height}, erad:getComputedStyle(el).borderRadius, kind:r.t.kind, id:el.id, cls:typeof el.className==='string'?el.className:''};
  };
};
const near=(a,b,t=1)=>Math.abs(a-b)<=t;
function rectMatch(sr, b){ return sr && b && near(sr.x,b.x) && near(sr.y,b.y) && near(sr.width,b.w) && near(sr.height,b.h); }
async function settle(pg, ms=900){ await wait(ms); await pg.waitForFunction(()=>!GUIDE.flying && !GUIDE.lifted, null, {timeout:5000}).catch(()=>{}); await wait(60); }
async function restCheck(pg, label, expect){
  const r=await pg.evaluate(()=>__gRest());
  const s=r.s;
  ok(`${label}: one guide layer, pointer-events none, aria-hidden`, s.layers===1 && s.pe==='none' && s.aria==='true', {layers:s.layers, pe:s.pe, aria:s.aria});
  const one=(s.visible + (s.realFill?1:0))===1;
  ok(`${label}: exactly one accent blob on screen`, one, {visible:s.visible, realFill:s.realFill, at:s.at});
  ok(`${label}: rests on ${expect}`, expect==='continue'?/hero-go/.test(r.cls):expect==='play'?r.id==='ttsPlay':expect==='thumb'?(r.id==='rScrub'&&r.kind==='thumb'):expect==='strip'?(r.id==='runFoot'&&r.kind==='strip'):true, {id:r.id, cls:r.cls, kind:r.kind});
  ok(`${label}: blob matches the target box (±1px)`, rectMatch(s.shape.rect, r.tb), {shape:s.shape.rect, box:r.tb});
  ok(`${label}: the character is one SVG soft-body path of 8-12 points, asleep (no rAF)`, s.path && s.path.inSvg && s.path.n>=8 && s.path.n<=12 && s.bodies>=1 && !s.raf && s.strands===0, {path:s.path, bodies:s.bodies, raf:s.raf, strands:s.strands});
  if(r.tb && r.tb.fill){
    ok(`${label}: matches the button's rect and radius and hands off to its real fill`, rectMatch(s.shape.rect, r.er) && s.shape.rad===getRad(r.erad) && s.realFill && s.shape.op<.05, {shape:s.shape, er:r.er, erad:r.erad});
  }
  return r;
}
const getRad=x=>x.split(' ')[0];

(async()=>{
  const b = await chromium.launch({ executablePath: fs.existsSync(CHROME)?CHROME:undefined, args:['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport:{width:390, height:844}, deviceScaleFactor:2, serviceWorkers:'block', hasTouch:true, isMobile:true,
    recordVideo:{dir:SHOTS+'/video', size:{width:390, height:844}} });
  await ctx.addInitScript(voiceMock);
  const errs=[];
  const pg = await ctx.newPage();
  pg.on('pageerror', e=>errs.push('page '+e.message));
  pg.on('console', m=>{ if(m.type()==='error' && !/ERR_TUNNEL|ERR_FAILED|ERR_CONNECTION|Failed to load resource/.test(m.text())) errs.push('console '+m.text()); });
  await pg.goto(URL, {waitUntil:'domcontentloaded'});
  await pg.waitForFunction(()=> typeof renderLibrary==='function' && typeof guideTo==='function', {timeout:20000});
  await wait(500);
  await pg.evaluate(()=>{ try{ tourEnd(); }catch(e){} try{ closeSheet(); }catch(e){} });
  await pg.evaluate(PAGE_HELPERS);
  const v=await pg.evaluate(()=>({v:APP_VERSION, html:$('#htmlVer')&&$('#htmlVer').textContent}));
  ok('version 2026.11.19.39-guide and HTML stamp v18.39', v.v==='2026.11.19.39-guide' && /v18\.39/.test(v.html||''), v);
  await seedBook(pg);
  const fpsAll={}, restStats={}, flightStats={}, dwellStats={}, DWELL_N=24;

  for(const sty of (process.env.ONLY_H?[]:STY)){
    await pg.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); showView('library'); }, sty);
    await settle(pg, 700);
    await pg.evaluate(()=>{ document.scrollingElement.scrollTop=0; const l=$('#v-library'); if(l) l.scrollTop=0; guideScreen({snap:true}); });
    await wait(150);
    // a. library rest
    await restCheck(pg, `${sty} library`, 'continue');
    // a2. at rest it is still: no rAF callbacks at all
    { const z=await pg.evaluate(()=>new Promise(r=>{ const c0=GUIDE.rafCount; let g=0; const raf0=window.requestAnimationFrame; window.requestAnimationFrame=function(f){ g++; return raf0.call(window,f); };
        setTimeout(()=>{ window.requestAnimationFrame=raf0; r({guide:GUIDE.rafCount-c0, pending:!!GUIDE.raf, all:g}); }, 1500); }));
      ok(`${sty} library at rest: zero guide rAF callbacks in 1.5s (the loop sleeps)`, z.guide===0 && !z.pending, z); restStats[sty+' library']=z; }
    // a3. the idle nudge: once, ~6s after the last input, outside the reader; never again on the same screen
    { const n=await pg.evaluate(()=>new Promise(r=>{ guideIdleReset(); const t0=performance.now(), n0=GUIDE.nudges; let at=null;
        const iv=setInterval(()=>{ if(at==null && GUIDE.nudges>n0) at=performance.now()-t0; }, 25);
        setTimeout(()=>{ clearInterval(iv); r({first:at, n:GUIDE.nudges-n0}); }, 13000); }));
      ok(`${sty} library: one idle nudge ~6s after the last input, and only once on this screen`, n.n===1 && n.first>5800 && n.first<6600, n); }
    // b. Continue → reader: a real tap. The overlay never takes it; a happy squish-pulse; the book opens; every frame sampled
    const pul0=await pg.evaluate(()=>GUIDE.pulses);
    const hit=await pg.evaluate(()=>{ const r=document.querySelector('.hero-go').getBoundingClientRect(); const e=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return !!(e && e.closest('.hero-go')); });
    ok(`${sty}: a tap on Continue lands on Continue (the overlay is pointer-events:none)`, hit);
    const dwP=pg.evaluate(()=>__gDwell(1500));
    await pg.tap('.hero-go');
    const DW=await dwP;
    await pg.waitForFunction(()=>!$('#v-reader').hidden && R.meta, null, {timeout:8000}); await settle(pg, 300);
    const pul1=await pg.evaluate(()=>GUIDE.pulses);
    ok(`${sty}: tapping Continue gives one happy squish-pulse and still opens the book`, pul1===pul0+1, {pul0, pul1});
    const FO=await pg.evaluate(()=>GUIDE.flights.filter(f=>f.target==='rScrub').slice(-1)[0]);
    const dOpen=FO?Math.round(FO.arrive-FO.start):null;
    flightStats[sty+' book-open']={total:dOpen, hold:FO&&Math.round(FO.hold), motion:FO?Math.round(FO.arrive-FO.start-FO.hold):null, toRest:FO?Math.round(FO.rest-FO.start):null};
    ok(`${sty}: book-open flight (wake + flight + landing, tap to arrival) under 550ms`, FO && dOpen<550, flightStats[sty+' book-open']);
    dwellStats[sty+' book-open']={frames:DW.frames, overFrames:DW.over, maxConsecutive:DW.maxRun, slowOverFrames:DW.slowOver, minSpeedOverText:DW.minOverSpeed==null?null:Math.round(DW.minOverSpeed), visibleWhileHeld:DW.visHold};
    ok(`${sty}: book-open never pauses over the text (≤${DWELL_N} consecutive frames over it, never below 60px/s there, hidden while the page lays out)`, DW.maxRun<=DWELL_N && DW.slowOver===0 && DW.visHold===0, dwellStats[sty+' book-open']);
    ok(`${sty}: a flight writes only path d / opacity (and phase-boundary styles): no layout attributes`, DW.attrs.every(x=>['d','style','filter','data-at','data-split','data-merging'].includes(x)) && DW.pathStyle.every(x=>x==='opacity'), {attrs:DW.attrs, pathStyle:DW.pathStyle});
    // c. reader rest: bars on (thumb), bars off (strip), pill (play); never on the text; never moves while reading
    await pg.evaluate(()=>{ LS.set('hintBar',1); setChrome(true); }); await settle(pg, 500);
    await restCheck(pg, `${sty} reader (bars shown)`, 'thumb');
    { const z=await pg.evaluate(()=>new Promise(r=>{ guideIdleReset(); const c0=GUIDE.rafCount, n0=GUIDE.nudges; setTimeout(()=>r({guide:GUIDE.rafCount-c0, pending:!!GUIDE.raf, nudges:GUIDE.nudges-n0}), 7000); }));
      restStats[sty+' reader']=z;
      ok(`${sty} reader at rest: zero guide rAF callbacks, and no idle nudge in 7s (never in the reader)`, z.guide===0 && !z.pending && z.nudges===0, z); }
    let h=await pg.evaluate(()=>__gHits()); ok(`${sty} pages: the blob never touches the reading text (bars shown)`, h.hits===0 && h.words>50, h);
    await pg.evaluate(()=>setChrome(false)); await settle(pg, 500);
    await restCheck(pg, `${sty} reader (reading)`, 'strip');
    h=await pg.evaluate(()=>__gHits()); ok(`${sty} pages: the blob never touches the reading text (reading)`, h.hits===0, h);
    const m0=await pg.evaluate(()=>guideState().shape.rect);
    const smp=pg.evaluate(()=>__gSample(900));
    await pg.keyboard.press('ArrowRight'); await wait(400); await pg.keyboard.press('ArrowRight');
    const sm=await smp; const m1=await pg.evaluate(()=>guideState().shape.rect);
    const mx=await pg.evaluate(()=>{ const r=GUIDE.rest, b=guideBox(r.t), q=guideState().shape.rect; return {d:Math.max(Math.abs(b.x-q.x),Math.abs(b.y-q.y)), hits:__gHits().hits, kind:r.t.kind}; });
    ok(`${sty} pages: turning pages moves the progress mark silently (instant, no animation, no rAF), never over text`, sm.props.length===0 && sm.ticks-sm.raf0===0 && mx.d<0.6 && mx.hits===0 && m0.x!==m1.x, {m0x:m0.x, m1x:m1.x, props:sm.props, rafTicks:sm.ticks-sm.raf0, ...mx});
    await pg.keyboard.press('ArrowLeft'); await wait(350); await pg.keyboard.press('ArrowLeft'); await wait(400);
    // pill
    await pg.evaluate(()=>{ setChrome(true); $('#rTts').click(); });
    const ps=await pg.evaluate(()=>__gSample(1000));
    await settle(pg, 300);
    await restCheck(pg, `${sty} reader (read aloud)`, 'play');
    ok(`${sty}: flying to Play is transform/opacity only, one accent blob in flight`, ps.props.every(p=>p==='transform'||p==='opacity') && ps.props.length>0 && ps.dup===0, {props:ps.props, dup:ps.dup});
    h=await pg.evaluate(()=>__gHits()); ok(`${sty} pages: the blob on Play never touches the text`, h.hits===0, h);
    // scroll mode
    await pg.evaluate(async()=>{ await switchMode('scroll'); }); await settle(pg, 700);
    await restCheck(pg, `${sty} scroll (read aloud)`, 'play');
    h=await pg.evaluate(()=>__gHits()); ok(`${sty} scroll: the blob on Play never touches the text`, h.hits===0 && h.words>20, h);
    await pg.evaluate(()=>{ ttsModeOff(true); }); await settle(pg, 800);
    await pg.evaluate(()=>setChrome(true)); await settle(pg, 500);
    h=await pg.evaluate(()=>__gHits()); ok(`${sty} scroll: the blob never touches the text (bars shown)`, h.hits===0, h);
    await pg.evaluate(()=>setChrome(false)); await settle(pg, 500);
    await restCheck(pg, `${sty} scroll (reading)`, 'strip');
    h=await pg.evaluate(()=>__gHits()); ok(`${sty} scroll: the blob never touches the text (reading)`, h.hits===0, h);
    // placement identical with the guide on vs off and before vs after a flight
    for(const mode of ['pages','scroll']){
      await pg.evaluate(async(m)=>{ if(R.mode!==m) await switchMode(m); setChrome(true); }, mode); await settle(pg, 600);
      const a=await info(pg);
      await pg.evaluate(()=>guideSet(false)); await wait(300); const off=await info(pg);
      const offL=await pg.evaluate(()=>document.querySelectorAll('#guide').length);
      await pg.evaluate(()=>guideSet(true)); await wait(300); const on=await info(pg);
      await pg.evaluate(()=>guideTo([{el:$('#rTts'), kind:'mark'}])); await settle(pg, 700);
      await pg.evaluate(()=>guideScreen()); await settle(pg, 700);
      const after=await info(pg);
      const K=['pos','page','first','pages','topWord','clipH'];
      ok(`${sty} ${mode}: place, page count and first word identical with the guide off/on`, same(a,off,K) && same(a,on,K) && offL===0, {a:pick(a,K), off:pick(off,K), on:pick(on,K), offL});
      ok(`${sty} ${mode}: place, page count and first word identical before/after a flight`, same(a,after,K), {a:pick(a,K), after:pick(after,K)});
    }
    // open with the guide off vs on gives the same page
    { await pg.evaluate(()=>{ closeReader(true); }); await wait(300);
      await pg.evaluate(()=>guideSet(false)); await openBook(pg,'pages'); const o1=await info(pg); await pg.evaluate(()=>closeReader(true)); await wait(200);
      await pg.evaluate(()=>guideSet(true)); await openBook(pg,'pages'); await settle(pg,800); const o2=await info(pg);
      const K=['pos','page','first','pages','topWord'];
      ok(`${sty}: opening a book lands on the same page with the guide off or on`, same(o1,o2,K), {o1:pick(o1,K), o2:pick(o2,K)}); }
    // d. back to the library: flies to Continue
    const bs=pg.evaluate(()=>__gSample(1100)), bd=pg.evaluate(()=>__gDwell(1100));
    await pg.click('#rBack');
    const bsr=await bs, BD=await bd; await settle(pg, 200);
    const FB=await pg.evaluate(()=>GUIDE.flights.filter(f=>/hero-go/.test(f.target)).slice(-1)[0]);
    flightStats[sty+' back']={total:FB?Math.round(FB.arrive-FB.start):null, toRest:FB?Math.round(FB.rest-FB.start):null};
    ok(`${sty}: flight back to Continue under 550ms`, FB && FB.arrive-FB.start<550, flightStats[sty+' back']);
    dwellStats[sty+' back']={frames:BD.frames, overFrames:BD.over, maxConsecutive:BD.maxRun, slowOverFrames:BD.slowOver};
    ok(`${sty}: the flight back never pauses over the text`, BD.maxRun<=DWELL_N && BD.slowOver===0, dwellStats[sty+' back']);
    await restCheck(pg, `${sty} back in the library`, 'continue');
    ok(`${sty}: the flight back is transform/opacity only, and the buttons' own fills stay hidden in flight (one accent blob)`, bsr.props.every(p=>p==='transform'||p==='opacity') && bsr.props.length>0 && bsr.dup===0 && bsr.flyFrames>3, {props:bsr.props, dup:bsr.dup, flyFrames:bsr.flyFrames});
    const dts=bsr.dt.slice(1); fpsAll[sty]={frames:dts.length, avg:+(dts.reduce((a,b)=>a+b,0)/dts.length).toFixed(2), max:+Math.max(...dts).toFixed(1), over20:dts.filter(x=>x>20).length};
    // e. taps during a flight still work and the blob retargets
    await pg.evaluate(()=>document.querySelector('.hero-go').click()); await pg.waitForFunction(()=>!$('#v-reader').hidden && R.meta, null, {timeout:8000}); await settle(pg, 800);
    await pg.evaluate(()=>$('#rBack').click()); await wait(90);
    const mid=await pg.evaluate(()=>({flying:GUIDE.flying, lib:!$('#v-library').hidden}));
    await pg.evaluate(()=>document.querySelector('.hero-go').click());
    await pg.waitForFunction(()=>!$('#v-reader').hidden && R.meta, null, {timeout:8000}); await settle(pg, 1000);
    const rt=await pg.evaluate(()=>Object.assign(__gRest(), {offs:document.querySelectorAll('.guide-off').length}));
    ok(`${sty}: Continue tapped mid-flight opens the book and the blob retargets to the reader`, mid.flying && mid.lib && rt.id==='rScrub' && rectMatch(rt.s.shape.rect, rt.tb) && rt.offs===0, {mid, id:rt.id, offs:rt.offs});
    // retarget directly: A then B mid-flight ends on B
    await pg.evaluate(()=>{ guideTo([{el:$('#rTts'),kind:'mark'}]); }); await wait(80);
    const rt2a=await pg.evaluate(()=>GUIDE.flying);
    await pg.evaluate(()=>{ guideTo([{el:$('#rMark'),kind:'mark'}]); }); await settle(pg, 900);
    const rt2=await pg.evaluate(()=>{ const r=__gRest(); return {id:r.id, m:rectMatchJS(r.s.shape.rect, r.tb)}; function rectMatchJS(a,b){ return Math.abs(a.x-b.x)<=1&&Math.abs(a.y-b.y)<=1&&Math.abs(a.width-b.w)<=1&&Math.abs(a.height-b.h)<=1; } });
    ok(`${sty}: a new target mid-flight retargets the blob`, rt2a && rt2.id==='rMark' && rt2.m, {rt2a, rt2});
    await pg.evaluate(()=>guideScreen()); await settle(pg, 700);
    // resize and rotation re-snap it
    await pg.setViewportSize({width:844, height:390}); await wait(900); await settle(pg, 300);
    const rr=await pg.evaluate(()=>__gRest());
    ok(`${sty}: rotation re-snaps the blob in the reader`, rr.id==='rScrub' && rectMatch(rr.s.shape.rect, rr.tb), {shape:rr.s.shape.rect, tb:rr.tb});
    await pg.setViewportSize({width:390, height:844}); await wait(900); await settle(pg, 300);
    await pg.evaluate(()=>closeReader(true)); await settle(pg, 900);
    await pg.setViewportSize({width:360, height:780}); await wait(900); await settle(pg, 300);
    const rl=await pg.evaluate(()=>__gRest());
    ok(`${sty}: resizing re-snaps the blob onto Continue`, /hero-go/.test(rl.cls) && rectMatch(rl.s.shape.rect, rl.er), {shape:rl.s.shape.rect, er:rl.er});
    await pg.setViewportSize({width:390, height:844}); await wait(700); await settle(pg, 300);
  }

  // f. tour: each step moves it; split into at most 3 and merge back
  for(const sty of (process.env.ONLY_H?[]:STY)){
    await pg.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); startTour({replay:true}); }, sty);
    await wait(700); await settle(pg, 500);
    const s0=await pg.evaluate(()=>{ const r=__gRest(); return {cls:r.cls, real:r.s.realFill, m:Math.abs(r.s.shape.rect.x-r.er.x)<=1 && Math.abs(r.s.shape.rect.width-r.er.w)<=1}; });
    ok(`${sty} tour step 1: the blob is Continue's fill`, /hero-go/.test(s0.cls) && s0.real && s0.m, s0);
    const seen=[]; let maxSplit=1, merged=false; const snap0=await pg.evaluate(()=>GUIDE.snaps||0); let landed=[];
    for(let n=1;n<=6;n++){
      const smp=pg.evaluate(()=>__gSample(1700));
      await pg.evaluate(()=>tourAdvance());
      const r=await smp; maxSplit=Math.max(maxSplit, r.maxSplit); if(r.merging) merged=true;
      await settle(pg, 200);
      const st=await pg.evaluate(()=>{ const r=__gRest(); return {step:TOUR.step, id:r.id, cls:r.cls, split:guideState().split, box:r.tb, vis:guideState().visible}; });
      seen.push(st);
      if(n===2 || n===3){
        await pg.waitForFunction(()=>GUIDE.extras.length && GUIDE.extras.every(x=>x.body && !x.body.anim), null, {timeout:4000}).catch(()=>{});
        const L=await pg.evaluate(()=>GUIDE.extras.map(x=>{ const q=guideDropAt(x.b); return {d:Math.hypot(x.body.c.x-q.x, x.body.c.y-q.y), op:x.body.op, still:!x.body.anim}; }));
        landed.push(...L);
        ok(`${sty} tour step ${n+1}: one blob split into ${st.split} (≤3)`, st.split===3 && st.vis<=3, st);
      }
      if(n===4) ok(`${sty} tour step 5: merged back into one blob`, st.split===1, st);
    }
    const moved=new Set(seen.map(s=>s.id+':'+Math.round(s.box.x)+','+Math.round(s.box.y))).size;
    ok(`${sty} tour: the blob moves to each step's target`, moved>=5 && seen[4].id==='' && /tour-pill-play/.test(seen[4].cls) && seen[5].id==='tourStart', seen.map(s=>s.id||s.cls));
    ok(`${sty} tour: never more than three blobs, and they merge before moving on`, maxSplit<=3 && merged, {maxSplit, merged});
    const snaps=await pg.evaluate(()=>GUIDE.snaps||0)-snap0;
    ok(`${sty} tour: mitosis — each droplet buds on a strand that snaps, lands on its own target and comes to rest`, snaps>=4 && landed.length===4 && landed.every(x=>x.d<1.5 && x.op>.9 && x.still), {snaps, landed});
    await pg.evaluate(()=>tourEnd(false)); await settle(pg, 900);
    const e=await pg.evaluate(()=>__gRest());
    ok(`${sty} tour end: back on Continue`, /hero-go/.test(e.cls) && e.s.realFill, {cls:e.cls});
  }

  // h. v39 UI/UX check: the strip never meets the footer text, overlays hide it, tab mark under the label, one accent on
  //    Add, Play never flashes, labels keep their ink, contrast, frames at 1x/4x
  const cdp=await ctx.newCDPSession(pg); const contrast={}, fps4={};
  await pg.evaluate(()=>{ window.__lum=c=>{ const m=c.match(/[\d.]+/g).map(Number); const f=v=>{ v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }; return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]); };
    window.__cr=(a,b)=>{ const x=__lum(a), y=__lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    window.__mix=(fg,bg,a)=>{ const p=fg.match(/[\d.]+/g).map(Number), q=bg.match(/[\d.]+/g).map(Number); return `rgb(${[0,1,2].map(i=>Math.round(p[i]*a+q[i]*(1-a))).join(',')})`; };
    window.__shapeCol=()=>{ const i=GUIDE.shapes[GUIDE.cur].firstChild; return {c:getComputedStyle(i).backgroundColor, op:+getComputedStyle(GUIDE.shapes[GUIDE.cur]).opacity*(+getComputedStyle(i).opacity)}; };
    window.__ftext=()=>{ const el=$('#runFoot'), rg=document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect().toJSON(); };
    window.__ix=(a,b)=>a.left<b.right && a.right>b.left && a.top<b.bottom && a.bottom>b.top; });
  for(const sty of STY){
    await pg.evaluate((sty)=>{ S.style=sty; S.mode='pages'; S.theme='white'; saveSettings(); applyLook(); showView('library'); }, sty); await settle(pg, 600);
    await pg.evaluate(()=>document.querySelector('.hero-go').click()); await pg.waitForFunction(()=>!$('#v-reader').hidden && R.meta); await settle(pg, 900);
    await pg.evaluate(()=>setChrome(false)); await settle(pg, 500);
    // 1. strip vs footer text, with and without a home-indicator inset, across the book
    for(const sab of [0,34]){
      await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:sab?47:0,bottom:sab,left:0,right:0}}).catch(()=>{});
      await pg.evaluate(()=>window.dispatchEvent(new Event('resize'))); await settle(pg, 300);
      const r=await pg.evaluate(async()=>{ const sc=$('#rScrub'), v0=sc.value, out=[]; const mn=+sc.min||0, mx=+sc.max||1;
        for(const f of [0,.1,.25,.4,.5,.6,.75,.9,1]){ sc.value=String(mn+f*(mx-mn)); await guideTo([{el:$('#runFoot'), kind:'strip'}], {snap:true});
          const m=GUIDE.shapes[GUIDE.cur].getBoundingClientRect(), t=__ftext(); out.push({f, hit:__ix(m,t), m:[Math.round(m.left),Math.round(m.top),Math.round(m.right),Math.round(m.bottom)], t:[Math.round(t.left),Math.round(t.top),Math.round(t.right),Math.round(t.bottom)], inView:m.bottom<=innerHeight && m.left>=0 && m.right<=innerWidth}); }
        sc.value=v0; await guideScreen({snap:true}); return out; });
      ok(`${sty} strip mark never intersects the footer text (inset ${sab}px, 9 spots across the book)`, r.every(x=>!x.hit && x.inView), r.filter(x=>x.hit||!x.inView).concat([r[4]]));
    }
    await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,bottom:0,left:0,right:0}}).catch(()=>{});
    await pg.evaluate(()=>window.dispatchEvent(new Event('resize'))); await settle(pg, 300);
    // contrast of the faint strip, and of the thumb dot, on every theme
    for(const th of ['white','paper','sepia','gray','dark','black']){
      const c=await pg.evaluate(async(th)=>{ S.theme=th; saveSettings(); applyLook(); await new Promise(r=>setTimeout(r,450)); setChrome(false); await new Promise(r=>setTimeout(r,450)); await guideScreen({snap:true});
        const bg=getComputedStyle($('#v-reader')).backgroundColor; const s=__shapeCol(); const strip=__cr(__mix(s.c,bg,s.op),bg);
        setChrome(true); await new Promise(r=>setTimeout(r,450)); await guideScreen({snap:true}); const t=__shapeCol(); const bg2=getComputedStyle($('#rFoot')).backgroundColor; const bgx=/rgba\(.*, 0\)/.test(bg2)?bg:bg2;
        setChrome(false); await new Promise(r=>setTimeout(r,300));
        return {strip:+strip.toFixed(2), stripOp:+s.op.toFixed(2), thumb:+__cr(__mix(t.c,bgx,t.op),bgx).toFixed(2)}; }, th);
      contrast[sty+'/'+th]=c;
    }
    const cs=Object.entries(contrast).filter(([k])=>k.startsWith(sty+'/'));
    ok(`${sty} contrast: the reading strip mark is low contrast (≤3:1, visible ≥1.2:1); the thumb dot is ≥3:1 on all 6 themes`, cs.every(([k,c])=>c.strip<=3 && c.strip>=1.2 && c.thumb>=3), Object.fromEntries(cs));
    await pg.evaluate(()=>{ S.theme='white'; saveSettings(); applyLook(); }); await settle(pg, 500);
    // 7. progress mark follows page turns silently
    await pg.evaluate(()=>setChrome(false)); await settle(pg, 400);
    const t0r=await pg.evaluate(()=>GUIDE.rafCount); const pt={xs:[]};
    for(let i=0;i<3;i++){ await pg.keyboard.press('ArrowRight'); await wait(380); pt.xs.push(await pg.evaluate(()=>{ const b=guideBox(GUIDE.rest.t), q=GUIDE.shapes[GUIDE.cur].getBoundingClientRect(); return {x:Math.round(q.left), d:+Math.abs(b.x-q.left).toFixed(2), hit:__ix(q,__ftext()), anims:document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)).length}; })); }
    pt.raf=await pg.evaluate(()=>GUIDE.rafCount)-t0r;
    ok(`${sty} progress mark: on every page turn it is already at the new place (no animation, no rAF), off the text`, pt.raf===0 && pt.xs.every(x=>x.d<.6 && !x.hit && x.anims===0) && new Set(pt.xs.map(x=>x.x)).size>1, pt);
    // 2. it steps aside under the "Back to where you were" chip and toasts
    const ov=await pg.evaluate(async()=>{ setBack(R.pos); await new Promise(r=>setTimeout(r,250)); const a={under:document.documentElement.classList.contains('guide-under'), op:+getComputedStyle($('#guide')).opacity};
      $('#backPill').hidden=true; await new Promise(r=>setTimeout(r,250)); const b={under:document.documentElement.classList.contains('guide-under'), op:+getComputedStyle($('#guide')).opacity};
      toast('Hello'); await new Promise(r=>setTimeout(r,250)); const c={under:document.documentElement.classList.contains('guide-under'), op:+getComputedStyle($('#guide')).opacity}; return {back:a, after:b, toast:c}; });
    ok(`${sty} hides under #backGo's chip and toasts, and comes back after`, ov.back.under && ov.back.op===0 && !ov.after.under && ov.after.op===1 && ov.toast.under && ov.toast.op===0, ov);
    await pg.waitForFunction(()=>$('#toast').hidden, null, {timeout:9000}).catch(()=>{}); await wait(250);
    // 5. Play: its own fill is hidden from the pill's first frame until the blob lands; 6. labels keep their ink
    const pf=await pg.evaluate(()=>new Promise(res=>{ setChrome(true); const p=$('#ttsPlay'); const fr=[]; let n=0; const ink0=getComputedStyle($('#rTop')).color;
      $('#rTts').click(); const t0=performance.now();
      const f=()=>{ const bar=$('#ttsBar'); if(bar && !bar.hidden){ const cs=getComputedStyle(p); const off=p.classList.contains('guide-off'); fr.push({t:Math.round(performance.now()-t0), bg:cs.backgroundColor, off, ink:cs.color, fly:!!(GUIDE.main&&GUIDE.main.anim), filled:!!(GUIDE.main&&GUIDE.main.ev&&GUIDE.main.ev.fired&&GUIDE.main.ev.fired.fill)}); }
        if(++n<70) requestAnimationFrame(f); else res({fr, ink0}); }; requestAnimationFrame(f); }));
    await settle(pg, 300);
    const flash=pf.fr.filter(x=>!x.filled && !x.off && (x.fly || pf.fr.indexOf(x)<3)); /* from the first painted frame, and through the flight until the mould fills */
    const grey=pf.fr.filter(x=>x.off).filter(x=>{ const m=x.ink.match(/[\d.]+/g).map(Number); return Math.abs(m[0]-m[1])<12 && m[0]>80 && m[0]<170; });
    ok(`${sty} Play: no own fill from the pill's first frame until the blob has filled it; its label keeps full ink`, pf.fr.length>5 && flash.length===0 && grey.length===0, {first:pf.fr[0], flash:flash.slice(0,3), grey:grey.slice(0,2), frames:pf.fr.length});
    await pg.evaluate(()=>{ try{ ttsStop&&ttsStop(); }catch(e){} try{ $('#ttsClose')&&$('#ttsClose').click(); }catch(e){} }); await settle(pg, 400);
    // back to the library; Continue's label ink while it is filled by the blob
    const bk=await pg.evaluate(()=>new Promise(res=>{ setChrome(true); const fr=[]; let n=0; $('#rBack').click();
      const f=()=>{ const go=document.querySelector('#v-library .hero-go'); if(go && go.classList.contains('guide-off')){ const c=getComputedStyle(go).color; fr.push(c); } if(++n<60) requestAnimationFrame(f); else res({fr, ink:getComputedStyle(document.body).color}); }; requestAnimationFrame(f); }));
    await settle(pg, 400);
    ok(`${sty} Continue's label keeps full ink while the blob is on its way (not greyed out)`, bk.fr.every(c=>c===bk.ink), {seen:[...new Set(bk.fr)], ink:bk.ink});
    // 3. the tab mark sits fully below the tab label
    for(const tab of ['words','stats','settings']){
      const tm=await pg.evaluate(async(tab)=>{ showView(tab); await new Promise(r=>setTimeout(r,700)); await guideScreen({snap:true}); const b=document.querySelector(`#tabs button[data-tab="${tab}"]`); const t=guideTextRect(b); const m=GUIDE.shapes[GUIDE.cur].getBoundingClientRect();
        return {tab, gap:+(m.top-t.bottom).toFixed(1), inView:m.bottom<=innerHeight, hit:__ix(m,t), op:+getComputedStyle(GUIDE.shapes[GUIDE.cur].firstChild).opacity}; }, tab);
      ok(`${sty} ${tab} tab: the mark sits fully below its label`, tm.gap>=1 && !tm.hit && tm.inView && tm.op>.9, tm);
    }
    await pg.evaluate(()=>showView('library')); await settle(pg, 600);
    // 4x CPU: flight back from the reader and book-open frames (precomputed WAAPI keeps the motion on the compositor)
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const o4=pg.evaluate(()=>__gSample(1600)); await pg.evaluate(()=>document.querySelector('.hero-go').click()); const s4=await o4; await settle(pg, 900);
    const k4=pg.evaluate(()=>__gSample(1400)); await pg.evaluate(()=>{ setChrome(true); $('#rBack').click(); }); const t4=await k4; await settle(pg, 900);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    const st=a=>{ const d=a.slice(2).sort((x,y)=>x-y); return {frames:d.length, avg:+(d.reduce((p,q)=>p+q,0)/d.length).toFixed(2), p95:+d[Math.floor(d.length*.95)].toFixed(1), max:+d[d.length-1].toFixed(1), over34:d.filter(x=>x>34).length}; };
    fps4[sty]={open:st(s4.dt), back:st(t4.dt)};
    const fl=await pg.evaluate(()=>GUIDE.flights.slice(-2).map(f=>({t:f.target, total:Math.round(f.rest-f.start)})));
    ok(`${sty} 4x CPU: book-open and back still land (flights recorded)`, fl.length===2, {fps:fps4[sty], fl});
  }
  // 4. one accent on Add to library: a fresh user with an empty library, and after the tour's Start reading
  for(const sty of STY){
    const c2=await b.newContext({ viewport:{width:390, height:844}, deviceScaleFactor:1, serviceWorkers:'block', hasTouch:true, isMobile:true });
    await c2.addInitScript(voiceMock); await c2.addInitScript((sty)=>{ try{ localStorage.setItem('rf.tourDone','1'); const k=Object.keys(localStorage); }catch(e){} window.__sty=sty; }, sty);
    const p2=await c2.newPage(); const e2=[]; p2.on('pageerror', e=>e2.push(e.message));
    await p2.goto(URL, {waitUntil:'domcontentloaded'}); await p2.waitForFunction(()=>typeof guideTo==='function' && typeof LIB!=='undefined'); await wait(300);
    const firstFrames=await p2.evaluate(()=>new Promise(res=>{ const out=[]; let n=0; const f=()=>{ const a=$('#addBtn'); const s=guideState(); out.push({kind:s.target&&s.target.kind, off:a.classList.contains('guide-off'), sh:s.shapesVis, real:s.realFill}); if(++n<40) requestAnimationFrame(f); else res(out); }; f(); }));
    await p2.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); }, sty); await wait(700);
    const a1=await p2.evaluate(()=>{ const s=guideState(), a=$('#addBtn'); return {lib:LIB.length, hero:!!document.querySelector('.continue-hero'), kind:s.target&&s.target.kind, id:s.target&&s.target.id, shapesVis:s.shapesVis, pathsVis:s.pathsVis, real:s.realFill, bg:getComputedStyle(a).backgroundColor}; });
    const dbl=firstFrames.filter(x=>x.kind==='mark' || (x.sh>0 && x.real));
    ok(`${sty} empty library: Add to library is one accent (its own fill, no extra mark), from the first frame`, a1.kind==='fill' && a1.id==='addBtn' && a1.shapesVis===0 && a1.pathsVis===0 && a1.real && dbl.length===0, {a1, dbl:dbl.slice(0,3)});
    await c2.close();
    const c3=await b.newContext({ viewport:{width:390, height:844}, deviceScaleFactor:1, serviceWorkers:'block', hasTouch:true, isMobile:true });
    await c3.addInitScript(voiceMock);
    const p3=await c3.newPage();
    await p3.goto(URL, {waitUntil:'domcontentloaded'}); await p3.waitForFunction(()=>typeof guideTo==='function' && typeof TOUR!=='undefined'); await wait(900);
    const tourOn=await p3.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); if(!TOUR.on) startTour({replay:true}); return TOUR.on; }, sty); await wait(600);
    for(let i=0;i<8;i++){ const on=await p3.evaluate(()=>TOUR.on); if(!on) break; const st=await p3.$('#tourStart'); if(st && await st.isVisible()){ await st.click(); break; } await p3.evaluate(()=>tourAdvance()); await wait(700); }
    await wait(1200);
    const a2=await p3.evaluate(()=>{ const s=guideState(); return {tour:TOUR.on, lib:LIB.length, kind:s.target&&s.target.kind, id:s.target&&s.target.id, cls:s.target?'':'', shapesVis:s.shapesVis, pathsVis:s.pathsVis, real:s.realFill, offs:document.querySelectorAll('.guide-off').length}; });
    ok(`${sty} after the tour's Start reading: one accent (a fill, no mark on top), no leftover hidden fills`, !a2.tour && a2.kind==='fill' && a2.shapesVis===0 && a2.pathsVis===0 && a2.real && a2.offs===0, {tourOn, ...a2});
    await c3.close();
  }
  console.log('CONTRAST:', JSON.stringify(contrast));
  console.log('FPS 4x (rAF deltas ms):', JSON.stringify(fps4));

  // g. reduced motion: fades only
  await pg.emulateMedia({reducedMotion:'reduce'});
  for(const sty of STY){
    await pg.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); showView('library'); }, sty); await settle(pg, 600);
    const smp=pg.evaluate(()=>__gSample(900));
    await pg.evaluate(()=>document.querySelector('.hero-go').click());
    const r=await smp; await settle(pg, 400);
    const ticks=r.ticks-r.raf0;
    ok(`${sty} reduced motion: Continue → reader is a fade (opacity only, no physics, no rAF)`, r.props.length>0 && r.props.every(p=>p==='opacity') && ticks===0, {props:r.props, rafTicks:ticks});
    await restCheck(pg, `${sty} reduced motion reader`, 'thumb');
    const smp2=pg.evaluate(()=>__gSample(900));
    await pg.evaluate(()=>$('#rBack').click());
    const r2=await smp2; await settle(pg, 300);
    ok(`${sty} reduced motion: back to Continue is a fade (no rAF)`, r2.props.every(p=>p==='opacity') && r2.props.length>0 && r2.ticks-r2.raf0===0, {props:r2.props, rafTicks:r2.ticks-r2.raf0});
    await restCheck(pg, `${sty} reduced motion library`, 'continue');
  }
  await pg.emulateMedia({reducedMotion:'no-preference'});
  ok('no console errors', errs.length===0, errs.slice(0,6));
  console.log('FPS (flight back to Continue, rAF deltas ms):', JSON.stringify(fpsAll));
  const vid=pg.video(); await ctx.close(); if(vid){ const p=await vid.path(); try{ fs.renameSync(p, SHOTS+'/guide-run.webm'); }catch(e){} }
  await b.close();
  console.log(failed?`FAILED ${failed}`:'ALL PASS');
  process.exit(failed?1:0);
})();
function pick(o,K){ const r={}; for(const k of K) r[k]=o[k]; return r; }
