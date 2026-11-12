const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  let direct=0, proxied=0;
  await ctx.route(/^https:\/\/www\.gutenberg\.org/,r=>{ direct++; r.abort(); });   // pretend the phone is blocked from Gutenberg
  await ctx.route(/allorigins/,r=>{ proxied++; const u=decodeURIComponent(r.request().url().split('url=')[1]); if(u.includes('gutendex')) r.fulfill({contentType:'application/json', body:JSON.stringify({results:[{id:1342,title:'Pride and Prejudice',authors:[{name:'Austen, Jane'}],formats:{'application/epub+zip':'x'}},{id:99,title:'No epub',authors:[],formats:{}}]})}); else r.fulfill({path:'authored.epub', contentType:'application/epub+zip'}); });
  await ctx.route(/^https:\/\/gutendex/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  console.log('library', await pg.evaluate(()=>[LIB.length, LIB.filter(m=>m.pending).length, document.querySelectorAll('#docList .doc').length]));
  await pg.click('#libSort [data-s=tags]'); await sleep(200);
  console.log('groups', await pg.evaluate(()=>[...document.querySelectorAll('#docList .grp')].map(g=>g.textContent)));
  await pg.screenshot({path:'shelf_lib.png'});
  // open a bundled shelf book
  const t0=Date.now();
  await pg.evaluate(()=>openDoc('shelf-pilgrim')); await sleep(800);
  console.log('pilgrim', Date.now()-t0, await pg.evaluate(()=>{ const m=LIB.find(x=>x.id==='shelf-pilgrim'); return [m.pending, m.count, m.chapters.length, m.author, m.category, $('#v-reader').hidden, R.n]; }));
  await pg.screenshot({path:'shelf_pilgrim.png'});
  await pg.evaluate(()=>closeReader()); await sleep(300);
  // gutenberg shelf book through proxy
  await pg.evaluate(()=>openDoc('shelf-confessions')); await sleep(1500);
  console.log('confessions', direct, proxied, await pg.evaluate(()=>{ const m=LIB.find(x=>x.id==='shelf-confessions'); return [m.pending, m.count, m.title, m.author, $('#v-reader').hidden]; }));
  await pg.evaluate(()=>closeReader()); await sleep(300);
  // delete one, then re-add from Free books; reload doesn't bring it back
  await pg.evaluate(async()=>{ await Store.del('meta','shelf-gatsby'); LIB=LIB.filter(x=>x.id!=='shelf-gatsby'); renderLibrary(); });
  await pg.reload(); await sleep(1200);
  console.log('deleted stays deleted', await pg.evaluate(()=>LIB.some(m=>m.id==='shelf-gatsby')));
  await pg.click('#addBtn'); await sleep(500); await pg.click('#sheet [data-act=free]'); await sleep(500);
  console.log('free sheet', await pg.evaluate(()=>[$('#sheet h2').textContent, $('#sheet').textContent.includes('The Great Gatsby')]));
  await pg.screenshot({path:'shelf_free.png'});
  await pg.click('#sheet [data-act=shelf]'); await sleep(500);
  console.log('re-added', await pg.evaluate(()=>LIB.some(m=>m.id==='shelf-gatsby')));
  await pg.fill('#fbQ','austen'); await pg.press('#fbQ','Enter'); await sleep(1500);
  console.log('FB', await pg.evaluate(()=>JSON.stringify(FB)), proxied);
  console.log('results', await pg.evaluate(()=>[...document.querySelectorAll('#fbRes .li b')].map(x=>x.textContent).concat([...document.querySelectorAll('#fbRes .small')].map(x=>x.textContent))));
  await pg.screenshot({path:'shelf_search.png'});
  await pg.click('#fbRes [data-act=get]'); await sleep(2000);
  console.log('added from search', await pg.evaluate(()=>{ const m=LIB.find(x=>x.source==='gutenberg:1342'); return m&&[m.title,m.author,m.count,m.pending]; }));
  console.log('errors', errs); await b.close();
})();
