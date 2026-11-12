const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1200);
  await pg.evaluate(()=>openDoc('shelf-kjv')); await sleep(800);
  await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='Psalm 23'); goTo(c.i); }); await sleep(600);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(600);
  console.log('rows', await pg.evaluate(()=>[document.querySelectorAll('#sheet .li').length, $('#sheet .li.open').textContent, $('#sheet .li.on').textContent]));
  await pg.screenshot({path:'toc_kjv.png'});
  const rev=await pg.evaluate(()=>[...document.querySelectorAll('#sheet .li')].find(x=>x.textContent.includes('Revelation')).dataset.k);
  await pg.click(`#sheet .li[data-k="${rev}"]`); await sleep(600);
  console.log('expanded', await pg.evaluate(()=>[document.querySelectorAll('#sheet .li').length, $('#sheet .li.open').textContent]));
  await pg.screenshot({path:'toc_rev.png'});
  const c5=await pg.evaluate(()=>{ const o=$('#sheet .li.open'); return o.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.nextElementSibling.dataset.k; });
  await pg.click(`#sheet .li[data-k="${c5}"]`); await sleep(800);
  console.log('went to', await pg.evaluate(()=>[$('#sheet').hidden, currentChapter(R.pos).t, $('#rSub').textContent]));
  // small book: unchanged flat list
  await pg.evaluate(()=>closeReader()); await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(800);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(500);
  console.log('gatsby rows', await pg.evaluate(()=>[document.querySelectorAll('#sheet .li').length, document.querySelectorAll('#sheet [data-act=tocx]').length]));
  console.log('errors', errs); await b.close();
})();
