const H=require('../rt-modes/h.js');
const TTF='/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf';
(async()=>{
  const b=await H.launch();
  const fontRoute=async(ctx)=>{
    await ctx.route(/fonts\.googleapis\.com/,r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Literata';font-weight:400;src:url(https://fonts.gstatic.com/lit${Math.random()}.ttf) format('truetype')}`}));
    await ctx.route(/fonts\.gstatic\.com/,async r=>{ await H.sleep(5000); r.fulfill({path:TTF,contentType:'font/ttf'}); });
  };
  const pg=await H.page(b,{fontRoute,settings:{mode:'pages',font:'original'}});
  const id=await H.importBook(pg,H.FILES+'epub_large.epub');
  const pg2=await pg.context().newPage(); pg2.errs=[]; pg2.on('pageerror',e=>pg2.errs.push(e.message)); pg2.on('console',m=>{ if(m.type()==='error') pg2.errs.push(m.text()); });
  await pg2.goto('http://localhost:8750/'); await H.sleep(300);
  const r=await pg2.evaluate(async(id)=>{ const p=openDoc(id); 
    for(let i=0;i<200;i++){ await new Promise(r=>setTimeout(r,10)); if(!$('#v-reader').hidden && !R.mode) break; }
    const vis=!$('#v-reader').hidden; $('#rBack').click(); const afterClick=[!!R.meta, R.mode, $('#v-reader').hidden];
    await p; await new Promise(r=>setTimeout(r,300));
    return {vis, afterClick, end:[!!R.meta, R.mode, $('#v-reader').hidden, $('#v-library')?$('#v-library').hidden:'?', document.querySelector('#toastMsg').textContent]}; }, id);
  console.log(JSON.stringify(r), pg2.errs.filter(e=>!/ERR_FAILED/.test(e)));
  await pg2.screenshot({path:__dirname+'/shots/race.png'});
  await b.close();
})();
