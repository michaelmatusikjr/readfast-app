const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  console.log('lib', await pg.evaluate(()=>[LIB.length, LIB.filter(m=>m.category==='Bible').map(m=>m.title)]));
  for(const id of ['shelf-kjv','shelf-web']){
    const t0=Date.now(); await pg.evaluate(id=>openDoc(id), id); await sleep(500);
    console.log(id, Date.now()-t0, await pg.evaluate(()=>[R.n, R.meta.chapters.length, R.meta.chapters.filter(c=>!c.d).map(c=>c.t).join('|'), R.meta.chapters.slice(0,6).map(c=>c.d+':'+c.t).join(' / ')]));
    const ps=await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='Psalm 23'); return c&&c.i; });
    await pg.evaluate(i=>goTo(i,true), ps); await sleep(700);
    await pg.screenshot({path:id+'_ps23.png'});
    await pg.evaluate(()=>{ R.meta.pos=R.pos; closeReader(); }); await sleep(300);
  }
  await pg.evaluate(()=>{ const m=LIB.find(x=>x.id==='shelf-gatsby'); }); 
  console.log('top', await pg.evaluate(()=>[...document.querySelectorAll('#docList > *')].slice(0,6).map(e=>e.classList.contains('grp')?'## '+e.textContent:e.querySelector('.t').textContent).join(' | ')));
  console.log('status chips', await pg.evaluate(()=>[...document.querySelectorAll('#libStatus button')].map(b=>b.textContent+(b.getAttribute('aria-pressed')==='true'?'*':''))));
  await pg.screenshot({path:'lib_reading.png'});
  await pg.click('#libStatus [data-st=reading]'); await sleep(200);
  console.log('reading filter', await pg.evaluate(()=>[...document.querySelectorAll('#docList .doc .t')].map(e=>e.textContent)));
  await pg.click('#libStatus [data-st=done]'); await sleep(200);
  console.log('done filter', await pg.evaluate(()=>$('#docList').textContent.trim()));
  await pg.click('#libStatus [data-st=unread]'); await sleep(200);
  console.log('unread count', await pg.evaluate(()=>document.querySelectorAll('#docList .doc').length));
  await pg.click('#libStatus [data-st=all]'); await pg.click('#libSort [data-s=tags]'); await sleep(200);
  console.log('category+top', await pg.evaluate(()=>[...document.querySelectorAll('#docList .grp')].map(g=>g.textContent).join(' | ')));
  await pg.reload(); await sleep(1200);
  console.log('after reload', await pg.evaluate(()=>[LIBV.status, LIB.length]));
  console.log('errors', errs); await b.close();
})();
