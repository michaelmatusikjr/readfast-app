/* ---------- first-run tour (demo layer; never writes library, notes, words or settings) ---------- */
const TOUR_DOTS=6;
const TOUR_AUTO_MS=6000;
const TOUR_CAP_MAX=420; /* the caption card never stretches wider than this; on a wide screen it sits centred */
const TOUR_ANIM_MS=800;
let TOUR={on:false, step:0, replay:false, token:0, reduced:false, timers:[], lastFocus:null, tmpHero:null, swiping:null};

function tourDoneSet(){ LS.set('tourDone', 1); }
function tourIsDone(){ return !!LS.get('tourDone', 0); }
function tourReduced(){ try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } }
function shouldAutoTour(){
  if(tourIsDone()) return false;
  const books=(typeof LIB!=='undefined' && LIB)?LIB.filter(m=>m && !m.pending):[];
  if(!books.length) return true;
  return books.every(m=>m.kind==='sample');
}
function tourRoot(){ return document.getElementById('tour'); }
function tourClearTimers(){ (TOUR.timers||[]).forEach(t=>clearTimeout(t)); TOUR.timers=[]; TOUR.autoTimer=null; }
function tourAfter(ms){
  return new Promise(res=>{
    const tok=TOUR.token;
    const t=setTimeout(()=>{ if(TOUR.token===tok && TOUR.on) res(true); else res(false); }, ms);
    TOUR.timers.push(t);
  });
}

function tourMeasureRfoot(){
  const vr=$('#v-reader'), foot=$('#rFoot');
  if(!foot) return 96;
  /* Always measure the footer at the current size: --rfoot-h on the reader is only refreshed while a book is open,
     so after a rotation it can still hold the old orientation's height and the demo pill would sit off the live one. */
  let h=0;
  const wasHidden=vr && vr.hidden;
  const css=vr?vr.style.cssText:'';
  if(vr && wasHidden){
    vr.hidden=false;
    vr.style.cssText='position:fixed;left:-9999px;top:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:-1';
  }
  h=Math.round(foot.getBoundingClientRect().height)||96;
  if(vr && wasHidden){ vr.hidden=true; vr.style.cssText=css; }
  return h;
}

function tourBox(el, pad){
  if(!el || el.hidden || (el.closest && el.closest('[hidden]'))) return null;
  const r=stillRect(el);
  if(r.width<2 || r.height<2) return null;
  const p=pad||0;
  return {left:r.left-p, top:r.top-p, right:r.right+p, bottom:r.bottom+p};
}

function tourObstacles(){
  const ids=['tourSkip','tourNext','tourStart','tourDots','tourPeek','tourMoment','tourPill','tourSel','tourFinger'];
  const out=[];
  for(const id of ids){
    const b=tourBox($('#'+id), 8);
    if(b) out.push(b);
  }
  const demo=tourDemo();
  if(!demo || demo.hidden){
    const hero=document.querySelector('#v-library .continue-hero');
    const go=document.querySelector('#v-library .hero-go');
    const hb=tourBox(hero, 10); if(hb) out.push(hb);
    const gb=tourBox(go, 10); if(gb) out.push(gb);
    const tb=tourBox($('#tabs'), 8); if(tb) out.push(tb);
  }
  return out;
}

