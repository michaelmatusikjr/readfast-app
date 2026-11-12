const H=require('./h.js');
const TTF='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf';
(async()=>{
  const b=await H.launch();
  const fontRoute=async(ctx)=>{
    await ctx.route(/fonts\.googleapis\.com/,r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Literata';font-weight:400;src:url(https://fonts.gstatic.com/lit.ttf) format('truetype')}`}));
    await ctx.route(/fonts\.gstatic\.com/,async r=>{ await H.sleep(2500); r.fulfill({path:TTF,contentType:'font/ttf'}); });
  };
  const pg=await H.page(b,{fontRoute,settings:{mode:'speed',focus:false,font:'original',context:true}});
  await pg.evaluate(()=>openDoc(LIB[0].id)); await H.sleep(500);
  await pg.click('#rAa'); await H.sleep(200);
  console.log('ctx checkbox', await pg.evaluate(()=>[...document.querySelectorAll('#o_context')].map(x=>x.checked)), 'vis', await pg.evaluate(()=>getComputedStyle($('#context')).visibility));
  await pg.click('#o_context'); await H.sleep(200);
  console.log('after click', await pg.evaluate(()=>[S.context, getComputedStyle($('#context')).visibility]));
  await pg.evaluate(()=>closeSheet()); await pg.evaluate(()=>switchMode('pages')); await H.sleep(300);
  // default font Literata arriving late: reload page fresh and open in pages
  const pg2=await H.page(b,{fontRoute,settings:{mode:'pages',focus:false,font:'original',turn:'none'}});
  await pg2.evaluate(()=>{ S.size=19; }); 
  await pg2.evaluate(()=>openDoc(LIB[0].id)); await H.sleep(300);
  const p0=await pg2.evaluate(()=>[P.pages, document.fonts.check('19px Literata')]);
  await H.sleep(3500);
  console.log('literata late: at open', p0, 'after load', await pg2.evaluate(()=>{ const cols=Math.round((pgFlow.scrollWidth+P.g.gap)/(P.g.cw+P.g.gap)); return {stored:P.pages, actual:Math.ceil(cols/P.g.colsPer), loaded:document.fonts.check('19px Literata')}; }));
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
