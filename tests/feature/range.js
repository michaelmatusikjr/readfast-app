const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await b.newContext({serviceWorkers:'block'})).newPage(); await pg.addInitScript(()=>{window.__toozKeepSample=true});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  const mk=async(id,txt,pre)=>pg.evaluate(async([id,txt,pre])=>{
    closeSheet(); const words=txt.split(' ');
    const text={id, words, ends:[words.length-1], blocks:[{s:0,e:words.length,t:'p'}], wf:null, notes:null, breaks:null, secs:null};
    if(pre){ /* simulate a book split by the Nov 13 version: "3:7–8" stored as "3:7–" + glued "8" */
      const k=words.indexOf('3:7–8).'); words.splice(k,1,'3:7–','8).'); text.ends=[words.length-1]; text.blocks=[{s:0,e:words.length,t:'p'}];
      text.wf=new Uint8Array(words.length); text.wf[k+1]=F_GLUE; text.dashSplit=1; }
    await Store.put('texts',text);
    const m={id,title:id,author:'',kind:'text',count:words.length,chapters:[{t:'Start',i:0,d:0}],pos:0,highlights:[],bookmarks:[],added:Date.now(),lastRead:Date.now(),mod:Date.now(),tags:[]};
    if(pre){ m.dashSplit=1; m.pos=words.indexOf('years'); m.highlights=[{s:words.indexOf('8).'),e:words.indexOf('years'),c:1,at:1}]; m.bookmarks=[{i:words.indexOf('quickly'),at:1}]; }
    LIB.push(m); touch(m); await openDoc(id); await new Promise(r=>setTimeout(r,600));
    const M=R.meta; return {pos:R.words[R.pos], hl:M.highlights[0]&&[R.words[M.highlights[0].s],R.words[M.highlights[0].e]], bm:M.bookmarks[0]&&R.words[M.bookmarks[0].i], n:R.n, w:R.words.slice(0,12), t:speechChunk(0,60,6).text+' '+speechChunk(R.words.indexOf('The'),60,6).text};
  },[id,txt,pre]);
  const txt='Paul counted it loss (Phil. 3:7–8). The years 1990–2000 passed quickly and then more words follow here.';
  const a=await mk('rng1',txt,false);
  ok('new books keep 3:7–8 whole', a.w.includes('3:7–8).'), a.w);
  ok('reads verses 7 through 8', /Philippians chapter 3 verses 7 through 8/.test(a.t) && /1990 to 2000/.test(a.t), a.t);
  const c=await mk('rng2',txt,true);
  ok('already-split books are joined back, places kept', c.w.includes('3:7–8).') && c.pos==='years' && c.hl[0]==='3:7–8).' && c.hl[1]==='years' && c.bm==='quickly' && c.n===a.n, c);
  ok('already-split books read it right too', /Philippians chapter 3 verses 7 through 8/.test(c.t) && !/7\.\.\./.test(c.t), c.t);
  ok('no page errors', !errs.length, errs);
  await b.close();
})();