function tourPlaceCaption(hole){
  const cap=$('#tourCaption'), next=$('#tourNext'), start=$('#tourStart'), skip=$('#tourSkip');
  if(!cap) return;
  const root=getComputedStyle(document.documentElement);
  const safeTop=parseFloat(root.getPropertyValue('--sat'))||0;
  const safeBot=parseFloat(root.getPropertyValue('--sab'))||0;
  const safeL=parseFloat(root.getPropertyValue('--sal'))||0;
  const safeR=parseFloat(root.getPropertyValue('--sar'))||0;
  const foot=(!start||start.hidden)?next:start;
  const vw=innerWidth, vh=innerHeight, margin=12;
  const band=Math.max(80, vw-safeL-safeR-40);
  const width=Math.min(band, TOUR_CAP_MAX);
  const left=safeL+20+(band-width)/2;
  cap.style.left=left+'px';
  cap.style.width=width+'px';
  cap.style.right='auto';
  cap.style.bottom='auto';
  const capH=Math.max(40, cap.offsetHeight||56);
  const obs=tourObstacles();
  const holeBox=hole?{left:hole.left, top:hole.top, right:hole.right, bottom:hole.bottom}:null;
  const overlaps=(top,l,w)=>{
    const a={left:l, top, right:l+w, bottom:top+capH};
    const hit=r=>!(a.bottom<=r.top-8 || a.top>=r.bottom+8 || a.right<=r.left-8 || a.left>=r.right+8);
    if(holeBox && hit(holeBox)) return true;
    return obs.some(hit);
  };
  let reservedBot=safeBot+16;
  if(foot && !foot.hidden) reservedBot=Math.max(reservedBot, vh-foot.getBoundingClientRect().top+12);
  const dots=$('#tourDots');
  if(dots && !dots.hidden) reservedBot=Math.max(reservedBot, vh-dots.getBoundingClientRect().top+10);
  const pill=$('#tourPill');
  if(pill && !pill.hidden) reservedBot=Math.max(reservedBot, vh-pill.getBoundingClientRect().top+10);
  const minTop=Math.max(safeTop+8, skip&&!skip.hidden?skip.getBoundingClientRect().bottom+8:safeTop+56);
  const maxTop=vh-reservedBot-capH;
  const cands=[];
  const push=(top,l,w,pri)=>{
    if(w<80 || top==null || !isFinite(top)) return;
    if(top<safeTop+4 || top+capH>vh-safeBot+8) return;
    cands.push({top, left:l, w, pri});
  };
  if(holeBox){
    const holeMid=(holeBox.top+holeBox.bottom)/2;
    const preferAbove=holeMid>vh*0.5;
    const aboveTop=holeBox.top-capH-margin;
    const belowTop=holeBox.bottom+margin;
    const aboveFits=aboveTop>=minTop-1 && aboveTop+capH<=holeBox.top-8;
    const belowFits=belowTop+capH<=vh-reservedBot+8 && belowTop>=holeBox.bottom+8;
    if(preferAbove){
      if(aboveFits) push(Math.max(minTop, aboveTop), left, width, 0);
      if(belowFits) push(Math.min(maxTop, belowTop), left, width, 1);
    }else{
      if(belowFits) push(Math.min(maxTop, belowTop), left, width, 0);
      if(aboveFits) push(Math.max(minTop, aboveTop), left, width, 1);
    }
    const leftW=Math.max(120, holeBox.left-safeL-32);
    const rightX=holeBox.right+12, rightW=Math.max(120, vw-safeR-16-rightX);
    const midY=Math.max(minTop, Math.min(maxTop, (holeBox.top+holeBox.bottom-capH)/2));
    const side=(x,w,pri)=>{ const cw=Math.min(w, TOUR_CAP_MAX); push(midY, x+(w-cw)/2, cw, pri); };
    if(holeBox.left>vw*0.4) side(safeL+16, leftW, 2);
    if(holeBox.right<vw*0.6) side(rightX, rightW, 2);
    push(maxTop, left, width, 3);
    push(minTop, left, width, 4);
  }else{
    const hero=document.querySelector('#v-library .continue-hero');
    const hr=hero?hero.getBoundingClientRect():null;
    if(hr && hr.height>2){
      const below=hr.bottom+margin;
      if(below+capH<=vh-reservedBot) push(below, left, width, 0);
      const above=Math.min(hr.top-capH-margin, maxTop);
      if(above>=minTop && above+capH<=hr.top-8) push(above, left, width, 1);
    }
    push(Math.max(minTop, Math.min(maxTop, vh*0.34)), left, width, 2);
    push(maxTop, left, width, 3);
    push(minTop, left, width, 4);
  }
  cands.sort((a,b)=>a.pri-b.pri);
  let pick=cands.find(c=>c.w>=80 && !overlaps(c.top,c.left,c.w));
  if(!pick){
    const blocks=obs.slice();
    if(holeBox) blocks.push(holeBox);
    blocks.push({top:0, bottom:minTop, left:0, right:vw});
    blocks.push({top:vh-reservedBot, bottom:vh, left:0, right:vw});
    const ys=[minTop, vh-reservedBot, ...blocks.flatMap(b=>[b.top,b.bottom])].filter(y=>isFinite(y)).sort((a,b)=>a-b);
    let best=null, bestH=-1;
    for(let i=0;i<ys.length-1;i++){
      const gap=ys[i+1]-ys[i];
      if(gap>bestH){ bestH=gap; best={t:ys[i], b:ys[i+1]}; }
    }
    if(best){
      const top=Math.max(minTop, Math.min(maxTop, best.t+Math.max(0,(best.b-best.t-capH)/2)));
      pick={top, left, w:width};
    }else pick=cands[0]||{top:Math.max(minTop, maxTop), left, w:width};
  }
  let top=Math.max(8, pick.top);
  cap.style.top=top+'px';
  cap.style.left=Math.max(12, pick.left)+'px';
  cap.style.width=Math.min(pick.w, vw-pick.left-safeR-12)+'px';
  /* Re-measure and push the card clear of the spotlight if it still overlaps. */
  const capH2=Math.max(capH, cap.offsetHeight||capH);
  if(holeBox){
    const r=()=>stillRect(cap);
    const hits=()=>{
      const a=r();
      return !(a.bottom<=holeBox.top-8 || a.top>=holeBox.bottom+8 || a.right<=holeBox.left-8 || a.left>=holeBox.right-8);
    };
    if(hits()){
      const below=holeBox.bottom+8;
      const above=holeBox.top-capH2-8;
      if(below+capH2<=vh-reservedBot+8) cap.style.top=below+'px';
      else if(above>=safeTop+4) cap.style.top=Math.max(8, above)+'px';
    }
    if(hits()){
      /* last resort: shrink the spotlight to leave the caption band free */
      const hole=$('#tourHole');
      const a=r();
      if(hole && !hole.hidden){
        if(a.bottom<=(holeBox.top+holeBox.bottom)/2){
          const nt=Math.max(holeBox.top, a.bottom+8);
          if(nt<holeBox.bottom-24){ hole.style.top=nt+'px'; hole.style.height=(holeBox.bottom-nt)+'px'; }
        }else{
          const nb=Math.min(holeBox.bottom, a.top-8);
          if(nb>holeBox.top+24){ hole.style.height=(nb-holeBox.top)+'px'; }
        }
      }
    }
  }
}

