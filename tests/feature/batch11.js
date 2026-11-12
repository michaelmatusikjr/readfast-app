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
  // speed: dashes & hyphens
  const sp=await pg.evaluate(async()=>{
    const m=await addDoc({title:'Dash test', kind:'paste', ...fromPlainText('He paused — then spoke. It was this—that and a well-known twenty-five-year rule, done.')});
    S.mode='speed'; S.multi=false; S.adaptive=false; S.longWord=false; S.wpm=300; saveSettings(); await openDoc(m.id);
    const out=[]; R.pos=0; R.subFor=-1;
    for(let step=0; step<16 && R.pos<R.n; step++){
      const i=R.pos; const j=showChunk(i); const d=Math.round(delayFor(i,j)); out.push($('#word').textContent.trim()+' '+d);
      const P=dashParts(i), sub=R.subFor===i?R.sub:0; if(P && sub<P.length-1){ R.sub=sub+1; R.subFor=i; continue; } R.subFor=-1; R.pos=j;
    }
    closeReader(true); return out; });
  console.log('speed steps', sp);
  // library tools
  await pg.evaluate(()=>showView('library')); await sleep(300);
  console.log('placeholder', await pg.evaluate(()=>[$('#libFind').placeholder, !!$('#libSort'), !!$('#sortBtn').innerHTML]));
  await pg.click('#sortBtn'); await sleep(500);
  console.log('sort sheet', await pg.evaluate(()=>[...document.querySelectorAll('#sheet .sortopt')].map(b=>b.textContent)));
  await pg.click('#sheet [data-s=author]'); await sleep(400);
  console.log('sorted author', await pg.evaluate(()=>[LIBV.sort, [...document.querySelectorAll('#docList .grp')].slice(0,4).map(g=>g.textContent)]));
  // search suggestions
  await pg.fill('#libFind','chr'); await sleep(200);
  console.log('suggest chr', await pg.evaluate(()=>[...document.querySelectorAll('#libSug .pill')].map(p=>p.textContent)));
  await pg.click('#libSug [data-k="christian classics"]'); await sleep(200);
  console.log('after tap', await pg.evaluate(()=>[$('#libFind').value, [...F.tg], document.querySelectorAll('#docList .doc').length, [...document.querySelectorAll('#libPills .pill')].map(p=>p.textContent), !!document.querySelector('#docList .grp') && $('#docList .grp').textContent]));
  // filter sheet: add another tag (OR), then author (AND)
  await pg.click('#filterBtn'); await sleep(500);
  console.log('filter sections', await pg.evaluate(()=>[...document.querySelectorAll('#sheet .fsec summary')].map(s=>s.textContent)));
  await pg.click('#sheet .fsec[data-sec=tg] summary'); await sleep(200);
  await pg.fill('#sheet [data-fq=tg]','lit'); await sleep(200);
  console.log('tag search', await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-opts=tg] .fopt')].map(o=>o.textContent)));
  await pg.click('#sheet [data-fopt=tg][data-k="literary classics"]'); await sleep(200);
  console.log('OR count', await pg.evaluate(()=>[document.querySelectorAll('#docList .doc').length, $('#fDone').textContent]));
  await pg.click('#sheet .fsec[data-sec=au] summary'); await sleep(200);
  console.log('authors offered (first 6)', await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-opts=au] .fopt .lb')].slice(0,6).map(o=>o.textContent).concat([document.querySelectorAll('#sheet [data-opts=au] .fopt').length])));
  await pg.click('#sheet [data-fopt=au][data-k="g. k. chesterton"]'); await sleep(150);
  await pg.click('#sheet [data-fopt=au][data-k="jane austen"]'); await sleep(150);
  console.log('AND result', await pg.evaluate(()=>[...document.querySelectorAll('#docList .doc .t')].map(t=>t.textContent)));
  console.log('tags narrowed', await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-opts=tg] .fopt .lb')].map(o=>o.textContent)));
  await pg.fill('#sheet [data-fq=tg]',''); await sleep(150);
  console.log('tags narrowed all', await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-opts=tg] .fopt .lb')].map(o=>o.textContent)));
  await pg.screenshot({path:'b11_filter.png'});
  await pg.click('#sheet [data-act=done]'); await sleep(450);
  await pg.screenshot({path:'b11_pills.png'});
  console.log('pills', await pg.evaluate(()=>[...document.querySelectorAll('#libPills .pill')].map(p=>p.className.split(' ')[1]+':'+p.textContent)));
  await pg.click('#libPills [data-unf=au][data-k="jane austen"]'); await sleep(200);
  console.log('removed pill', await pg.evaluate(()=>[...F.au]));
  await pg.click('#libPills [data-unf=all]'); await sleep(200);
  console.log('cleared', await pg.evaluate(()=>[fCount(), !!document.querySelector('#docList .grp')]));
  // status filter + continue reading hidden
  await pg.evaluate(()=>{ const m=LIB.find(x=>x.title==='Dash test'); m.pos=5; m.lastRead=Date.now(); touch(m); renderLibrary(); });
  console.log('continue reading shown', await pg.evaluate(()=>$('#docList .grp').textContent));
  await pg.evaluate(()=>{ toggleFilter('st','reading',true); renderLibrary(); });
  console.log('status filter', await pg.evaluate(()=>[document.querySelectorAll('#docList .doc').length, [...document.querySelectorAll('#docList .grp')].map(g=>g.textContent)]));
  // filters don't survive a reload; sort does
  await pg.reload(); await sleep(1500);
  console.log('after reload', await pg.evaluate(()=>[fCount(), LIBV.sort]));
  // 98% check
  await pg.evaluate(()=>{ const m=LIB.find(x=>x.title==='Dash test'); m.pos=Math.ceil((m.count-1)*0.985); touch(m); showView('settings'); showView('library'); }); await sleep(1300);
  console.log('near prompt', await pg.evaluate(()=>[$('#sheet').hidden, $('#sheet h2').textContent, $('#sheet .note').textContent]));
  await pg.click('#sheet [data-act=no]'); await sleep(700);
  console.log('second q', await pg.evaluate(()=>$('#sheet h2').textContent));
  await pg.click('#sheet [data-act=later]'); await sleep(500);
  await pg.evaluate(()=>{ showView('settings'); showView('library'); }); await sleep(1300);
  console.log('quiet after No', await pg.evaluate(()=>$('#sheet').hidden));
  await pg.evaluate(()=>{ const m=LIB.find(x=>x.title==='Dash test'); m.pos+=1; touch(m); showView('settings'); showView('library'); }); await sleep(1300);
  console.log('asks again after reading more', await pg.evaluate(()=>$('#sheet h2').textContent));
  await pg.click('#sheet [data-act=yes]'); await sleep(600);
  console.log('yes -> finish prompt', await pg.evaluate(()=>[$('#sheet h2').textContent, LIB.find(x=>x.title==='Dash test').finished]));
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  // archive asks unless 100%
  await pg.evaluate(()=>{ const m=LIB.find(x=>x.id==='shelf-pride'); m.count=1000; m.pos=995; archiveFlow(m.id); }); await sleep(500);
  console.log('archive 99.6% asks', await pg.evaluate(()=>$('#sheet h2').textContent));
  console.log('errors', errs); await b.close();
})();
