// scroll mode: load/unload sections while scrolling both ways, check top word continuity; relayout keeps place
const H=require('./h.js'); const SH=__dirname+'/shots/';
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{settings:{mode:'scroll',focus:false,autoScroll:false}});
  const big=await H.importBook(pg,H.FILES+'epub_large.epub');
  await pg.evaluate((id)=>openDoc(id),big); await H.sleep(1200);
  await pg.evaluate(()=>goTo(R.SEC[50][0]+20)); await H.sleep(600);
  // scroll down in wheel steps; record top word each step
  const run=async(dir,steps)=>{ const out={jumps:[],dups:0,maxKids:0,start:await pg.evaluate(()=>scPos())};
    for(let s=0;s<steps;s++){ const before=await pg.evaluate(()=>scPos()); await pg.mouse.move(195,400); await pg.mouse.wheel(0,dir*700); await H.sleep(120);
      const st=await pg.evaluate(()=>({p:scPos(), kids:[...scFlow.children].map(x=>x._k), pos:R.pos}));
      const ks=st.kids; if(new Set(ks).size!==ks.length) out.dups++; for(let q=1;q<ks.length;q++) if(ks[q]!==ks[q-1]+1) out.dups++;
      out.maxKids=Math.max(out.maxKids,ks.length);
      const d=(st.p-before)*dir; if(d<0||d>400) out.jumps.push([before,st.p,ks.join(',')]); }
    out.end=await pg.evaluate(()=>scPos()); return out; };
  const down=await run(1,120); console.log('down', JSON.stringify({...down,jumps:down.jumps.slice(0,5),nj:down.jumps.length}));
  const up=await run(-1,120); console.log('up', JSON.stringify({...up,jumps:up.jumps.slice(0,5),nj:up.jumps.length}));
  // fast scroll programmatic (fling) — set scrollTop big
  const fl=await pg.evaluate(async()=>{ const a=scPos(); scView.scrollTop+=scView.clientHeight*12; await new Promise(r=>setTimeout(r,400)); return [a,scPos(),[...scFlow.children].map(x=>x._k).join(',')]; });
  console.log('fling', fl);
  // relayout: change size and margins, check top word stays
  const rl=[];
  for(const [k,v] of [['size',24],['margin','wide'],['lineH',2],['size',16],['font','georgia']]){
    const a=await pg.evaluate(()=>R.pos);
    await pg.evaluate(([k,v])=>{ S[k]=v; afterSet(k); },[k,v]); await H.sleep(700);
    rl.push(`${k}=${v}: ${a}->${await pg.evaluate(()=>R.pos)} (top ${await pg.evaluate(()=>scPos())})`);
  }
  console.log('scroll relayout', rl.join(' | '));
  // pages relayout drift
  await pg.evaluate(()=>switchMode('pages')); await H.sleep(500);
  await pg.evaluate(()=>{ for(let i=0;i<3;i++) pgTurn(1); }); await H.sleep(800);
  const pr=[];
  for(const [k,v] of [['size',24],['margin','narrow'],['lineH',1.3],['size',19],['justify',false],['margin','normal'],['lineH',1.55]]){
    const a=await pg.evaluate(()=>[R.pos,P.page]);
    await pg.evaluate(([k,v])=>{ S[k]=v; afterSet(k); },[k,v]); await H.sleep(600);
    const c=await pg.evaluate(()=>[R.pos,P.page,pgFirstWord(P.page),P.rangeEnd]);
    pr.push(`${k}=${v}: pos ${a[0]}->${c[0]} page[${c[2]}..${c[3]})${c[0]>=c[2]&&c[0]<c[3]?'':' NOT VISIBLE'}`);
  }
  console.log('pages relayout', pr.join(' | '));
  // resize (rotate) pages
  const r0=await pg.evaluate(()=>R.pos);
  await pg.setViewportSize({width:780,height:390}); await H.sleep(700);
  const r1=await pg.evaluate(()=>[R.pos,P.g.two,pgFirstWord(P.page),P.rangeEnd]);
  await pg.setViewportSize({width:390,height:780}); await H.sleep(700);
  console.log('rotate', r0, r1, await pg.evaluate(()=>[R.pos,pgFirstWord(P.page),P.rangeEnd]));
  console.log('errs',pg.errs);
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