function tourSpot(el, pad){
  const hole=$('#tourHole');
  if(!hole) return null;
  if(!el){ hole.hidden=true; hole.style.width=0; tourPlaceCaption(null); return null; }
  const r=el.getBoundingClientRect();
  const p=pad==null?10:pad;
  let x=Math.max(4, r.left-p), y=Math.max(4, r.top-p);
  let w=Math.min(innerWidth-x-4, r.width+p*2), h=Math.min(innerHeight-y-4, r.height+p*2);
  hole.hidden=false;
  hole.style.left=x+'px'; hole.style.top=y+'px'; hole.style.width=w+'px'; hole.style.height=h+'px';
  const box={left:x, top:y, right:x+w, bottom:y+h, width:w, height:h};
  /* On a short viewport, shrink a tall spotlight so a caption band stays free. */
  const cap=$('#tourCaption');
  const capH=(cap?Math.max(40, cap.offsetHeight||56):56)+16;
  const skip=$('#tourSkip');
  const next=$('#tourNext'), start=$('#tourStart');
  const foot=(!start||start.hidden)?next:start;
  const root=getComputedStyle(document.documentElement);
  const safeTop=parseFloat(root.getPropertyValue('--sat'))||0;
  const safeBot=parseFloat(root.getPropertyValue('--sab'))||0;
  const topLimit=Math.max(safeTop+8, skip&&!skip.hidden?skip.getBoundingClientRect().bottom+8:safeTop+48)+4;
  let botLimit=innerHeight-safeBot-12;
  if(foot&&!foot.hidden) botLimit=Math.min(botLimit, foot.getBoundingClientRect().top-12);
  const dots=$('#tourDots');
  if(dots&&!dots.hidden) botLimit=Math.min(botLimit, dots.getBoundingClientRect().top-10);
  const roomAbove=box.top-topLimit;
  const roomBelow=botLimit-box.bottom;
  if(roomAbove<capH && roomBelow<capH){
    const mid=(box.top+box.bottom)/2;
    if(mid>innerHeight*0.5){
      if(topLimit+capH < box.bottom-36){ box.top=topLimit+capH; box.height=box.bottom-box.top; }
    }else{
      if(botLimit-capH > box.top+36){ box.bottom=botLimit-capH; box.height=box.bottom-box.top; }
    }
    hole.style.top=box.top+'px';
    hole.style.height=box.height+'px';
  }
  tourPlaceCaption(box);
  return box;
}

