const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort()); await ctx.route(/cdnjs/,r=>r.abort());
  const pg=await ctx.newPage(); await pg.goto('http://localhost:8750/'); await sleep(1000);
  await pg.evaluate(async()=>{ await openDoc(LIB[0].id); addHighlight(20,28,2); touch(R.meta); closeReader(); });
  await pg.click('#tabs [data-tab=words]'); await sleep(500);
  console.log(await pg.evaluate(()=>{ let e=document.querySelector('#notesHl .nbook-h .btn'); const o=[]; while(e){ const r=e.getBoundingClientRect(); o.push(e.tagName+'#'+e.id+'.'+e.className+' '+Math.round(r.left)+'-'+Math.round(r.right)+' '+getComputedStyle(e).display); e=e.parentElement; } return o; }));
  await b.close();
})();
