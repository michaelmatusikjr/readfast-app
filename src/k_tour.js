/* ---------- first-run tour (demo layer; never writes library, notes, words or settings) ---------- */
const TOUR_DOTS=6;
const TOUR_AUTO_MS=4000;
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
function tourClearTimers(){ (TOUR.timers||[]).forEach(t=>clearTimeout(t)); TOUR.timers=[]; }
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
  let h=vr?parseFloat(getComputedStyle(vr).getPropertyValue('--rfoot-h')):0;
  if(h) return Math.round(h);
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

function tourObstacles(){
  const ids=['tourSkip','tourNext','tourStart','tourSub','tourDots','tourPeek','tourMoment','tourPill','tourSel','tourFinger'];
  const out=[];
  for(const id of ids){
    const el=$('#'+id);
    if(!el || el.hidden || (el.closest && el.closest('[hidden]'))) continue;
    const r=el.getBoundingClientRect();
    if(r.width>2 && r.height>2) out.push({left:r.left, top:r.top, right:r.right, bottom:r.bottom});
  }
  return out;
}

function tourPlaceCaption(hole){
  const cap=$('#tourCaption'), next=$('#tourNext'), start=$('#tourStart'), skip=$('#tourSkip');
  if(!cap) return;
  const safeTop=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat'))||0;
  const safeBot=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab'))||0;
  const safeL=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sal'))||0;
  const safeR=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sar'))||0;
  const foot=(!start||start.hidden)?next:start;
  const nextH=(foot && !foot.hidden)?foot.getBoundingClientRect().height+16:0;
  const skipBox=skip?skip.getBoundingClientRect():{bottom:safeTop+56,left:innerWidth};
  const vw=innerWidth, vh=innerHeight;
  const capH=Math.max(48, cap.offsetHeight||56);
  const margin=12;
  const obs=tourObstacles();
  const overlaps=(top,left,w)=>{
    const a={left, top, right:left+w, bottom:top+capH};
    const hit=r=>!(a.bottom<r.top-8 || a.top>r.bottom+8 || a.right<r.left-8 || a.left>r.right-8);
    if(hole && hit(hole)) return true;
    return obs.some(hit);
  };
  const cands=[];
  const fullW=vw-safeL-safeR-40;
  let reservedBot=safeBot+nextH+16;
  for(const id of ['tourSub','tourDots','tourMoment','tourPill']){
    const el=$('#'+id);
    if(!el || el.hidden) continue;
    const r=el.getBoundingClientRect();
    if(r.height>2) reservedBot=Math.max(reservedBot, vh-r.top+10);
  }
  const bottomY=vh-reservedBot-capH;
  const topY=Math.max(safeTop+skipBox.bottom+8, safeTop+56);
  cands.push({top:bottomY,left:safeL+20,w:fullW});
  cands.push({top:topY,left:safeL+20,w:fullW});
  /* end card and empty-hole steps prefer a mid-page band */
  if(!hole) cands.unshift({top:Math.max(topY, Math.min(bottomY, vh*0.34)), left:safeL+20, w:fullW});
  if(hole){
    const leftW=Math.max(120, hole.left-safeL-32);
    const rightX=hole.right+12, rightW=Math.max(120, vw-safeR-16-rightX);
    if(hole.left>vw*0.4) cands.unshift({top:Math.max(topY, Math.min(bottomY,(hole.top+hole.bottom-capH)/2)), left:safeL+16, w:leftW});
    if(hole.right<vw*0.6) cands.unshift({top:Math.max(topY, Math.min(bottomY,(hole.top+hole.bottom-capH)/2)), left:rightX, w:rightW});
    if(hole.top-topY>capH+margin) cands.unshift({top:Math.max(topY, hole.top-capH-margin), left:safeL+20, w:fullW});
    if(bottomY-hole.bottom>margin) cands.unshift({top:Math.min(bottomY, hole.bottom+margin), left:safeL+20, w:fullW});
  }
  let pick=cands.find(c=>c.w>=80 && c.top>=safeTop+8 && c.top+capH<=vh-reservedBot+8 && !overlaps(c.top,c.left,c.w)) || cands[0] || cands[cands.length-1];
  cap.style.top=Math.max(8, pick.top)+'px';
  cap.style.left=Math.max(12, pick.left)+'px';
  cap.style.right='auto';
  cap.style.width=Math.min(pick.w, vw-pick.left-safeR-12)+'px';
  cap.style.bottom='auto';
}