function tourSay(text){
  const cap=$('#tourCaption'); if(!cap) return;
  const main=$('#tourCaptionText');
  if(main) main.textContent=text||'';
  else cap.textContent=text||'';
  cap.classList.remove('st-in'); void cap.offsetWidth; cap.classList.add('st-in'); /* the card enters in the app's Style */
}

function tourSetDots(n){
  const box=$('#tourDots'); if(!box) return;
  box.innerHTML=Array.from({length:TOUR_DOTS},(_,i)=>`<span class="tour-dot${i===n?' on':''}${i<n?' done':''}"></span>`).join('');
}

function tourShowChrome(nextLabel, end){
  const next=$('#tourNext'), start=$('#tourStart');
  if(end){
    if(next) next.hidden=true;
    if(start) start.hidden=false;
  }else{
    if(next){ next.hidden=false; next.textContent=nextLabel||'Next'; }
    if(start) start.hidden=true;
  }
}

function tourEnsureHero(){
  let hero=document.querySelector('#v-library .continue-hero');
  if(hero) return hero;
  const sm=typeof LIB!=='undefined' && LIB.find(m=>m.kind==='sample');
  const list=$('#docList');
  if(!sm || !list || typeof heroCard!=='function') return null;
  const wrap=document.createElement('div');
  wrap.innerHTML=heroCard(sm);
  const el=wrap.firstElementChild;
  if(!el) return null;
  el.setAttribute('data-tour-hero','1');
  list.insertAdjacentElement('afterbegin', el);
  TOUR.tmpHero=el;
  list.querySelectorAll('.doc[data-open="'+sm.id+'"]:not(.continue-hero)').forEach(c=>c.setAttribute('data-tour-hide','1'));
  return el;
}

function tourClearTmpHero(){
  const el=TOUR.tmpHero || document.querySelector('#v-library [data-tour-hero]');
  if(el && el.parentNode) el.parentNode.removeChild(el);
  TOUR.tmpHero=null;
  document.querySelectorAll('#docList [data-tour-hide]').forEach(c=>c.removeAttribute('data-tour-hide'));
}

function tourFingerAt(x, y, on){
  const f=$('#tourFinger'); if(!f) return;
  if(!on){ f.hidden=true; return; }
  f.hidden=false;
  f.style.left=x+'px'; f.style.top=y+'px';
}

function tourLockApp(on){
  const app=$('#app');
  if(app){ if(on) app.setAttribute('inert',''); else app.removeAttribute('inert'); }
  const ver=$('#htmlVer'); if(ver) ver.hidden=!!on;
  const badge=$('#verBadge'); if(badge) badge.hidden=!!on;
}

function tourTrap(e){
  if(!TOUR.on) return;
  const root=tourRoot(); if(!root || root.hidden) return;
  if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); tourEnd(true); return; }
  if(e.key!=='Tab') return;
  const els=[...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el=>!el.hidden && !el.disabled && el.tabIndex>=0 && !el.closest('[hidden]') && el.getAttribute('aria-hidden')!=='true');
  if(!els.length) return;
  const first=els[0], last=els[els.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
}

