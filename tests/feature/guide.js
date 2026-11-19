/* The Guide (v39): one accent blob, its rest spots, flights (transform/opacity only), no effect on layout or place,
   taps mid-flight, the tour split/merge, Reduce Motion fades, resize/rotation, in all three Styles. node tests/feature/guide.js */
const __E=require('../env');
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __E.SCRATCH+'guide';
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.PLAYWRIGHT_CHROME || '';
const URL = process.env.TOOZ_URL || 'http://localhost:8750/';
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
    let last=performance.now(); const t0=last;
    const tick=(now)=>{
      out.dt.push(now-last); last=now; out.frames++;
      for(const p of __gAnimProps()) out.props.add(p);
      const s=guideState(); out.maxVis=Math.max(out.maxVis, s.visible + (s.realFill?1:0)); out.maxSplit=Math.max(out.maxSplit, s.split||1);
      if($('#guide') && $('#guide').dataset.merging) out.merging=true;
      const fl=document.querySelectorAll('.guide-off').length; out.fills.push(fl);
      /* in flight: the fill it is heading for must be hidden, and no split blobs are out */
      if(GUIDE.flying){ out.flyFrames=(out.flyFrames||0)+1; const ft=GUIDE.flyTo; if(ft && ft.b.fill && !ft.el.classList.contains('guide-off') && GUIDE.layer.dataset.at==='flight') out.dup=(out.dup||0)+1; if(GUIDE.splits.some(o=>+getComputedStyle(o.firstChild).opacity>.05)) out.dup=(out.dup||0)+1; }
      out.transforms.push(getComputedStyle(GUIDE.blob).transform);
      if(now-t0<ms) requestAnimationFrame(tick); else { out.props=[...out.props]; res(out); }
    };
    requestAnimationFrame(tick);
  });
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
  if(r.tb && r.tb.fill){
    ok(`${label}: matches the button's rect and radius and hands off to its real fill`, rectMatch(s.shape.rect, r.er) && s.shape.rad===getRad(r.erad) && s.realFill && s.shape.op<.05, {shape:s.shape, er:r.er, erad:r.erad});
  }
  return r;
}
const getRad=x=>x.split(' ')[0];

