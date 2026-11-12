const { chromium } = require('playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({serviceWorkers:'block'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); pg.on('pageerror',e=>console.log('ERR',e.message));
  await pg.goto('http://localhost:8750/'); await pg.waitForTimeout(500);
  const buf=require('fs').readFileSync(__dirname+'/rich.epub').toString('base64');
  console.log(await pg.evaluate(async(b64)=>{
    await loadScript(CDN.jszip); const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
    const zip=await JSZip.loadAsync(bin); const files={}; zip.forEach((p,f)=>{ if(f.dir) return; files[p]=f; files[p.toLowerCase()]=files[p.toLowerCase()]||f; });
    const read=async(p)=>{ const f=files[p]||files[p.toLowerCase()]; return f? f.async('string'):null; };
    const items={css:{href:'OEBPS/Styles/book.css',type:'text/css'}};
    try{ const r=await epubFont(items, read, files, new Set()); return JSON.stringify(r&&{fam:r.family,n:r.faces.length}); }catch(e){ return 'THREW '+e.message+' '+e.stack.split('\n')[1]; }
    const d=await parseEpub(bin.buffer,'x.epub'); return JSON.stringify({types:[...new Set(d.blocks.map(b=>b.t))]});
  }, buf));
  const r2=await pg.evaluate(async(b64)=>{ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const d=await parseEpub(bin.buffer,'x.epub'); return JSON.stringify({types:[...new Set(d.blocks.map(b=>b.t))], font:d.font&&d.font.family}); }, buf);
  console.log(r2); await b.close();
})();