function tourBindSwipe(root){
  const mark=s=>{ if(!s) return; s.dragged=true; TOUR.dragged=true; };
  const finish=(x,y,s)=>{
    TOUR.swiping=null;
    if(!TOUR.on || !s) return;
    const dx=x-s.x, dy=y-s.y;
    if(s.dragged || Math.hypot(dx,dy)>12) TOUR.dragged=true;
    if(dy>72 && dy>Math.abs(dx)*1.2) tourEnd(true);
  };
  root.addEventListener('pointerdown',e=>{
    if(!TOUR.on) return;
    if(e.pointerType!=='touch' && e.button!=null && e.button!==0) return;
    TOUR.swiping={x:e.clientX, y:e.clientY, id:e.pointerId, dragged:false};
    TOUR.dragged=false;
  });
  root.addEventListener('pointermove',e=>{
    const s=TOUR.swiping; if(!s || s.id!==e.pointerId) return;
    if(Math.hypot(e.clientX-s.x, e.clientY-s.y)>12) mark(s);
  });
  root.addEventListener('pointerup',e=>{
    const s=TOUR.swiping; if(!s || s.id!==e.pointerId) return;
    finish(e.clientX, e.clientY, s);
  });
  root.addEventListener('pointercancel',e=>{
    const s=TOUR.swiping; if(!s || s.id!==e.pointerId) return;
    if(s.dragged) TOUR.dragged=true;
    TOUR.swiping=null;
  });
  root.addEventListener('touchstart',e=>{
    if(!TOUR.on || !e.touches[0]) return;
    TOUR.swiping={x:e.touches[0].clientX, y:e.touches[0].clientY, dragged:false, touch:true};
    TOUR.dragged=false;
  },{passive:true});
  root.addEventListener('touchmove',e=>{
    const s=TOUR.swiping; if(!s || !s.touch || !e.touches[0]) return;
    if(Math.hypot(e.touches[0].clientX-s.x, e.touches[0].clientY-s.y)>12) mark(s);
  },{passive:true});
  root.addEventListener('touchend',e=>{
    const s=TOUR.swiping; if(!s || !s.touch) return;
    const t=e.changedTouches && e.changedTouches[0];
    if(!t){ TOUR.swiping=null; return; }
    finish(t.clientX, t.clientY, s);
  },{passive:true});
}

function tourChromeHover(el){
  return !!(el && el.closest && el.closest('#tourCaption,#tourNext,#tourStart'));
}
function tourAutoPause(){
  if(!TOUR.on || TOUR.autoPaused || TOUR.reduced || TOUR.step>=6) return;
  TOUR.autoPaused=true;
  if(TOUR.autoAt!=null) TOUR.autoRemain=Math.max(0, (TOUR.autoRemain||0)-(performance.now()-TOUR.autoAt));
  if(TOUR.autoTimer){ clearTimeout(TOUR.autoTimer); TOUR.timers=(TOUR.timers||[]).filter(t=>t!==TOUR.autoTimer); TOUR.autoTimer=null; }
}
function tourAutoResume(){
  if(!TOUR.on || !TOUR.autoPaused || TOUR.reduced || TOUR.step>=6) return;
  TOUR.autoPaused=false;
  tourScheduleAuto(TOUR.token, TOUR.step);
}
function tourScheduleAuto(tok, n){
  if(TOUR.reduced || n>=6 || !TOUR.on) return;
  if(TOUR.autoTimer){ clearTimeout(TOUR.autoTimer); TOUR.timers=(TOUR.timers||[]).filter(t=>t!==TOUR.autoTimer); TOUR.autoTimer=null; }
  if(TOUR.autoRemain==null) TOUR.autoRemain=TOUR_AUTO_MS;
  TOUR.autoAt=performance.now();
  const wait=TOUR.autoRemain;
  const t=setTimeout(()=>{ TOUR.autoTimer=null; if(TOUR.token===tok && TOUR.on && !TOUR.autoPaused && TOUR.step<6) tourAdvance(); }, wait);
  TOUR.autoTimer=t;
  TOUR.timers.push(t);
}

function tourDemo(){ return $('#tourDemo'); }

function tourDemoPages(show){
  const d=tourDemo(); if(!d) return;
  d.hidden=!show;
  if(!show){ d.removeAttribute('data-mode'); return; }
  d.setAttribute('data-mode','pages');
  d.classList.remove('chrome-off','speed-on');
  const word=$('#tourSpeedWord'); if(word) word.hidden=true;
  const peek=$('#tourPeek'); if(peek) peek.hidden=true;
  const sel=$('#tourSel'); if(sel) sel.hidden=true;
  const moment=$('#tourMoment'); if(moment) moment.hidden=true;
  const pill=$('#tourPill'); if(pill) pill.hidden=true;
  const tourRoot=$('#tour'); if(tourRoot) tourRoot.classList.remove('tour-listen');
  const td=$('#tourDots'); if(td) td.style.bottom='';
  const p2=$('#tourPageB'); if(p2) p2.hidden=true;
  const p1=$('#tourPageA'); if(p1) p1.hidden=false;
  const hold=$('#tourHoldWord'); if(hold) hold.classList.remove('sel');
}

