const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await b.newContext({serviceWorkers:'block'})).newPage(); await pg.addInitScript(()=>{window.__toozKeepSample=true});
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(800);
  const r=await pg.evaluate(()=>{ const out=[]; for(let k=0;k<R.n && out.length<4;k++){ if(/[—–]/.test(R.words[k])){ const c=speechChunk(Math.max(0,k-3),12,30); out.push(R.words.slice(Math.max(0,k-3),k+4).join(' ')+'  =>  '+c.text); k+=8; } } return out; });
  require('fs').writeFileSync('dash.out', r.join('\n')); await b.close();
})();
