const { chromium } = require('playwright-core');
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await b.newContext({serviceWorkers:'block'})).newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await new Promise(r=>setTimeout(r,1200));
  const cases={'(NIV).':'N.I.V.','NASB':'N.A.S.B','KJV,':'K.J.V,','NKJV':'N.K.J.V','ESV':'E.S.V','LSB':'L.S.B','CIA':'C.I.A','FBI’s':"F.B.I's",'NSA.':'N.S.A.','CEOs':'C.E.Os','NASA':null,'FEMA':null,'PETA,':null,'LORD':null,'AM':null,'GOD':null,'XIV':null,'TV':'T.V','MR.':null,'Passion':null,'I':null,'U.S.':null,'NIrV':'N.I.R.V'};
  const r=await pg.evaluate(c=>Object.fromEntries(Object.keys(c).map(k=>[k,acronymSpoken(k)])),cases);
  for(const k in cases) ok(k, r[k]===cases[k], r[k]);
  ok('no errors', !errs.length, errs);
  await b.close();
})();