function tourFocusSkip(){
  const skip=$('#tourSkip');
  if(skip) setTimeout(()=>skip.focus(), 30);
}

async function tourRunStep(n){
  const tok=++TOUR.token;
  tourClearTimers();
  TOUR.step=n;
  tourSetDots(Math.min(n, TOUR_DOTS-1));
  const root=tourRoot();
  if(root) root.setAttribute('data-step', String(n));
  const finger=$('#tourFinger'); if(finger){ finger.hidden=true; finger.classList.remove('tap'); }
  document.querySelectorAll('#tour .tour-pulse, #tour .tour-pulse-once, #tourTocIcon, #tourSel .tour-more').forEach(el=>el.classList.remove('tour-pulse','tour-pulse-once'));
  const demo=tourDemo(); if(demo) demo.hidden=true;
  tourShowChrome('Next', false);
  $('#v-library') && $('#v-library').classList.remove('tour-grid-dim');

  if(n===0){
    try{ if(typeof showView==='function') showView('library'); }catch(e){}
    await tourAfter(40);
    if(tok!==TOUR.token) return;
    const hero=tourEnsureHero();
    tourSay('Pick up exactly where you left off.');
    await tourAfter(40);
    if(tok!==TOUR.token) return;
    tourSpot(hero, 10);
    if(hero && document.querySelector('#docList .doc:not(.continue-hero)'))
      $('#v-library').classList.add('tour-grid-dim');
    if(!TOUR.reduced && hero) hero.classList.add('tour-pulse');
  } else {
    const hero=document.querySelector('#v-library .continue-hero');
    if(hero) hero.classList.remove('tour-pulse');
    $('#v-library') && $('#v-library').classList.remove('tour-grid-dim');
  }

  if(n===1){
    tourDemoPages(true);
    tourSay('Tap the edges to turn.');
    const edge=$('#tourEdgeR')||$('#tourPageA');
    const r=(edge||tourDemo()).getBoundingClientRect();
    tourSpot(edge, 6);
    if(!TOUR.reduced){
      tourFingerAt(r.left+r.width*0.5, r.top+r.height*0.55, true);
      const f=$('#tourFinger'); if(f) f.classList.add('tap');
      const ok=await tourAfter(TOUR_ANIM_MS);
      if(!ok || tok!==TOUR.token) return;
      const a=$('#tourPageA'), b=$('#tourPageB'), top=$('#tourDemoTop');
      if(a) a.classList.add('turn');
      if(b){ b.hidden=false; b.classList.add('in'); }
      if(top) top.classList.add('away');
      await tourAfter(TOUR_ANIM_MS);
      if(tok!==TOUR.token) return;
    }else{
      const a=$('#tourPageA'), b=$('#tourPageB'), top=$('#tourDemoTop');
      if(a) a.hidden=true;
      if(b) b.hidden=false;
      if(top) top.classList.add('away');
    }
    tourSay('Tap the middle for controls.');
    const mid=$('#tourMid');
    tourSpot(mid, 8);
    if(!TOUR.reduced && mid) mid.classList.add('tour-pulse-once');
    const top=$('#tourDemoTop');
    if(top) top.classList.remove('away');
  }

  if(n===2){
    tourDemoPages(true);
    const top=$('#tourDemoTop'); if(top) top.classList.remove('away');
    const ico=$('#tourTocIcon');
    if(!TOUR.reduced && ico) ico.classList.add('tour-pulse');
    const peek=$('#tourPeek');
    if(peek){ peek.hidden=false; peek.classList.toggle('static', TOUR.reduced); }
    await tourAfter(TOUR.reduced?40:60);
    if(tok!==TOUR.token) return;
    tourSay('Search and notes live here.');
    tourSpot(ico, 10);
  }

  if(n===3){
    tourDemoPages(true);
    tourSay('Hold a word to highlight.');
    const w=$('#tourHoldWord');
    tourSpot(w, 8);
    if(w) w.classList.add('sel');
    const sel=$('#tourSel');
    if(sel){
      sel.hidden=false;
      const dots=[...sel.querySelectorAll('.dot')];
      const more=sel.querySelector('.tour-more');
      dots.forEach(d=>d.classList.remove('pop'));
      if(!TOUR.reduced){
        for(let i=0;i<dots.length;i++){
          const ok=await tourAfter(i===0?200:180);
          if(!ok || tok!==TOUR.token) return;
          dots[i].classList.add('pop');
        }
        if(more) more.classList.add('tour-pulse');
        await tourAfter(TOUR_ANIM_MS);
        if(tok!==TOUR.token) return;
      }else{
        dots.forEach(d=>d.classList.add('pop'));
      }
    }
    const moment=$('#tourMoment');
    if(moment){ moment.hidden=false; moment.classList.toggle('static', TOUR.reduced); }
    await tourAfter(TOUR.reduced?40:40);
    if(tok!==TOUR.token) return;
    tourSpot(w, 8);
  }

  if(n===4){
    tourDemoPages(true);
    const d=tourDemo(); if(d){ d.setAttribute('data-mode','speed'); d.classList.add('speed-on'); }
    const word=$('#tourSpeedWord'); if(word) word.hidden=false;
    const chrome=$('#tourDemoTop');
    tourSay('Speed fades everything but the word.');
    tourSpot(word, 16);
    if(!TOUR.reduced && word) word.classList.add('flash');
    await tourAfter(TOUR.reduced?200:TOUR_ANIM_MS);
    if(tok!==TOUR.token) return;
    if(chrome) chrome.classList.add('away');
    if(d) d.classList.add('chrome-off');
    await tourAfter(TOUR.reduced?200:700);
    if(tok!==TOUR.token) return;
    /* a tap shows chrome return — we play this as the beat, not a real user tap */
    if(chrome) chrome.classList.remove('away');
    if(d) d.classList.remove('chrome-off');
  }

  if(n===5){
    /* Speed has no pill: leave the Speed demo and show a Pages spread before the pill appears. */
    tourDemoPages(true);
    document.querySelectorAll('#tourDemo .tour-pulse, #tourTocIcon.tour-pulse').forEach(el=>el.classList.remove('tour-pulse'));
    const d=tourDemo();
    if(d){ d.setAttribute('data-mode','pages'); d.classList.remove('speed-on','chrome-off'); }
    const word=$('#tourSpeedWord'); if(word){ word.hidden=true; word.classList.remove('flash'); }
    const chrome=$('#tourDemoTop'); if(chrome) chrome.classList.remove('away');
    const a=$('#tourPageA'), b=$('#tourPageB');
    if(a){ a.hidden=false; a.classList.remove('turn'); }
    if(b){ b.hidden=true; b.classList.remove('in'); }
    const root=$('#tour'); if(root) root.classList.add('tour-listen');
    const pill=$('#tourPill');
    tourSay('Tap to listen hands-free.');
    if(pill){
      pill.hidden=false;
      /* match live #ttsBar: bottom = 12px + footer height (includes safe area). Never open TTS. */
      const h=tourMeasureRfoot();
      const root=$('#tour');
      if(root) root.style.setProperty('--rfoot-h', h+'px');
      pill.style.bottom='calc(12px + '+h+'px)';
      TOUR.pillAt=h;
      const dots=$('#tourDots');
      if(dots) dots.style.bottom='';
      await tourAfter(TOUR.reduced?40:30);
      if(tok!==TOUR.token) return;
      tourSpot(pill, 14);
      if(!TOUR.reduced) pill.classList.add('glide','breathe');
      else pill.classList.add('static');
    }
  }

  if(n>=6){
    tourDemoPages(false);
    const tourRoot=$('#tour'); if(tourRoot) tourRoot.classList.remove('tour-listen');
    const td=$('#tourDots'); if(td) td.style.bottom='';
    tourSay('That’s it.');
    const sub=$('#tourSub'); if(sub){ sub.hidden=false; sub.textContent='Replay anytime: Settings → Help.'; }
    tourShowChrome('', true);
    /* six dots for the six steps; the closing card is not a step, so the dots step aside */
    $('#tourDots') && ($('#tourDots').hidden=true);
    tourSpot(null);
    tourFocusSkip();
    return;
  }else{
    const sub=$('#tourSub'); if(sub) sub.hidden=true;
    $('#tourDots') && ($('#tourDots').hidden=false);
  }

  tourFocusSkip();
  TOUR.autoRemain=TOUR_AUTO_MS;
  TOUR.autoPaused=false;
  if(!TOUR.reduced && n<6){
    const over=document.querySelector('#tourCaption:hover, #tourNext:hover, #tourStart:hover');
    if(over){ TOUR.autoPaused=true; }
    else tourScheduleAuto(tok, n);
  }
}

