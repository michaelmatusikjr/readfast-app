const __E=require('../env');
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(__E.launch());
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort()); await ctx.route(/cdnjs/,r=>r.abort());
  const pg=await ctx.newPage(); await pg.goto(__E.URL); await sleep(1000);
  await pg.evaluate(async()=>{ await openDoc(LIB[0].id); addHighlight(20,28,2); touch(R.meta); closeReader(); });
  await pg.click('#tabs [data-tab=words]'); await sleep(500);
  console.log(await pg.evaluate(()=>{ let e=document.querySelector('#notesHl [data-export], #notesHl [data-copy], #notesHl .nbook-toggle'); const o=[]; while(e){ const r=e.getBoundingClientRect(); o.push(e.tagName+'#'+e.id+'.'+e.className+' '+Math.round(r.left)+'-'+Math.round(r.right)+' '+getComputedStyle(e).display); e=e.parentElement; } return o; }));
  await b.close();
})();
