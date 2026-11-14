const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await b.newContext({serviceWorkers:'block'})).newPage(); await pg.addInitScript(()=>{window.__toozKeepSample=true});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  const r=await pg.evaluate(async()=>{
    closeSheet(); const txt='He paused . . . and then went on. She waited... Then she spoke. It faded … into silence. The end . . . . Next part here.';
    const words=txt.split(' '); const text={id:'el', words, ends:[words.length-1], blocks:[{s:0,e:words.length,t:'p'}], wf:null, notes:null, breaks:null, secs:null, dashSplit:1, rangeJoin:1};
    await Store.put('texts',text); const m={id:'el',title:'el',author:'',kind:'text',count:words.length,chapters:[{t:'S',i:0,d:0}],pos:0,highlights:[],bookmarks:[],added:Date.now(),lastRead:Date.now(),mod:Date.now(),tags:[],dashSplit:1,rangeJoin:1};
    LIB.push(m); touch(m); await openDoc('el'); await new Promise(r=>setTimeout(r,500));
    const out=[]; let i=0; while(i<R.n){ const c=natChunkAt(i); out.push(c.text); i=c.j; } return out;
  });
  ok('spaced dots: one comma pause, same clip', r[0]==='He paused, and then went on.', r);
  ok('... before a capital: one stop', r.some(t=>/^She waited\.$/.test(t)) || r.some(t=>/She waited\. Then/.test(t)), r);
  ok('… mid-sentence: one comma', r.some(t=>/It faded, into silence\./.test(t)), r);
  ok('four spaced dots: one stop', r.some(t=>/^The end\.$/.test(t)) && !r.some(t=>/^\.?$/.test(t)), r);
  ok('no page errors', !errs.length, errs); await b.close();
})();