function tourAdvance(){
  if(!TOUR.on) return;
  tourClearTimers();
  const n=TOUR.step+1;
  if(n>6){ tourEnd(false); return; }
  tourRunStep(n);
}

function tourEnd(skipped){
  if(!TOUR.on) return;
  TOUR.on=false;
  tourClearTimers();
  TOUR.token++;
  tourDoneSet();
  const hero=document.querySelector('#v-library .continue-hero');
  if(hero) hero.classList.remove('tour-pulse');
  $('#v-library') && $('#v-library').classList.remove('tour-grid-dim');
  tourClearTmpHero();
  const root=tourRoot();
  if(root){ root.hidden=true; root.removeAttribute('data-step'); }
  tourDemoPages(false);
  tourLockApp(false);
  document.removeEventListener('keydown', tourTrap, true);
  try{ if(typeof showView==='function') showView('library'); }catch(e){}
  if(TOUR.lastFocus && typeof TOUR.lastFocus.focus==='function'){
    try{ TOUR.lastFocus.focus(); }catch(e){}
  }
  TOUR.lastFocus=null;
}

function startTour(opts){
  const replay=!!(opts&&opts.replay);
  if(!replay && tourIsDone()) return false;
  const root=tourRoot(); if(!root) return false;
  try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
  try{ if(R&&R.meta&&typeof closeReader==='function') closeReader(true); }catch(e){}
  TOUR.on=true; TOUR.replay=replay; TOUR.reduced=tourReduced(); TOUR.step=0; TOUR.token++;
  TOUR.autoRemain=TOUR_AUTO_MS; TOUR.autoPaused=false; TOUR.autoTimer=null; TOUR.dragged=false;
  tourClearTimers();
  TOUR.lastFocus=document.activeElement;
  if(typeof showView==='function') showView('library');
  root.hidden=false;
  root.classList.toggle('reduced', TOUR.reduced);
  tourLockApp(true);
  document.addEventListener('keydown', tourTrap, true);
  tourRunStep(0);
  return true;
}

