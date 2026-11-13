const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block'}); await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); await openDoc(LIB.find(x=>x.kind==='sample').id); }); await sleep(900);
  const res=await pg.evaluate(()=>{
    const txt='The well-lived life must be God-exalting and soul-satisfying because that is why God created us (Isa. 43:7; Ps. 90:14). That was the burden of chapter 2. And God commands us to love him with all our heart (Matt. 22:37), and Jesus reminds us that he spits lukewarm people out of his mouth (Rev. 3:16). The opposite of wasting your life is to live (1 Cor. 10:31). As C. S. Lewis said, see Dr. Smith.';
    const save={w:R.words,n:R.n,b:R.blocks,wf:R.wf,notes:R.notes,ends:R.ends};
    R.words=txt.split(' '); R.n=R.words.length; R.blocks=[{s:0,e:R.n,t:'p'}]; R.wf=new Uint8Array(R.n); R.notes=new Map(); R.ends=new Set(); R._nb=null;
    const outs=[];
    for(const max of [55,70,8,5]) for(let st=0; st<R.n; st+=1){
      let i=st, parts=[]; let guard=0; while(i<R.n && guard++<200){ const c=speechChunk(i,max,max>8?6:2); parts.push(c.text); if(c.j<=i) break; i=c.j; }
      outs.push({max, st, t:parts.join(' | ')});
    }
    Object.assign(R,{words:save.w,n:save.n,blocks:save.b,wf:save.wf,notes:save.notes,ends:save.ends}); R._nb=null;
    return outs;
  });
  const bad=[]; const checks=[['Isaiah chapter 43 verse 7','43:7'],['Psalm 90 verse 14','90:14'],['Matthew chapter 22 verse 37','22:37'],['Revelation chapter 3 verse 16','3:16'],['First Corinthians chapter 10 verse 31','10:31']];
  const W='The well-lived life must be God-exalting and soul-satisfying because that is why God created us (Isa. 43:7; Ps. 90:14). That was the burden of chapter 2. And God commands us to love him with all our heart (Matt. 22:37), and Jesus reminds us that he spits lukewarm people out of his mouth (Rev. 3:16). The opposite of wasting your life is to live (1 Cor. 10:31). As C. S. Lewis said, see Dr. Smith.'.split(' ');
  for(const o of res){
    const flat=o.t.replace(/ \| /g,' ');
    for(const [want,ref] of checks){ const at=W.findIndex(w=>w.includes(ref)); if(o.st<=at-2 && !flat.includes(want)) bad.push([o.max,o.st,want,flat.slice(0,400)]); }
    if(/\bP\.?S\.?\b|Isa\.|Ps\.|\d+:\d+/.test(flat)) bad.push([o.max,o.st,'raw',flat.slice(0,300)]);
  }
  ok('references read in full wherever reading starts or splits ('+res.length+' runs)', bad.length===0, bad.slice(0,4));
  console.log(res.find(o=>o.max===55&&o.st===0).t);
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
