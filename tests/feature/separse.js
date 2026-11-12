const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const B='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/books/';
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await pg.waitForTimeout(800);
  for(const f of fs.readdirSync(B).sort()){
    const t0=Date.now();
    const r=await pg.evaluate(async([name,b64])=>{ try{ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const d=await parseFile(new File([bin],name)); return [d.title,d.author,d.category,d.words.length,d.chapters.length,d.chapters.slice(0,4).map(c=>c.t).join(' / '),d.images?d.images.at.length:0, d.imagesMissing||0]; }catch(e){ return 'ERR '+e.message; } },[f, fs.readFileSync(B+f).toString('base64')]);
    console.log(f.slice(0,40), Date.now()-t0+'ms', JSON.stringify(r));
  }
  console.log('errors',errs); await b.close();
})();