(async()=>{
  const b = await chromium.launch({ executablePath: CHROME&&fs.existsSync(CHROME)?CHROME:undefined, args:['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport:{width:390, height:844}, deviceScaleFactor:2, serviceWorkers:'block', hasTouch:true, isMobile:true,
  });
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
  const fpsAll={};

  for(const sty of STY){
    await pg.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); showView('library'); }, sty);
    await settle(pg, 700);
    await pg.evaluate(()=>{ document.scrollingElement.scrollTop=0; const l=$('#v-library'); if(l) l.scrollTop=0; guideScreen({snap:true}); });
    await wait(150);
    // a. library rest
    await restCheck(pg, `${sty} library`, 'continue');
    // b. Continue flight: lift frames, then the flight (seeked frames for the strip), sampling every frame
    const frames=[];
    const shot=async(name)=>{ const p=`${SHOTS}/f-${sty}-${frames.length}.png`; await pg.screenshot({path:p}); frames.push(p); };
    await shot('rest');
    const liftD=await pg.evaluate(()=>{ guideLift(document.querySelector('.hero-go')); const as=document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)); as.forEach(a=>a.pause()); return Math.max(...as.map(a=>a.effect.getTiming().duration)); });
    for(const f of [.4,1]){ await pg.evaluate((t)=>document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)).forEach(a=>a.currentTime=t), liftD*f); await shot('lift'); }
    await pg.evaluate(()=>document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)).forEach(a=>a.play()));
    const before=await pg.evaluate(()=>({pos:LIB.find(x=>x.id===window.__pillTestId).pos}));
    // click Continue for real, catch the flight and seek it
    await pg.evaluate(()=>{ window.__gFlightSeen=null; const o=new MutationObserver(()=>{ if($('#guide').dataset.at==='flight' && !GUIDE.lifted && !window.__gFlightSeen){ window.__gFlightSeen=performance.now(); document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)).forEach(a=>a.pause()); o.disconnect(); } }); o.observe($('#guide'),{attributes:true}); document.querySelector('.hero-go').click(); });
    await pg.waitForFunction(()=>!!window.__gFlightSeen && !$('#v-reader').hidden, null, {timeout:8000});
    await wait(250); /* the reader is laid out under the paused blob */
    const fd=await pg.evaluate(()=>{ const as=document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)); return {n:as.length, d:Math.max(...as.map(a=>a.effect.getTiming().duration)), props:__gAnimProps()}; });
    ok(`${sty}: the Continue flight animates transform and opacity only`, fd.n>0 && fd.props.every(p=>p==='transform'||p==='opacity'), fd);
    for(let k=0;k<=6;k++){ await pg.evaluate((t)=>document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)).forEach(a=>{ a.currentTime=Math.min(t, a.effect.getTiming().duration); }), fd.d*k/6); await shot('fly'); }
    await pg.evaluate(()=>document.getAnimations().filter(a=>$('#guide').contains(a.effect.target)).forEach(a=>a.play()));
    await settle(pg, 900);
    await shot('rest');
    /* frames are kept in the scratch folder (f-<style>-<n>.png) */
    // c. reader rest: bars on (thumb), bars off (strip), pill (play); never on the text; never moves while reading
    await pg.evaluate(()=>{ LS.set('hintBar',1); setChrome(true); }); await settle(pg, 500);
    await restCheck(pg, `${sty} reader (bars shown)`, 'thumb');
    let h=await pg.evaluate(()=>__gHits()); ok(`${sty} pages: the blob never touches the reading text (bars shown)`, h.hits===0 && h.words>50, h);
    await pg.evaluate(()=>setChrome(false)); await settle(pg, 500);
    await restCheck(pg, `${sty} reader (reading)`, 'strip');
    h=await pg.evaluate(()=>__gHits()); ok(`${sty} pages: the blob never touches the reading text (reading)`, h.hits===0, h);
    const m0=await pg.evaluate(()=>guideState().shape.rect);
    const smp=pg.evaluate(()=>__gSample(900));
    await pg.keyboard.press('ArrowRight'); await wait(400); await pg.keyboard.press('ArrowRight');
    const sm=await smp; const m1=await pg.evaluate(()=>guideState().shape.rect);
    ok(`${sty} pages: the mark stays still while you turn pages`, JSON.stringify(m0)===JSON.stringify(m1) && sm.props.length===0, {m0, m1, props:sm.props});
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
    const bs=pg.evaluate(()=>__gSample(1100));
    await pg.click('#rBack');
    const bsr=await bs; await settle(pg, 200);
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
  for(const sty of STY){
    await pg.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); startTour({replay:true}); }, sty);
    await wait(700); await settle(pg, 500);
    const s0=await pg.evaluate(()=>{ const r=__gRest(); return {cls:r.cls, real:r.s.realFill, m:Math.abs(r.s.shape.rect.x-r.er.x)<=1 && Math.abs(r.s.shape.rect.width-r.er.w)<=1}; });
    ok(`${sty} tour step 1: the blob is Continue's fill`, /hero-go/.test(s0.cls) && s0.real && s0.m, s0);
    const seen=[]; let maxSplit=1, merged=false;
    for(let n=1;n<=6;n++){
      const smp=pg.evaluate(()=>__gSample(1700));
      await pg.evaluate(()=>tourAdvance());
      const r=await smp; maxSplit=Math.max(maxSplit, r.maxSplit); if(r.merging) merged=true;
      await settle(pg, 200);
      const st=await pg.evaluate(()=>{ const r=__gRest(); return {step:TOUR.step, id:r.id, cls:r.cls, split:guideState().split, box:r.tb, vis:guideState().visible}; });
      seen.push(st);
      if(n===2 || n===3) ok(`${sty} tour step ${n+1}: one blob split into ${st.split} (≤3)`, st.split===3 && st.vis<=3, st);
      if(n===4) ok(`${sty} tour step 5: merged back into one blob`, st.split===1, st);
    }
    const moved=new Set(seen.map(s=>s.id+':'+Math.round(s.box.x)+','+Math.round(s.box.y))).size;
    ok(`${sty} tour: the blob moves to each step's target`, moved>=5 && seen[4].id==='' && /tour-pill-play/.test(seen[4].cls) && seen[5].id==='tourStart', seen.map(s=>s.id||s.cls));
    ok(`${sty} tour: never more than three blobs, and they merge before moving on`, maxSplit<=3 && merged, {maxSplit, merged});
    await pg.evaluate(()=>tourEnd(false)); await settle(pg, 900);
    const e=await pg.evaluate(()=>__gRest());
    ok(`${sty} tour end: back on Continue`, /hero-go/.test(e.cls) && e.s.realFill, {cls:e.cls});
  }

  // g. reduced motion: fades only
  await pg.emulateMedia({reducedMotion:'reduce'});
  for(const sty of STY){
    await pg.evaluate((sty)=>{ S.style=sty; saveSettings(); applyLook(); showView('library'); }, sty); await settle(pg, 600);
    const smp=pg.evaluate(()=>__gSample(900));
    await pg.evaluate(()=>document.querySelector('.hero-go').click());
    const r=await smp; await settle(pg, 400);
    const tr=new Set(r.transforms).size;
    ok(`${sty} reduced motion: Continue → reader is a fade (opacity only, the blob never travels)`, r.props.length>0 && r.props.every(p=>p==='opacity') && tr<=2, {props:r.props, transforms:tr});
    await restCheck(pg, `${sty} reduced motion reader`, 'thumb');
    const smp2=pg.evaluate(()=>__gSample(900));
    await pg.evaluate(()=>$('#rBack').click());
    const r2=await smp2; await settle(pg, 300);
    ok(`${sty} reduced motion: back to Continue is a fade`, r2.props.every(p=>p==='opacity') && r2.props.length>0, {props:r2.props});
    await restCheck(pg, `${sty} reduced motion library`, 'continue');
  }
  await pg.emulateMedia({reducedMotion:'no-preference'});
  ok('no console errors', errs.length===0, errs.slice(0,6));
  console.log('FPS (flight back to Continue, rAF deltas ms):', JSON.stringify(fpsAll));
  await ctx.close();
  await b.close();
  console.log(failed?`FAILED ${failed}`:'ALL PASS');
  process.exit(failed?1:0);
})();
function pick(o,K){ const r={}; for(const k of K) r[k]=o[k]; return r; }