function tourSpot(el, pad){
  const hole=$('#tourHole');
  if(!hole) return null;
  if(!el){ hole.hidden=true; hole.style.width=0; return null; }
  const r=el.getBoundingClientRect();
  const p=pad==null?10:pad;
  const x=Math.max(4, r.left-p), y=Math.max(4, r.top-p);
  const w=Math.min(innerWidth-x-4, r.width+p*2), h=Math.min(innerHeight-y-4, r.height+p*2);
  hole.hidden=false;
  hole.style.left=x+'px'; hole.style.top=y+'px'; hole.style.width=w+'px'; hole.style.height=h+'px';
  const box={left:x, top:y, right:x+w, bottom:y+h, width:w, height:h};
  tourPlaceCaption(box);
  return box;
}

function tourSay(text){
  const cap=$('#tourCaption'); if(!cap) return;
  cap.textContent=text||'';
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
  root.addEventListener('touchstart',e=>{
    if(!TOUR.on || !e.touches[0]) return;
    TOUR.swiping={x:e.touches[0].clientX, y:e.touches[0].clientY};
  },{passive:true});
  root.addEventListener('touchend',e=>{
    if(!TOUR.on || !TOUR.swiping) return;
    const t=e.changedTouches && e.changedTouches[0];
    const s=TOUR.swiping; TOUR.swiping=null;
    if(!t) return;
    const dx=t.clientX-s.x, dy=t.clientY-s.y;
    if(dy>72 && dy>Math.abs(dx)*1.2) tourEnd(true);
  },{passive:true});
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
  document.querySelectorAll('#tour .tour-pulse, #tourTocIcon, #tourSel .tour-more').forEach(el=>el.classList.remove('tour-pulse','tour-pulse-once'));
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
    /* keep the caption under the hero, above Next, so it never sits on the card */
    const cap=$('#tourCaption'), hole=$('#tourHole');
    if(cap && hole && !hole.hidden){
      const next=$('#tourNext');
      const safeBot=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab'))||0;
      const nextH=(next && !next.hidden)?next.getBoundingClientRect().height+16:0;
      const capH=cap.offsetHeight||72;
      const bottomY=innerHeight-safeBot-nextH-16-capH;
      const hr=hole.getBoundingClientRect();
      if(bottomY>=hr.bottom+8){ cap.style.top=bottomY+'px'; cap.style.left=''; cap.style.right=''; cap.style.width=''; cap.style.paddingLeft=''; }
    }
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
      const dots=$('#tourDots');
      if(dots) dots.style.bottom=(12+h+62+18)+'px';
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
    tourSpot(null);
    tourSay('That’s it.');
    const sub=$('#tourSub'); if(sub){ sub.hidden=false; sub.textContent='Replay anytime: Settings → Help.'; }
    tourShowChrome('', true);
    tourSetDots(TOUR_DOTS-1);
    $('#tourDots') && $('#tourDots').classList.add('all-on');
    tourPlaceCaption(null);
    const cap=$('#tourCaption'), subEl=$('#tourSub');
    if(cap && subEl && !subEl.hidden){
      const r=subEl.getBoundingClientRect();
      cap.style.top=Math.max(80, r.top-(cap.offsetHeight||48)-10)+'px';
      cap.style.left='20px';
      cap.style.width=(innerWidth-40)+'px';
    }
    tourFocusSkip();
    return;
  }else{
    const sub=$('#tourSub'); if(sub) sub.hidden=true;
    $('#tourDots') && $('#tourDots').classList.remove('all-on');
  }

  tourFocusSkip();
  if(!TOUR.reduced && n<6){
    const t=setTimeout(()=>{ if(TOUR.token===tok && TOUR.on) tourAdvance(); }, TOUR_AUTO_MS);
    TOUR.timers.push(t);
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
    root.addEventListener('click',e=>{
      if(!TOUR.on) return;
      if(e.target.closest('#tourSkip')){ e.preventDefault(); tourEnd(true); return; }
      if(e.target.closest('#tourStart')){ e.preventDefault(); tourEnd(false); return; }
      if(e.target.closest('#tourNext')){ e.preventDefault(); tourAdvance(); return; }
      /* a tap on the scrim or demo advances; controls already handled */
      if(e.target.closest('#tourSkip,#tourNext,#tourStart,#tourCaption,#tourDots')) return;
      if(TOUR.step>=6) return;
      tourAdvance();
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
