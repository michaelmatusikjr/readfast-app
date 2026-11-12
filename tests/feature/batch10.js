const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1800);
  // #10 first run opens the tutorial
  console.log('first run', await pg.evaluate(()=>[!$('#v-reader').hidden, R.meta&&R.meta.kind]));
  await pg.evaluate(()=>closeReader()); await sleep(500);
  console.log('tutorial removed on close', await pg.evaluate(()=>[LIB.some(m=>m.kind==='sample'), $('#v-library').hidden]));
  await pg.reload(); await sleep(1500);
  console.log('no reopen on 2nd launch', await pg.evaluate(()=>[$('#v-reader').hidden, LIB.some(m=>m.kind==='sample')]));
  await pg.click('#tabs [data-tab=settings]'); await sleep(300);
  console.log('settings sections', await pg.evaluate(()=>[...document.querySelectorAll('#settingsBody h2')].map(h=>h.textContent)));
  await pg.click('#tutRestore'); await sleep(500);
  console.log('tutorial restored', await pg.evaluate(()=>LIB.some(m=>m.kind==='sample')));
  // #3 tags: starter tags, no category anywhere
  console.log('shelf tags', await pg.evaluate(()=>['shelf-pilgrim','shelf-pride','shelf-kjv'].map(id=>LIB.find(m=>m.id===id).tags.join('/')).concat([LIB.some(m=>'category' in m), LIBSORTS.map(x=>x[0]).join(',')])));
  // migration of an old category
  console.log('migrate', await pg.evaluate(()=>{ const m=LIB.find(x=>x.id==='shelf-gatsby'); m.category='Old'; const s=LIB.find(x=>x.kind==='sample'); s.category='Guides'; migrateTags(); return [m.tags.join('/'), s.tags.join('/'), 'category' in m]; }));
  // settings tags list, rename, delete
  await pg.evaluate(()=>renderSettings()); await sleep(200);
  console.log('tags in settings', await pg.evaluate(()=>document.querySelectorAll('#tagSet [data-tren]').length));
  await pg.click('#tagSet [data-tren="Sea"]'); await sleep(500);
  await pg.fill('#tagNew','Ocean'); await pg.click('#sheet [data-act=ok]'); await sleep(400);
  console.log('renamed', await pg.evaluate(()=>[LIB.find(m=>m.id==='shelf-moby').tags.join('/'), allTags().includes('Sea')]));
  await pg.click('#tagSet [data-tdel="Adventure"]'); await sleep(500);
  console.log('delete confirm', await pg.evaluate(()=>$('#sheet .note').textContent));
  await pg.click('#sheet [data-act=yes]'); await sleep(400);
  console.log('deleted tag', await pg.evaluate(()=>[allTags().includes('Adventure'), LIB.find(m=>m.id==='shelf-moby').tags.join('/')]));
  // suggestions: pending book asks to download
  await pg.click('#tabs [data-tab=library]'); await sleep(300);
  await pg.click('[data-more="shelf-orthodoxy"]'); await sleep(500);
  console.log('pending tag prompt', await pg.evaluate(()=>$('#tagSug').textContent.trim().slice(0,70)));
  await pg.click('#sheet [data-act=dltag]'); await sleep(2500);
  console.log('after download suggestions', await pg.evaluate(()=>[!$('#sheet').hidden, [...document.querySelectorAll('#tagSug .chip')].map(c=>c.dataset.v)]));
  await pg.fill('#edTag','apol'); await sleep(100);
  console.log('typing filters', await pg.evaluate(()=>[...document.querySelectorAll('#tagSug .chip, #knownTags .chip')].filter(c=>!c.hidden).map(c=>c.dataset.v)));
  await pg.screenshot({path:'b10_tags.png'});
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  // #2 tile fill
  await pg.evaluate(async()=>{ const m=LIB.find(x=>x.id==='shelf-orthodoxy'); m.pos=Math.round(m.count*0.4); m.lastRead=Date.now(); touch(m); renderLibrary(); });
  console.log('tile fill', await pg.evaluate(()=>[getComputedStyle(document.querySelector('[data-open="shelf-orthodoxy"]')).backgroundImage.slice(0,90), !!document.querySelector('.doc .bar')]));
  await pg.screenshot({path:'b10_lib.png'});
  // #1 start over -> not started
  await pg.click('[data-more="shelf-orthodoxy"]'); await sleep(500); await pg.click('#sheet [data-act=restart]'); await sleep(300);
  console.log('start over status', await pg.evaluate(()=>{ const m=LIB.find(x=>x.id==='shelf-orthodoxy'); return [isReading(m), m.pos, m.lastRead]; }));
  // #5 archive DNF with highlights kept
  await pg.evaluate(async()=>{ await openDoc('shelf-orthodoxy'); addHighlight(500,510,2); addHighlight(800,805,3); R.meta.highlights[1].note='Great line'; R.meta.bookmarks.push({i:900,name:'Ch',at:1}); goTo(2000); noteProgress(); saveProgress(true); closeReader(); });
  await sleep(500);
  await pg.click('[data-more="shelf-orthodoxy"]'); await sleep(500); await pg.click('#sheet [data-act=archive]'); await sleep(500);
  console.log('asks finished?', await pg.evaluate(()=>$('#sheet h2').textContent+' | '+$('#sheet .note').textContent));
  await pg.click('#sheet [data-act=no]'); await sleep(500);
  console.log('dnf sheet', await pg.evaluate(()=>[$('#sheet h2').textContent, [...document.querySelectorAll('#sheet [data-act=kp]')].map(c=>c.textContent), !!$('#arcReview')]));
  await pg.click('#sheet [data-act=kp][data-k=highlights]'); await sleep(450);
  await pg.screenshot({path:'b10_arch.png'});
  await pg.click('#sheet [data-act=go]'); await sleep(800);
  console.log('archived dnf', await pg.evaluate(()=>{ const a=ARCH.list()[0]; return [LIB.some(m=>m.id==='shelf-orthodoxy'), a.status, a.kept.highlights.length, a.kept.highlights[0].noteOnly, a.kept.highlights[0].q.slice(0,30), a.kept.progress.pct, a.kept.bookmarks.length]; }));
  // finish flow: finish a book, leave reader -> prompt
  await pg.evaluate(async()=>{ await openDoc('shelf-gatsby'); goTo(R.n-1); R.meta.finished=true; });
  await pg.evaluate(()=>closeReader()); await sleep(800);
  console.log('finish prompt', await pg.evaluate(()=>[$('#sheet h2').textContent, [...document.querySelectorAll('#sheet .btn')].map(b=>b.textContent.trim())]));
  await pg.click('#sheet [data-act=arch]'); await sleep(500);
  await pg.click('#sheet [data-act=star][data-v="4"]'); await sleep(450);
  await pg.fill('#arcReview','Loved the ending.');
  await pg.click('#sheet [data-act=star][data-v="5"]'); await sleep(450);
  console.log('review kept across rerender', await pg.evaluate(()=>[$('#arcReview').value, document.querySelectorAll('#sheet .stars [aria-pressed=true]').length]));
  await pg.screenshot({path:'b10_finish.png'});
  await pg.click('#sheet [data-act=go]'); await sleep(800);
  console.log('archived finished', await pg.evaluate(()=>{ const a=ARCH.list()[0]; return [a.title, a.status, a.rating, a.review, !!a.finishedAt, LIB.some(m=>m.id==='shelf-gatsby')]; }));
  // keep option
  await pg.evaluate(async()=>{ await openDoc('shelf-treasure'); goTo(R.n-1); R.meta.finished=true; closeReader(); }); await sleep(800);
  await pg.click('#sheet [data-act=keep]'); await sleep(400);
  await pg.evaluate(async()=>{ await openDoc('shelf-treasure'); goTo(R.n-1); R.meta.finished=true; closeReader(); }); await sleep(800);
  console.log('keep -> no prompt again', await pg.evaluate(()=>$('#sheet').hidden));
  // settings archive list + add back
  await pg.click('#tabs [data-tab=settings]'); await sleep(300);
  console.log('archive list', await pg.evaluate(()=>[...document.querySelectorAll('#archSet [data-arch]')].map(b=>b.textContent)));
  await pg.click('#archSet [data-arch="1"]'); await sleep(500);
  await pg.screenshot({path:'b10_archview.png'});
  await pg.click('#sheet [data-act=back]'); await sleep(600);
  console.log('added back', await pg.evaluate(()=>{ const m=LIB.find(x=>x.id==='shelf-orthodoxy'); return m&&[m.pending&&1, m.pos, m.highlights.length, m.highlights[0].note, m.bookmarks.length, ARCH.list().length]; }));
  // delete permanently
  await pg.click('#archSet [data-arch="0"]'); await sleep(500); await pg.click("#sheet [data-act=ask]"); await sleep(550); await pg.click("#sheet [data-act=del]"); await sleep(500);
  console.log('perm delete', await pg.evaluate(()=>ARCH.list().length));
  // archive of a pasted doc and re-add via paste
  await pg.evaluate(async()=>{ const m=await addDoc({title:'Memo', kind:'paste', ...fromPlainText('Alpha beta gamma. '.repeat(50))}); m.pos=20; m.highlights=[{s:3,e:5,c:1,at:1,note:'n'}]; touch(m); await archiveBook(m,false,{keep:{progress:true,bookmarks:true,highlights:true,notes:true}}); });
  await pg.evaluate(()=>renderSettings()); await pg.click('#archSet [data-arch="0"]'); await sleep(500); await pg.click('#sheet [data-act=back]'); await sleep(500);
  console.log('re-add sheet', await pg.evaluate(()=>[$('#sheet h2').textContent, ARCH_RESTORE]));
  await pg.evaluate(async()=>{ closeSheet(); await addDoc({title:'Memo again', kind:'paste', ...fromPlainText('Alpha beta gamma. '.repeat(50))}); });
  console.log('data applied', await pg.evaluate(()=>{ const m=LIB.find(x=>x.title==='Memo again'); return [m.pos, m.highlights.length, ARCH.list().length, ARCH_RESTORE]; }));
  // #7 words remove button
  await pg.evaluate(()=>{ WORDS.unshift({id:'w1',word:'ephemeral',sentence:'An ephemeral thing.',docId:'x',docTitle:'X',pos:0,at:Date.now()}); saveWords(); renderWords(); });
  await pg.click('#tabs [data-tab=words]'); await sleep(200); await pg.click('#notesSeg [data-n=w]'); await sleep(200);
  await pg.click('[data-wdel="w1"]'); await sleep(200);
  console.log('word removed', await pg.evaluate(()=>[WORDS.some(w=>w.id==='w1'), $('#toastMsg').textContent]));
  // #8 selection
  console.log('select', await pg.evaluate(()=>[getComputedStyle(document.querySelector('#tabs')).userSelect, getComputedStyle($('#settingsBody')).userSelect, getComputedStyle($('#pagesView')).userSelect]));
  // #9 autoscroll taps
  await pg.evaluate(async()=>{ S.mode='scroll'; S.autoScroll=true; saveSettings(); await openDoc(LIB.find(m=>m.kind==='sample').id); });
  await sleep(800);
  await pg.evaluate(()=>asStart()); await sleep(600);
  const tap=async()=>{ const r=await pg.evaluate(()=>{ const b=$('#scrollView').getBoundingClientRect(); return [b.left+b.width/2, b.top+b.height/2]; }); await pg.mouse.click(r[0],r[1]); await sleep(350); return pg.evaluate(()=>[SC.auto, R.chrome]); };
  console.log('tap1 (pause)', await tap()); console.log('tap2', await tap()); console.log('tap3', await tap());
  await pg.evaluate(()=>{ setChrome(true); }); await pg.click('#asPlay'); await sleep(300);
  console.log('play button resumes', await pg.evaluate(()=>SC.auto));
  await pg.evaluate(()=>{ asStop(); closeReader(); }); await sleep(500);
  console.log('sample after close (kept by test flag?)', await pg.evaluate(()=>LIB.some(m=>m.kind==='sample')));
  // #4 erase everything
  await pg.click('#tabs [data-tab=settings]'); await sleep(300); await pg.click('#eraseBtn'); await sleep(500);
  console.log('erase sheet', await pg.evaluate(()=>$('#sheet h2').textContent));
  await Promise.all([pg.waitForNavigation({timeout:15000}).catch(()=>{}), pg.click('#sheet [data-act=go]')]); await sleep(2000);
  console.log('after erase', await pg.evaluate(()=>[LIB.length, ARCH.list().length, WORDS.length, !$('#v-reader').hidden, R.meta&&R.meta.kind, Object.keys(localStorage).filter(k=>k.startsWith('rf.')).length]));
  console.log('errors', errs); await b.close();
})();
