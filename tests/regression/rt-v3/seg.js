const H=require('../rt-modes/h.js');
(async()=>{ const b=await H.launch();
 for(const [w,h,f] of [[390,780,H.FILES+'epub_large.epub'],[390,780,H.RICH],[844,390,H.RICH],[390,780,H.FILES+'epub3_nested.epub']]){ const pg=await H.page(b,{w,h});
  const id=await H.importBook(pg,f); await pg.evaluate(id=>openDoc(id),id); await H.sleep(1200);
  await pg.evaluate(()=>{ for(let k=0;k<12;k++) R.meta.bookmarks.push({i:k*20,name:'bm'+k,at:1}); for(let k=0;k<12;k++) R.meta.highlights.push({id:'h'+k,s:k*30,e:k*30+5,c:1,note:'n'}); });
  for(const t of ['toc','marks','hls']){ await pg.evaluate(t=>openToc(t),t); await H.sleep(300);
   const r=await pg.evaluate(()=>{ const s=$('#sheet .seg').getBoundingClientRect(); const bd=$('#sheet .sheet-body'); const kids=[...bd.children].map(c=>[c.className||c.tagName,Math.round(c.getBoundingClientRect().height)]); return {segH:s.height, n:R.meta.chapters.length, kids:kids.slice(0,5), bodyH:bd.clientHeight, scrollH:bd.scrollHeight}; });
   console.log(w+'x'+h,f.split('/').pop(),t,JSON.stringify(r)); await pg.screenshot({path:`seg_${w}_${f.split('/').pop()}_${t}.png`}); }
  await pg.context().close(); }
 await b.close(); })();
