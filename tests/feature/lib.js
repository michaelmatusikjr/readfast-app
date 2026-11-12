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
  await pg.screenshot({path:'lib_empty1.png'});
  // add sheet
  await pg.click('#addBtn'); await sleep(500);
  console.log('add sheet', await pg.evaluate(()=>[$('#sheet h2').textContent, [...document.querySelectorAll('#sheet .addopt b')].map(x=>x.textContent)]));
  await pg.screenshot({path:'lib_add.png'});
  await pg.click('#sheet [data-act=paste]'); await sleep(500);
  console.log('paste sheet', await pg.evaluate(()=>$('#sheet h2').textContent));
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  // epub with author via file input
  await pg.click('#addBtn'); await sleep(500);
  const [fc]=await Promise.all([pg.waitForEvent('filechooser'), pg.click('#sheet [data-act=file]')]);
  await fc.setFiles('authored.epub'); await sleep(2500);
  console.log('epub meta', await pg.evaluate(()=>{ const m=LIB.find(x=>x.kind==='epub'); return m&&[m.title,m.author,m.category,m.tags]; }));
  await pg.evaluate(async()=>{ const mk=(t,a,c,tg)=>addDoc({title:t, kind:'paste', ...fromPlainText('Some words here. '.repeat(40)), author:a, category:c}).then(m=>{ m.tags=tg; touch(m); });
    await mk('The Hobbit','J. R. R. Tolkien','Fiction',['favorites','fantasy']); await mk('Emma','Jane Austen','Fiction',['classics']); await mk('A Brief History of Time','Stephen Hawking','Science',['favorites']); await mk('Work notes','','',[]); renderLibrary(); });
  for(const s of ['recent','title','author','tags']){
    await pg.click(`#libSort [data-s=${s}]`); await sleep(150);
    console.log(s, await pg.evaluate(()=>[...document.querySelectorAll('#docList > *')].map(e=>e.classList.contains('grp')?'## '+e.textContent:e.querySelector('.t').textContent.replace(/^(EPUB|Pasted|Sample)/,'')).join(' | ')));
  }
  await pg.screenshot({path:'lib_tags.png', fullPage:true});
  await pg.click('#libTags [data-tag=favorites]'); await sleep(150);
  console.log('tag filter', await pg.evaluate(()=>[...document.querySelectorAll('#docList .doc .t')].map(e=>e.textContent)));
  await pg.click('#libTags [data-tag=""]'); await pg.click('#libSort [data-s=recent]');
  await pg.fill('#libFind','austen'); await sleep(150);
  console.log('search', await pg.evaluate(()=>[...document.querySelectorAll('#docList .doc .t')].map(e=>e.textContent)));
  await pg.fill('#libFind',''); await sleep(100);
  // edit sheet
  const id=await pg.evaluate(()=>LIB.find(x=>x.title==='Work notes').id);
  await pg.click(`[data-more="${id}"]`); await sleep(500);
  await pg.screenshot({path:'lib_edit.png'});
  await pg.fill('#edTitle','Meeting notes'); await pg.fill('#edAuthor','Mick');
  await pg.click('#sheet [data-act=setcat][data-v=Science]'); await sleep(450);
  console.log('cat chip kept edits', await pg.evaluate(()=>[$('#edTitle').value,$('#edAuthor').value,$('#edCat').value]));
  await pg.fill('#edTag','work'); await pg.press('#edTag','Enter'); await sleep(450);
  await pg.click('#sheet [data-act=usetag][data-v=favorites]'); await sleep(450);
  await pg.fill('#edTag','later');
  await pg.click('#sheet [data-act=save]'); await sleep(300);
  console.log('saved', await pg.evaluate(id=>{ const m=LIB.find(x=>x.id===id); return [m.title,m.author,m.category,m.tags]; }, id));
  await pg.click(`[data-more="${id}"]`); await sleep(500);
  await pg.click('#sheet [data-act=rmtag][data-k="0"]'); await sleep(450);
  await pg.click('#sheet [data-act=save]'); await sleep(300);
  console.log('rm tag', await pg.evaluate(id=>LIB.find(x=>x.id===id).tags, id));
  await pg.reload(); await sleep(1200);
  console.log('persisted', await pg.evaluate(id=>{ const m=LIB.find(x=>x.id===id); return [m.title,m.author,m.category,m.tags, LIBV.sort]; }, id));
  await pg.screenshot({path:'lib_main.png'});
  console.log('errors', errs); await b.close();
})();
