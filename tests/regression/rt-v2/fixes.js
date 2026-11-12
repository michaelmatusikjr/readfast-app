const H=require('../rt-modes/h.js');
(async()=>{
  const b=await H.launch();
  const ctx=await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs|fonts\./,r=>r.abort());
  const pg=await ctx.newPage();
  await pg.addInitScript(()=>{ if(!sessionStorage.x){ sessionStorage.x=1; localStorage.setItem('rf.settings', JSON.stringify({font:'georgia',fontSize:40,theme:'dark',wpm:420})); } });
  await pg.goto('http://localhost:8750/'); await H.sleep(600);
  console.log('migration', await pg.evaluate(()=>[S.speedFont,S.speedSize,S.font,S.wpm,getComputedStyle(document.documentElement).getPropertyValue('--rfont')]));
  // pre gaps + deriveBlocks
  console.log('pre/derive', await pg.evaluate(()=>{
    const d=document.createElement('div'); d.innerHTML='<pre>line one\n\nline three\n\n\nline six</pre>';
    const ctx={words:[],ends:[],blocks:[],notes:[],imgs:[],wf:[]}; try{ walkHTML(d,ctx,'x.html'); }catch(e){ return 'walk err '+e.message; }
    const db=deriveBlocks({words:'Chapter One Some text here. Another para here.'.split(' '),ends:[1,4,7]},[{i:0,t:'Chapter One'},{i:2,t:'Part Two'}]);
    return [JSON.stringify(ctx.blocks), JSON.stringify(db)];
  }));
  await b.close();
})();
