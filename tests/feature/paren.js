const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(__E.launch());
  const pg=await (await b.newContext({serviceWorkers:'block'})).newPage(); await pg.addInitScript(()=>{window.__toozKeepSample=true});
  await pg.goto(__E.URL); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(800);
  const r=await pg.evaluate(()=>{ const out=[]; for(let k=0;k<R.n && out.length<4;k++){ if(/^\(/.test(R.words[k])){ const c=speechChunk(Math.max(0,k-4),20,30); out.push(R.words.slice(Math.max(0,k-4),k+8).join(' ')+'  =>  '+c.text); k+=10; } } return out; });
  require('fs').writeFileSync(require('../env').SCRATCH+'paren.out', r.join('\n')); await b.close();
})();
