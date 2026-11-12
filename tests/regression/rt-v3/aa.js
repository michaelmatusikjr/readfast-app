const H=require('../rt-modes/h.js');
const fp=()=>{ const cs=(e,ps)=>{ if(!e) return null; const c=getComputedStyle(e); return ps.map(p=>c.getPropertyValue(p)).join('|'); };
  const host=R.mode==='pages'?pgFlow:R.mode==='scroll'?scFlow:null; const p=host&&host.querySelector('p'); const w=host&&host.querySelector('p w');
  return JSON.stringify({ root:document.documentElement.getAttribute('style'), th:document.documentElement.dataset.theme, rc:$('#v-reader').className, mode:R.mode,
   host:cs(host,['font-family','font-size','line-height','text-align','hyphens','font-weight','width','column-count','padding-left']), p:cs(p,['text-indent','margin-top']), pm:host&&[...host.querySelectorAll('p')].slice(0,3).map(x=>cs(x,['margin-top','text-indent'])),
   ws:host&&host.querySelectorAll('b.ws').length, pages:P.pages, shade:$('#shade').getAttribute('style'), bg:cs($('#v-reader'),['background-color','color']),
   word:cs($('#word'),['font-family','font-size','font-weight']), wp:cs($('#wp'),['color']), wtxt:$('#word').textContent, ctx:cs($('#context'),['display','visibility']), ctxh:$('#context').hidden, as:$('#asBar').hidden, wpml:$('#wpmLabel').textContent, asl:$('#asLabel').textContent }); };
(async()=>{ const b=await H.launch(); const pg=await H.page(b,{});
  const id=await H.importBook(pg,H.RICH); await pg.evaluate(id=>openDoc(id),id); await H.sleep(900);
  for(const mode of ['pages','scroll','speed']){
    await pg.evaluate(m=>switchMode(m),mode); await H.sleep(600); await pg.evaluate(()=>goTo(100,true)); await H.sleep(400);
    await pg.evaluate(()=>{ if(R.mode==='scroll'){ S.autoScroll=true; } S.nightAuto=true; S.ramp=true; S.multi=true; saveSettings(); openPanel(); }); await H.sleep(300);
    const ctrls=await pg.evaluate(()=>{ const out=[]; const body=$('#sheet .sheet-body');
      body.querySelectorAll('[data-set]').forEach(e=>{ const k=e.dataset.set, t=e.dataset.type; if(t==='seg') e.querySelectorAll('button[data-v]').forEach(x=>out.push({k,t,v:x.dataset.v})); else out.push({k,t,it:e.type}); });
      body.querySelectorAll('[data-step]').forEach(e=>out.push({k:e.dataset.step,t:'step',d:e.dataset.d})); return out; });
    console.log('==',mode,'controls',[...new Set(ctrls.map(c=>c.k))].join(','));
    for(const c of ctrls){ if(c.k==='mode') continue;
      const before=await pg.evaluate(fp); const s0=await pg.evaluate(k=>S[k],c.k);
      const ok=await pg.evaluate(c=>{ const body=$('#sheet .sheet-body'); let e;
        if(c.t==='seg'){ e=body.querySelector(`[data-set="${c.k}"][data-type="seg"] button[data-v="${CSS.escape(c.v)}"]`); if(!e) return 'missing'; if(e.getAttribute('aria-pressed')==='true') return 'already'; e.click(); return 'ok'; }
        if(c.t==='step'){ e=body.querySelector(`[data-step="${c.k}"][data-d="${c.d}"]`); e.click(); return 'ok'; }
        e=body.querySelector(`[data-set="${c.k}"][data-type="${c.t}"]`); if(!e) return 'missing';
        if(c.t==='toggle'){ e.click(); return 'ok'; }
        if(c.t==='range'){ const mid=(+e.min+ +e.max)/2; e.value= (+e.value>mid)? e.min : e.max; e.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'; }
        if(c.t==='text'){ if(e.type==='time'){ e.value=e.value==='00:00'?'01:00':'00:00'; } else if(e.type==='color'){ e.value='#00aa00'; e.dispatchEvent(new Event('input',{bubbles:true})); } else if(e.tagName==='SELECT'){ if(e.options.length<2) return 'noopts'; e.selectedIndex=1; } e.dispatchEvent(new Event('change',{bubbles:true})); return 'ok'; }
        return 'unk'; },c);
      await H.sleep(450);
      const after=await pg.evaluate(fp); const s1=await pg.evaluate(k=>S[k],c.k); const ls=await pg.evaluate(k=>JSON.parse(localStorage.getItem('rf.settings'))[k],c.k);
      const flag=(ok==='ok' && before===after)?'  <-- NO VISIBLE CHANGE':''; const sv=(JSON.stringify(s1)!==JSON.stringify(ls))?'  <-- NOT SAVED':'';
      if(ok!=='ok'&&ok!=='already'||flag||sv||JSON.stringify(s0)===JSON.stringify(s1)&&ok==='ok') console.log(mode,c.k,c.v||c.d||'',ok,JSON.stringify(s0),'->',JSON.stringify(s1),flag,sv);
    }
    await pg.screenshot({path:`aa_${mode}_after.png`});
    const sBefore=await pg.evaluate(()=>JSON.stringify(S)); const fb=await pg.evaluate(()=>{closeSheet(); return 0;}); await H.sleep(300); const f1=await pg.evaluate(fp);
    await pg.screenshot({path:`aa_${mode}_closed.png`});
    await pg.reload(); await H.sleep(900); await pg.evaluate(id=>openDoc(id),id); await H.sleep(1200);
    const sAfter=await pg.evaluate(()=>JSON.stringify(S)); const f2=await pg.evaluate(fp);
    if(sBefore!==sAfter){ const a=JSON.parse(sBefore), bb=JSON.parse(sAfter); console.log(mode,'RELOAD S DIFF', Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(bb[k])).map(k=>k+':'+JSON.stringify(a[k])+'->'+JSON.stringify(bb[k]))); }
    if(f1!==f2){ const a=JSON.parse(f1), bb=JSON.parse(f2); console.log(mode,'RELOAD LOOK DIFF', Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(bb[k])).map(k=>k+': '+JSON.stringify(a[k])+' -> '+JSON.stringify(bb[k]))); }
    await pg.screenshot({path:`aa_${mode}_reload.png`});
    await pg.evaluate(()=>{ openPanel(); $('#sheet [data-act="resetlook"]').scrollIntoView(); }); await H.sleep(500); await pg.evaluate(()=>{ $('#sheet [data-act="resetlook"]').click(); }); await H.sleep(600); await pg.evaluate(()=>closeSheet());
  }
  console.log('errs',pg.errs); await b.close(); })().catch(e=>{console.error('FAIL',e);process.exit(1)});
