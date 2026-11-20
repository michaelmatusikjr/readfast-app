const __E=require('../env');
const { chromium } = require('playwright');
const EP=(__E.SCRATCH+'redteam-epub/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(__E.launch());
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(__E.URL); await sleep(1500);
  console.log('lib', await pg.evaluate(()=>[LIB.length, LIB.filter(m=>tagsOf(m).some(t=>/bible/i.test(t)) || /bible|king james|world english/i.test(m.title||'')).map(m=>m.title)]));
  for(const id of ['shelf-kjv','shelf-web']){
    const t0=Date.now(); await pg.evaluate(id=>openDoc(id), id); await sleep(500);
    console.log(id, Date.now()-t0, await pg.evaluate(()=>[R.n, R.meta.chapters.length, R.meta.chapters.filter(c=>!c.d).map(c=>c.t).join('|'), R.meta.chapters.slice(0,6).map(c=>c.d+':'+c.t).join(' / ')]));
    const ps=await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='Psalm 23'); return c&&c.i; });
    await pg.evaluate(i=>goTo(i,true), ps); await sleep(700);
    await pg.screenshot({path:id+'_ps23.png'});
    await pg.evaluate(()=>{ R.meta.pos=R.pos; closeReader(); }); await sleep(300);
  }
  await pg.evaluate(()=>showView('library')); await sleep(300);
  console.log('top', await pg.evaluate(()=>[...document.querySelectorAll('#docList > *')].slice(0,6).map(e=>e.classList.contains('continue-hero')?'## '+(e.querySelector('.t')||e).textContent:(e.classList.contains('grp')?'## '+e.textContent:(e.querySelector('.t')||e).textContent)).join(' | ')));
  console.log('bibles by tag', await pg.evaluate(()=>LIB.filter(m=>tagsOf(m).some(t=>/bible/i.test(t))).map(m=>m.title)));
  await pg.screenshot({path:__E.SCRATCH+'lib_reading.png'});
  await pg.evaluate(()=>{ clearFilters(); toggleFilter('st','reading',true); renderLibrary(); }); await sleep(200);
  console.log('reading filter', await pg.evaluate(()=>[...document.querySelectorAll('#docList .doc .t, #docList .continue-hero .t')].map(e=>e.textContent)));
  await pg.evaluate(()=>{ clearFilters(); toggleFilter('st','done',true); renderLibrary(); }); await sleep(200);
  console.log('done filter', await pg.evaluate(()=>[fCount(), document.querySelectorAll('#docList .doc').length, $('#docList').textContent.trim().slice(0,80)]));
  await pg.evaluate(()=>{ clearFilters(); toggleFilter('st','unread',true); renderLibrary(); }); await sleep(200);
  console.log('unread count', await pg.evaluate(()=>document.querySelectorAll('#docList .doc').length));
  await pg.evaluate(()=>{ clearFilters(); renderLibrary(); }); await sleep(200);
  console.log('pills after clear', await pg.evaluate(()=>[fCount(), $('#libPills').hidden, !!document.querySelector('#docList .continue-hero')]));
  await pg.reload(); await sleep(1200);
  console.log('after reload', await pg.evaluate(()=>[fCount(), LIBV.sort, LIB.length]));
  console.log('errors', errs); await b.close();
})();