function maybeStartTour(){
  if(shouldAutoTour()) return startTour({replay:false});
  return false;
}

(function bindTour(){
  const ready=()=>{
    const root=tourRoot(); if(!root || root._bound) return;
    root._bound=1;
    tourBindSwipe(root);
    /* the demo pill follows the live pill when the phone turns: re-measure the footer and move it (and its spotlight) */
    window.addEventListener('resize',()=>{
      if(!TOUR.on || TOUR.step!==5) return;
      const pill=$('#tourPill'); if(!pill || pill.hidden) return;
      const h=tourMeasureRfoot(); if(h===TOUR.pillAt) return;
      TOUR.pillAt=h; root.style.setProperty('--rfoot-h', h+'px'); pill.style.bottom='calc(12px + '+h+'px)';
      tourSpot(pill, 14);
    });
    root.addEventListener('pointerover',e=>{ if(tourChromeHover(e.target)) tourAutoPause(); });
    root.addEventListener('pointerout',e=>{ if(tourChromeHover(e.target) && !tourChromeHover(e.relatedTarget)) tourAutoResume(); });
    root.addEventListener('focusin',e=>{ if(e.target && e.target.closest && e.target.closest('#tourNext,#tourStart,#tourCaption')) tourAutoPause(); });
    root.addEventListener('focusout',e=>{
      const to=e.relatedTarget;
      if(e.target && e.target.closest && e.target.closest('#tourNext,#tourStart,#tourCaption') && !(to && to.closest && to.closest('#tourNext,#tourStart,#tourCaption'))) tourAutoResume();
    });
    root.addEventListener('click',e=>{
      if(!TOUR.on) return;
      const dragged=!!TOUR.dragged; TOUR.dragged=false;
      if(e.target.closest('#tourSkip')){ e.preventDefault(); tourEnd(true); return; }
      if(e.target.closest('#tourStart')){ e.preventDefault(); tourEnd(false); return; }
      if(e.target.closest('#tourNext')){ e.preventDefault(); if(!dragged) tourAdvance(); return; }
      /* only Next advances: a tap or a drag anywhere else (the scrim, the card, the demo) does nothing */
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
