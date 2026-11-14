const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({serviceWorkers:'block'}); const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1200);
  await pg.evaluate(async()=>{ localStorage.removeItem('rf.stGone'); localStorage.setItem('rf.pipReady.st-F1','true'); const s=JSON.parse(localStorage.getItem('rf.settings')||'{}'); s.pipVoice='st-F1'; localStorage.setItem('rf.settings',JSON.stringify(s)); const root=await navigator.storage.getDirectory(); const d=await root.getDirectoryHandle('supertonic-w8',{create:true}); await d.getFileHandle('x',{create:true}); });
  await pg.reload(); await sleep(1500);
  const r=await pg.evaluate(async()=>{ const root=await navigator.storage.getDirectory(); const n=[]; for await (const [k] of root.entries()) n.push(k); return {dirs:n, v:S.pipVoice, ready:localStorage.getItem('rf.pipReady.st-F1'), list:PIP_VOICES.map(g=>g[0])}; });
  ok('supertonic removed and voice reset', !r.dirs.some(d=>/supertonic/.test(d)) && r.v==='en_US-lessac-medium' && r.ready===null && !r.list.some(x=>/Supertonic/.test(x)), r);
  ok('no errors', !errs.length, errs); await b.close();
})();
