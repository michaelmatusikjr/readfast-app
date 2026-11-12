// Upgrade test: old ReadFast (87b274b) state -> new Tooz eReader, same origin, persistent profile.
const { chromium } = require('/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-r2/node_modules/playwright-core');
const fs=require('fs');
const SP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const D=SP+'rt-data/';
const EP=SP+'redteam-epub/';
const LIBS={'jszip.min.js':EP+'node_modules/jszip/dist/jszip.min.js','pdf.min.js':EP+'node_modules/pdfjs-dist/build/pdf.min.js','pdf.worker.min.js':EP+'node_modules/pdfjs-dist/build/pdf.worker.min.js'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let CUR=D+'old.html';
async function launch(dir){
  const ctx=await chromium.launchPersistentContext(dir,{executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', viewport:{width:390,height:844}, serviceWorkers:'block', acceptDownloads:true});
  await ctx.route(/cdnjs/,r=>{ const k=Object.keys(LIBS).find(k=>r.request().url().endsWith('/'+k)); return k?r.fulfill({path:LIBS[k],contentType:'application/javascript'}):r.abort(); });
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await ctx.route(/localhost:8761\/(index\.html)?(\?.*)?$/,r=>r.fulfill({path:CUR,contentType:'text/html'}));
  return ctx;
}
async function page(ctx){ if(!ctx.__k){ ctx.__k=1; await ctx.addInitScript(()=>{window.__toozKeepSample=true}); } const pg=ctx.pages()[0]||await ctx.newPage(); pg.errs=[]; pg.on('pageerror',e=>pg.errs.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error') pg.errs.push('console '+m.text()); }); await pg.goto('http://localhost:8761/'); await sleep(900); return pg; }
const log=(...a)=>console.log(...a.map(x=>typeof x==='string'?x:JSON.stringify(x)));
async function addFile(pg,path,title){ await pg.setInputFiles('#fileIn', path); await pg.waitForFunction((t)=>LIB.some(m=>m.title.includes(t)),title,{timeout:30000}); }
(async()=>{
  const prof=D+'profile'; fs.rmSync(prof,{recursive:true,force:true});
  // ---------- OLD VERSION ----------
  let ctx=await launch(prof); let pg=await page(ctx);
  log('OLD lib', await pg.evaluate(()=>LIB.map(m=>m.title)));
  await addFile(pg, SP+'tooz/t/rich.epub', 'Rich Test');
  await addFile(pg, EP+'files/epub_images.epub', '');
  await addFile(pg, EP+'files/simple.pdf', '');
  await pg.evaluate(async()=>{ const m=fromPlainText('# Intro\nThis is the first pasted paragraph. It has two sentences.\n\nSecond paragraph here, with more words in it to read.\n\n## Part two\nThird paragraph under a subheading. The end.'); await addDoc({title:'Pasted thing', kind:'paste', ...m}); });
  await pg.evaluate(async()=>{ const html='<html><head><title>An Article</title></head><body><article><h1>Big Story</h1>'+Array.from({length:6},(_,k)=>'<p>Paragraph '+k+' of the article has enough words in it to count as real article text for the extractor, which needs a few hundred characters.</p>').join('')+'<blockquote><p>A pulled quote.</p></blockquote></article></body></html>'; const a=extractArticle(html,'https://ex.com/a'); await addDoc({...a, title:a.title, kind:'link', source:'https://ex.com/a'}); });
  log('OLD lib after import', await pg.evaluate(()=>LIB.map(m=>[m.title,m.kind,m.count,m.chapters.length,m.imageCount])));
  // read partway in each, bookmarks, words
  const state=await pg.evaluate(async()=>{
    const out={};
    for(const m of LIB){
      await openDoc(m.id); const target=Math.floor(R.n*0.4); goTo(target);
      R.meta.bookmarks.push({i:Math.floor(R.n*0.2), name:'BM '+m.title.slice(0,10), at:Date.now()}); touch(R.meta);
      defineWord(clean(R.words[target])||'x', target);
      closeReader(); out[m.id]={title:m.title,pos:target,n:R.n,word:R.words[target]};
    }
    return out;
  });
  await pg.evaluate(()=>closeSheet());
  await pg.evaluate(()=>{ S.wpm=480; S.theme='dark'; S.fontSize=56; S.focusColor='#3478F6'; S.font='lexend'; S.multi=true; saveSettings(); recordStats(600000, 3000); });
  const oldLS=await pg.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('rf.')).map(k=>[k,localStorage.getItem(k).slice(0,200)])));
  log('OLD localStorage keys', Object.keys(oldLS));
  log('OLD settings', oldLS['rf.settings']);
  // backup from old
  const dlP=pg.waitForEvent('download'); await pg.evaluate(()=>backup()); const dl=await dlP; await dl.saveAs(D+'dl/old-backup.json');
  log('OLD backup size', fs.statSync(D+'dl/old-backup.json').size, 'errs', pg.errs);
  await ctx.close();

  // ---------- NEW VERSION ----------
  CUR=D+'new.html';
  ctx=await launch(prof); pg=await page(ctx);
  log('NEW lib', await pg.evaluate(()=>LIB.map(m=>[m.title,m.pos,m.bookmarks.length,m.highlights])));
  log('NEW settings', await pg.evaluate(()=>({wpm:S.wpm, theme:S.theme, speedSize:S.speedSize, focusColor:S.focusColor, font:S.font, mode:S.mode, multi:S.multi, v:S.v, eff:effectiveTheme()})));
  log('NEW words', await pg.evaluate(()=>WORDS.map(w=>[w.word,w.pos,w.docTitle])));
  for(const id of Object.keys(state)){
    for(const mode of ['pages','scroll','speed']){
      const r=await pg.evaluate(async([id,mode])=>{ S.mode=mode; await openDoc(id); await new Promise(r=>setTimeout(r,250));
        const h=hostEl(); const res={mode:R.mode,pos:R.pos,word:R.words[R.pos], blocks:R.blocks.length, types:[...new Set(R.blocks.map(b=>b.t))], secs:R.SEC.length};
        if(h){ res.heads=[...h.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(x=>x.textContent.trim().slice(0,30)); res.imgs=h.querySelectorAll('img').length; res.paras=h.querySelectorAll('p').length; }
        else res.speedWord=$('#word').textContent;
        closeReader(); return res; },[id,mode]);
      log(state[id].title.slice(0,18), mode, r, 'expected pos', state[id].pos, state[id].word);
    }
  }
  // images in old book across all sections
  log('old epub_images: all images render?', await pg.evaluate(async()=>{ const m=LIB.find(x=>x.imageCount>0); if(!m) return 'none'; S.mode='scroll'; await openDoc(m.id); let cnt=0; for(let k=0;k<R.SEC.length;k++){ const d=document.createElement('div'); d.innerHTML=sectionHTML(k); cnt+=d.querySelectorAll('img').length; } const r={imageCount:m.imageCount, rendered:cnt, list:R.imgList.length, end:R.imgEnd.length}; closeReader(); return r; }));
  // Words go-to-passage
  log('Words goto', await pg.evaluate(async()=>{ const x=WORDS[WORDS.length-1]; S.mode='pages'; await openDoc(x.docId); await goTo(x.pos); const r=[x.word, R.pos, x.pos, R.words[R.pos]]; closeReader(); return r; }));
  log('Stats', await pg.evaluate(()=>{ showView('stats'); return $('#statsBody').innerText.replace(/\s+/g,' ').slice(0,300); }));
  // backup from OLD restored into a fresh profile on NEW
  log('NEW errs', pg.errs);
  // new backup
  // add a highlight and note in rich book (old import) then backup
  await pg.evaluate(async()=>{ const m=LIB.find(x=>x.title.includes('Rich')); await openDoc(m.id); addHighlight(10,20,3,'note A'); R.meta.bookmarks.push({i:50,name:'new bm',at:Date.now()}); touch(R.meta); closeReader(); });
  // import new rich book with font for round trip
  await addFile(pg, SP+'tooz/t/rich.epub', 'Rich Test');
  await pg.evaluate(async()=>{ const ms=LIB.filter(x=>x.title.includes('Rich')); const m=ms[ms.length-1]; await openDoc(m.id); addHighlight(30,40,2,'note B'); closeReader(); });
  await sleep(300);
  const dl2P=pg.waitForEvent('download'); await pg.evaluate(()=>backup()); const dl2=await dl2P; await dl2.saveAs(D+'dl/new-backup.json');
  await ctx.close();

  for(const [name,file] of [['OLD-backup',D+'dl/old-backup.json'],['NEW-backup',D+'dl/new-backup.json']]){
    const p2=D+'profile-'+name; fs.rmSync(p2,{recursive:true,force:true});
    ctx=await launch(p2); pg=await page(ctx);
    await pg.setInputFiles('#restoreIn', file); await sleep(500);
    log(name,'sheet', await pg.evaluate(()=>$('#sheet').hidden?$('#toastMsg').textContent:$('#sheet .note').textContent.slice(0,80)));
    await pg.evaluate(()=>sheetActs.go()); await sleep(2500);
    log(name,'restored lib', await pg.evaluate(()=>LIB.map(m=>[m.title,m.pos,m.bookmarks.length,(m.highlights||[]).length])));
    log(name,'words', await pg.evaluate(()=>WORDS.length), 'stats', await pg.evaluate(()=>localStorage.getItem('rf.stats')));
    log(name,'check', await pg.evaluate(async()=>{ const out=[]; for(const m of LIB.filter(x=>x.kind==='epub')){ S.mode='pages'; await openDoc(m.id); await new Promise(r=>setTimeout(r,300)); out.push({t:m.title, pos:R.pos, fam:R.bookFamily, imgs:R.imgUrls.length, imgOK: await Promise.all(R.imgUrls.map(u=>new Promise(res=>{ const i=new Image(); i.onload=()=>res(i.naturalWidth); i.onerror=()=>res(-1); i.src=u; }))), hl:R.meta.highlights.map(h=>h.note), hlDom:document.querySelectorAll('#pgFlow w.hl2,#pgFlow w.hl3').length }); closeReader(); } return out; }));
    log(name,'errs', pg.errs);
    await ctx.close();
  }
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
