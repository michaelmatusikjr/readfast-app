// default font (Literata via Google Fonts) arriving after the book is paginated
const H=require('./h.js');
const TTF='/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf';
(async()=>{
  const b=await H.launch();
  const fontRoute=async(ctx)=>{
    await ctx.route(/fonts\.googleapis\.com/,r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Literata';font-weight:400;src:url(https://fonts.gstatic.com/lit${Math.random()}.ttf) format('truetype')}`}));
    await ctx.route(/fonts\.gstatic\.com/,async r=>{ await H.sleep(2500); r.fulfill({path:TTF,contentType:'font/ttf'}); });
  };
  const pg=await H.page(b,{fontRoute,settings:{mode:'pages',focus:false,font:'original',turn:'none'}});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  // new page so Literata isn't loaded yet
  const pg2=await pg.context().newPage(); await pg2.goto('http://localhost:8750/'); await H.sleep(500);
  await pg2.evaluate((id)=>openDoc(id),id); await H.sleep(900);
  await pg2.evaluate(()=>goTo(R.SEC[100][0]+300)); await H.sleep(100);
  const a=await pg2.evaluate(()=>({nextFirst:pgFirstWord(P.page+1),ff:getComputedStyle(pgFlow).fontFamily,actual:Math.ceil(Math.round((pgFlow.scrollWidth+P.g.gap)/(P.g.cw+P.g.gap))/P.g.colsPer),pages:P.pages,page:P.page,pos:R.pos,loaded:document.fonts.check('19px Literata'),n:R.n,secs:R.SEC.length}));
  await H.sleep(4000);
  const c=await pg2.evaluate(()=>{ const cols=Math.round((pgFlow.scrollWidth+P.g.gap)/(P.g.cw+P.g.gap)); return {nextFirst:pgFirstWord(P.page+1),rangeEnd:P.rangeEnd,stored:P.pages, actual:Math.ceil(cols/P.g.colsPer), page:P.page, posOnPage:pgPageOfEl(wordEl(R.pos)), loaded:document.fonts.check('19px Literata')}; });
  console.log('before font', a, 'after', c);
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
