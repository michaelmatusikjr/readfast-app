// pagination: every word lands fully inside exactly one visible page; walk pgTurn through sections
const H=require('./h.js');
const SHOTS=__dirname+'/shots/'; require('fs').mkdirSync(SHOTS,{recursive:true});
(async()=>{
  const b=await H.launch();
  for(const [w,h] of [[390,780],[844,390]]){
    const pg=await H.page(b,{w,h,settings:{mode:'pages',focus:false}});
    const books={sample:await pg.evaluate(()=>LIB[0].id)};
    books.rich=await H.importBook(pg,H.RICH);
    books.img=await H.importBook(pg,H.FILES+'epub_imgheavy.epub');
    books.images=await H.importBook(pg,H.FILES+'epub_images.epub');
    for(const [name,id] of Object.entries(books)){
      await pg.evaluate((id)=>openDoc(id),id); await H.sleep(700);
      const res=await pg.evaluate(async()=>{
        const out={secs:R.SEC.length, two:P.g.two, bad:[], pages:0, gaps:[], imgBad:[]};
        for(let k=0;k<R.SEC.length;k++){
          await pgShow(R.SEC[k][0]); await new Promise(r=>setTimeout(r,60));
          const fr=pgFlow.getBoundingClientRect(), H=pgFlow.clientHeight, g=P.g;
          out.pages+=P.pages;
          const sec=pgFlow.firstElementChild; const seen=new Set();
          for(let j=0;j<sec._ws.length;j++){
            const w=sec._ws[j]; const rr=w.getClientRects(); if(!rr.length){ out.bad.push([k,j,'norect']); continue; }
            for(const r of rr){ const x=r.left-fr.left, y=r.top-fr.top; const pgI=Math.floor((x+2)/g.stride); const xin=x-pgI*g.stride;
              if(xin<-1 || xin+r.width>g.inner+2 || y<-1 || y+r.height>H+2){ if(out.bad.length<12) out.bad.push([k,j,R.words[sec._a+j],Math.round(xin),Math.round(y),Math.round(r.width),Math.round(r.height),H]); }
              seen.add(pgI);
            }
          }
          for(const fig of sec.querySelectorAll('figure img')){ const r=fig.getBoundingClientRect(); const y=r.top-fr.top; const x=r.left-fr.left; const pgI=Math.floor((x+2)/g.stride); const xin=x-pgI*g.stride; if(y<-1||y+r.height>H+2||xin+r.width>g.inner+2) out.imgBad.push([k,Math.round(y),Math.round(r.height),H,Math.round(xin),Math.round(r.width)]); }
          // pages with no words (blank pages) that are not image pages
          for(let p=0;p<P.pages;p++){ if(!seen.has(p)){ const figs=[...sec.querySelectorAll('figure')].filter(f=>Math.floor((f.getBoundingClientRect().left-fr.left+2)/g.stride)===p).length; out.gaps.push([k,p,P.pages,figs?'img':'BLANK']); } }
        }
        return out;
      });
      console.log(w+'x'+h, name, JSON.stringify({secs:res.secs,two:res.two,pages:res.pages,bad:res.bad.slice(0,6),nbad:res.bad.length,imgBad:res.imgBad.slice(0,4),nImgBad:res.imgBad.length,gaps:res.gaps.filter(g=>g[3]==='BLANK').slice(0,6),imgOnly:res.gaps.filter(g=>g[3]==='img').length}));
      // walk with pgTurn from start to end, check R.pos monotonic and words all covered
      const walk=await pg.evaluate(async()=>{
        await goTo(0); let last=-1, turns=0, nonmono=0; const cover=[];
        while(turns<4000){ const a=R.pos; if(a<last) nonmono++; last=a; cover.push([P.k,P.page,a,P.rangeEnd]); const k0=P.k,p0=P.page; await pgTurn(1); await new Promise(r=>setTimeout(r,S.turn==='slide'?5:150)); turns++; if(P.k===k0&&P.page===p0) break; }
        // gaps: rangeEnd of page != first word of next
        let holes=0; for(let q=0;q+1<cover.length;q++){ if(cover[q][3]!==cover[q+1][2]) holes++; }
        return {turns, nonmono, holes, ex:cover.filter((c,q)=>q+1<cover.length&&c[3]!==cover[q+1][2]).slice(0,4)};
      });
      console.log('   walk', JSON.stringify(walk));
      if(name==='rich'||name==='img'){ await pg.evaluate(()=>goTo(0)); await pg.evaluate(()=>pgTurn(1)); await H.sleep(500); await pg.screenshot({path:SHOTS+`pg_${name}_${w}.png`}); }
    }
    console.log('errs', pg.errs);
    await pg.context().close();
  }
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
