const H=require('../rt-modes/h.js');
(async()=>{ const b=await H.launch();
 for(const [w,h] of [[390,780],[844,390],[375,667]]){ const pg=await H.page(b,{w,h});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  const meas=async(name)=>{ await H.sleep(350); const r=await pg.evaluate(()=>{ const bd=$('#sheet .sheet-body'); if($('#sheet').hidden||!bd) return null; const hs=()=>[...bd.children].map(c=>Math.round(c.getBoundingClientRect().height)); const a=hs(); const st=document.createElement('style'); st.textContent='.sheet-body>*{flex-shrink:0!important}'; document.head.appendChild(st); const b2=hs(); st.remove(); return [...bd.children].map((c,i)=>[(c.className||c.tagName)+'',a[i],b2[i]]).filter(x=>x[1]!==x[2]); }); console.log(w+'x'+h,name,r===null?'NO SHEET':JSON.stringify(r)); await pg.evaluate(()=>closeSheet()); };
  await pg.evaluate(()=>openPaste(false)); await meas('paste');
  await pg.evaluate(()=>openLink()); await meas('link');
  await pg.evaluate(()=>{ document.querySelector('#docList .doc .more').click(); }); await meas('docmenu');
  await pg.evaluate(id=>openDoc(id),id); await H.sleep(1200);
  await pg.evaluate(()=>{ const h=addHighlight(5,400,1,'note '.repeat(60)); openHlMenu(h); }); await meas('hlmenu');
  await pg.evaluate(()=>{ openSearch(); $('#srchIn').value='the'; runSearch(); }); await meas('search');
  await pg.evaluate(()=>defineWord('extraordinarily',5)); await meas('lookup');
  for(const m of ['pages','scroll','speed']){ await pg.evaluate(m=>switchMode(m),m); await H.sleep(500); await pg.evaluate(()=>openPanel()); await meas('panel '+m); }
  await pg.evaluate(()=>{ switchMode('pages'); }); await H.sleep(400); await pg.evaluate(()=>closeReader()); await H.sleep(200);
  await pg.evaluate(()=>{ showView('words'); document.querySelector('#wordList .grow').click(); }); await meas('word');
  await pg.context().close(); }
 await b.close(); })();
