const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block'});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const cors={'access-control-allow-origin':'*'};
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/onnxruntime-web@1\.31\.1\/dist\/(.*)/, r=>{ const f=r.request().url().split('/').pop(); r.fulfill({path:S+'st/ci/latest/node_modules/onnxruntime-web/dist/'+f, headers:Object.assign({'content-type':f.endsWith('.wasm')?'application/wasm':'application/javascript'},cors)}); });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  /* pretend the old garbled copy was downloaded */
  await pg.evaluate(async()=>{ closeSheet(); const root=await navigator.storage.getDirectory(); const d=await root.getDirectoryHandle('supertonic',{create:true}); await d.getFileHandle('x',{create:true}); S.pipVoice='st-F1'; saveSettings(); });
  const t0=Date.now();
  const r=await pg.evaluate(async()=>{ await natEnsure(); const g=await natGen('This is how your books will sound when Tooz reads them aloud, from Isaiah chapter 26 verse 8.'); const buf=await (await fetch(g.url)).arrayBuffer(); return {dur:g.dur, ms:g.ms, b:Array.from(new Uint8Array(buf))}; });
  fs.writeFileSync(S+'st/page_F1.wav', Buffer.from(r.b));
  ok('real model loads in the browser and speaks', r.dur>3, {dur:r.dur, ms:r.ms, total:Date.now()-t0});
  ok('old copy removed, new folder used', await pg.evaluate(async()=>{ const root=await navigator.storage.getDirectory(); const names=[]; for await (const [n] of root.entries()) names.push(n); return !names.includes('supertonic') && names.includes('supertonic-w8'); }));
  ok('no page errors', !errs.length, errs);
  await b.close();
})();
