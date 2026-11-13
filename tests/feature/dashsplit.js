const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await (await b.newContext({viewport:{width:393,height:852},serviceWorkers:'block'})).newPage(); await pg.addInitScript(()=>{window.__toozKeepSample=true});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  /* make an old-style book: pasted text with dash-joined words, highlight + bookmark + position after the dash */
  const res=await pg.evaluate(async()=>{
    closeSheet();
    const txt='The number comes from Isaiah 26:8—“Yes, Lord, walking in the way of your laws, we wait for you.” God created me—and you—to live with a single passion. Another sentence follows here for padding and more words to read.';
    const id='dashtest'; const words=txt.split(' ');
    const text={id, words, ends:[words.length-1], blocks:[{s:0,e:words.length,t:'p'}], wf:null, notes:null, breaks:null, secs:null};
    await Store.put('texts',text);
    const m={id,title:'Dash test',author:'',kind:'text',count:words.length,chapters:[{t:'Start',i:0,d:0}],pos:words.indexOf('single'),highlights:[{s:words.indexOf('me—and'),e:words.indexOf('live'),c:2,at:1}],bookmarks:[{i:words.indexOf('with'),at:1}],added:Date.now(),lastRead:Date.now(),mod:Date.now(),tags:[]};
    LIB.push(m); touch(m); LS.set('pos.'+id,{pos:m.pos,t:Date.now()});
    const before={pos:words[m.pos], hl:[words[m.highlights[0].s],words[m.highlights[0].e]], bm:words[m.bookmarks[0].i]};
    await openDoc(id); await new Promise(r=>setTimeout(r,800));
    const W=R.words, M=R.meta;
    return {before, after:{pos:W[R.pos], hl:[W[M.highlights[0].s],W[M.highlights[0].e]], bm:W[M.bookmarks[0].i]}, split:W.slice(W.indexOf('Isaiah'),W.indexOf('Isaiah')+4), me:W.slice(W.indexOf('created'),W.indexOf('created')+5), n:R.n, count:M.count, flag:R.text.dashSplit};
  });
  ok('words split at dashes', JSON.stringify(res.after && res.split)==JSON.stringify(['Isaiah','26:8—','“Yes,','Lord,']) && res.me.join(' ')==='created me— and you— to', res);
  ok('position, highlight, bookmark kept on the same words', res.before.pos===res.after.pos && res.after.hl[0]==='me—' && res.after.hl[1]==='live' && res.before.bm===res.after.bm, res);
  ok('display joins split words without a space', await pg.evaluate(()=>/Isaiah 26:8—“Yes,/.test((document.querySelector('#pagesView')||document.body).textContent.replace(/\s+/g,' '))));
  const sp=await pg.evaluate(()=>{ const k=R.words.indexOf('Isaiah'); return speechChunk(Math.max(0,k-3),40,60).text; });
  ok('reads Isaiah chapter 26 verse 8 with a pause', /Isaiah chapter 26 verse 8\.\.\. “Yes/.test(sp), sp);
  ok('space after the dash pause', /me\.\.\. and you\.\.\. to live/.test(sp), sp);
  ok('can select up to the dash', await pg.evaluate(()=>{ const a=R.words.indexOf('Isaiah'), b=a+1; tsSet(a,b); return textOf(TS.a,TS.b); })==='Isaiah 26:8—');
  ok('second open does not convert again', await pg.evaluate(async()=>{ const n=R.n; await openDoc('dashtest'); return R.n===n; }));
  ok('no page errors', errs.length===0, errs);
  await b.close();
})();
