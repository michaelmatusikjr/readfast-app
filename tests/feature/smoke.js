const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const LIB={'jszip.min.js':EP+'node_modules/jszip/dist/jszip.min.js','pdf.min.js':EP+'node_modules/pdfjs-dist/build/pdf.min.js','pdf.worker.min.js':EP+'node_modules/pdfjs-dist/build/pdf.worker.min.js'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:844}, serviceWorkers:'block', hasTouch:false}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>{ const k=Object.keys(LIB).find(k=>r.request().url().endsWith('/'+k)); return k?r.fulfill({path:LIB[k],contentType:'application/javascript'}):r.abort(); });
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error') errs.push('console '+m.text()); });
  await pg.goto('http://localhost:8750/'); await sleep(800);
  const log=(...a)=>console.log(...a);
  log('library:', await pg.evaluate(()=>LIB.map(m=>m.title)));
  // open sample in pages mode
  await pg.evaluate(()=>openDoc(LIB[0].id)); await sleep(500);
  log('mode', await pg.evaluate(()=>[R.mode, P.pages, P.page, R.pos, document.querySelectorAll('#pgFlow w').length, $('#rInfo').textContent]));
  await pg.evaluate(()=>pgTurn(1)); await sleep(400);
  log('after turn', await pg.evaluate(()=>[P.page, R.pos, $('#rInfo').textContent]));
  for(let k=0;k<6;k++){ await pg.evaluate(()=>pgTurn(1)); await sleep(350); }
  log('after 6 turns', await pg.evaluate(()=>[P.k, P.page, P.pages, R.pos, R.SEC.length]));
  const pos=await pg.evaluate(()=>R.pos);
  await pg.evaluate(()=>switchMode('scroll')); await sleep(600);
  log('scroll', await pg.evaluate(()=>[R.mode, R.pos, scView.scrollTop, scFlow.children.length]));
  await pg.evaluate(()=>switchMode('speed')); await sleep(600);
  log('speed', await pg.evaluate(()=>[R.mode, R.pos, $('#word').textContent]));
  await pg.evaluate(()=>switchMode('pages')); await sleep(500);
  log('back to pages', await pg.evaluate(()=>[R.mode, R.pos, P.page]), 'expected pos', pos);
  await pg.evaluate(()=>closeReader()); await sleep(200);
  // import rich epub
  await pg.setInputFiles('#fileIn', __dirname+'/rich.epub');
  await pg.waitForFunction(()=>LIB.some(m=>m.title==='Rich Test Book'),null,{timeout:20000});
  log('toast', await pg.evaluate(()=>$('#toastMsg').textContent));
  const id=await pg.evaluate(()=>LIB.find(m=>m.title==='Rich Test Book').id);
  log('stored', await pg.evaluate(async(id)=>{ const t=await Store.get('texts',id); return {n:t.words.length, blocks:t.blocks.length, types:[...new Set(t.blocks.map(b=>b.t+(b.q?'+q':'')))], wfItalic:t.wf.filter(f=>f&1).length, notes:t.notes, breaks:t.breaks, secs:t.secs, font:t.font&&t.font.family, faces:t.font&&t.font.faces.length, lang:t.lang}; }, id));
  await pg.evaluate((id)=>openDoc(id), id); await sleep(800);
  log('rich pages', await pg.evaluate(()=>({pages:P.pages, italics:document.querySelectorAll('#pgFlow w.i').length, h:document.querySelectorAll('#pgFlow h1,#pgFlow h2').length, bq:document.querySelectorAll('#pgFlow .bq').length, li:document.querySelectorAll('#pgFlow p.bli').length, n:document.querySelectorAll('#pgFlow w.n').length, sup:document.querySelectorAll('#pgFlow w.p').length, sub:document.querySelectorAll('#pgFlow w.s').length, hr:document.querySelectorAll('#pgFlow hr.brk').length, bookFamily:R.bookFamily, bfont:getComputedStyle(document.querySelector('#pgFlow')).fontFamily.slice(0,60)})));
  // footnote tap
  await pg.evaluate(()=>openFootnote(idxOf(document.querySelector('#pgFlow w.n')))); await sleep(200);
  log('footnote', await pg.evaluate(()=>$('#sheet').hidden?'closed':$('#sheet .quote').textContent.slice(0,60)));
  await pg.evaluate(()=>closeSheet());
  // highlight
  await pg.evaluate(()=>{ addHighlight(5,12,2,'my note'); }); await sleep(100);
  log('hl', await pg.evaluate(()=>[document.querySelectorAll('#pgFlow w.hl2').length, document.querySelectorAll('#pgFlow w.hn').length, R.meta.highlights.length]));
  // search
  await pg.evaluate(()=>openSearch()); await pg.fill('#srchIn','scene break'); await sleep(500);
  log('search', await pg.evaluate(()=>[$('#srchMeta').textContent, document.querySelectorAll('#srchOut .result').length]));
  await pg.click('#srchOut .result'); await sleep(600);
  log('after search jump', await pg.evaluate(()=>[R.pos, R.words.slice(R.pos,R.pos+3).join(' '), !$('#backPill').hidden, document.querySelectorAll('w.found').length]));
  // toc + panel
  await pg.evaluate(()=>openToc('toc')); await sleep(150);
  log('toc', await pg.evaluate(()=>[...document.querySelectorAll('#sheet .li')].map(x=>x.textContent.trim())));
  await pg.evaluate(()=>closeSheet()); await pg.click('#rAa'); await sleep(200);
  log('panel sections', await pg.evaluate(()=>[...document.querySelectorAll('#sheet .panel-sec h3')].map(x=>x.textContent)));
  await pg.click('#sheet .seg[data-set="mode"] button[data-v="scroll"]'); await sleep(800);
  log('panel scroll sections', await pg.evaluate(()=>[R.mode, [...document.querySelectorAll('#sheet .panel-sec h3')].map(x=>x.textContent)]));
  await pg.evaluate(()=>{ S.autoScroll=true; saveSettings(); asUI(); }); await sleep(300); /* auto-scroll moved from Aa to Settings */
  log('autoscroll opts', await pg.evaluate(()=>[!$('#asBar').hidden]));
  await pg.click('#sheet .seg[data-set="mode"] button[data-v="speed"]'); await sleep(800);
  log('panel speed sections', await pg.evaluate(()=>[R.mode, [...document.querySelectorAll('#sheet .panel-sec h3')].map(x=>x.textContent)]));
  await pg.click('#sheet .seg[data-set="mode"] button[data-v="scroll"]'); await sleep(800);
  await pg.evaluate(()=>closeSheet());
  // auto-scroll
  const t0=await pg.evaluate(()=>{ asStart(); return scView.scrollTop; }); await sleep(3000);
  log('autoscroll moved', await pg.evaluate((t0)=>[scView.scrollTop-t0, SC.pxps.toFixed(1), R.pos], t0));
  await pg.evaluate(()=>asStop());
  // speed play
  await pg.evaluate(()=>switchMode('speed')); await sleep(500);
  await pg.evaluate(()=>play()); await sleep(1500); await pg.evaluate(()=>pause());
  log('speed played to', await pg.evaluate(()=>R.pos));
  await pg.evaluate(()=>switchMode('pages')); await sleep(500);
  log('errors', errs);
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
