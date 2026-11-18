const __E=require('../env');
const { chromium } = require('playwright');
const EP=(__E.SCRATCH+'redteam-epub/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1800);
  console.log('first run shows tour', await pg.evaluate(()=>[!$('#tour').hidden, ($('#tourCaption')||{}).textContent, LS.get('tourDone')]));
  await pg.evaluate(()=>{ if(typeof tourEnd==='function') tourEnd(true); }); await sleep(400);
  console.log('after skip', await pg.evaluate(()=>[($('#tour')||{hidden:true}).hidden, LS.get('tourDone'), $('#v-library').hidden]));
  await pg.evaluate(()=>openDoc(LIB.find(m=>m.kind==='sample').id)); await sleep(700);
  await pg.evaluate(()=>closeReader()); await sleep(900);
  console.log('prompt on close', await pg.evaluate(()=>[$('#sheet').hidden, $('#sheet h2').textContent]));
  await pg.click('#sheet [data-act=keep]'); await sleep(400);
  console.log('kept', await pg.evaluate(()=>LIB.some(m=>m.kind==='sample')));
  // open tutorial then "close the app" (reload) while in it
  await pg.evaluate(()=>openDoc(LIB.find(m=>m.kind==='sample').id)); await sleep(700);
  await pg.reload(); await sleep(2000);
  console.log('prompt after reopen', await pg.evaluate(()=>[$('#sheet').hidden, $('#sheet h2').textContent, $('#v-reader').hidden]));
  await pg.click('#sheet [data-act=tuck]'); await sleep(600);
  console.log('tucked', await pg.evaluate(()=>[LIB.some(m=>m.kind==='sample'), $('#toastMsg').textContent]));
  await pg.reload(); await sleep(1500);
  console.log('no prompt now', await pg.evaluate(()=>$('#sheet').hidden));
  console.log('errors', errs); await b.close();
})();
