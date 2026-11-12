// focus-mode screenshots, keyboard on focused buttons, panel context toggle, late web-font relayout, swipe
const H=require('./h.js'); const SH=__dirname+'/shots/'; const fs=require('fs');
const TTF='/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf';
(async()=>{
  const b=await H.launch();
  // late-loading web font: Google CSS served immediately, font file delayed 2s
  const fontRoute=async(ctx)=>{
    await ctx.route(/fonts\.googleapis\.com/,r=>r.fulfill({contentType:'text/css',body:`@font-face{font-family:'Lexend';font-weight:400;src:url(https://fonts.gstatic.com/lexend.ttf) format('truetype')}`}));
    await ctx.route(/fonts\.gstatic\.com/,async r=>{ await H.sleep(2000); r.fulfill({path:TTF,contentType:'font/ttf'}); });
  };
  for(const [w,h] of [[390,780],[844,390]]){
    const pg=await H.page(b,{w,h,fontRoute,settings:{mode:'pages',focus:true,font:'original',turn:'none'}});
    const rich=await H.importBook(pg,H.RICH);
    await pg.evaluate((id)=>openDoc(id),rich); await H.sleep(800);
    await pg.evaluate(()=>{ pgTurn(1); }); await H.sleep(400);
    await pg.screenshot({path:SH+`focus_pages_${w}.png`});
    console.log(w,'chrome after turn', await pg.evaluate(()=>R.chrome), 'flow box', await pg.evaluate(()=>{ const r=pgFlow.getBoundingClientRect(); const v=$('#rBody').getBoundingClientRect(); return [Math.round(v.top),Math.round(v.bottom),Math.round(r.top),Math.round(r.bottom), innerHeight]; }));
    if(w===390){
      // late font
      await pg.evaluate(()=>{ S.font='lexend'; afterSet('font'); }); await H.sleep(3500);
      console.log('after late font', await pg.evaluate(()=>{ const fr=pgFlow.getBoundingClientRect(); const cols=Math.round((pgFlow.scrollWidth+P.g.gap)/(P.g.cw+P.g.gap)); let off=0; const sec=pgFlow.firstElementChild; for(const w of sec._ws){ const r=w.getClientRects()[0]; if(r && r.top-fr.top+r.height>pgFlow.clientHeight+2) off++; }
        return {pagesStored:P.pages, pagesActual:Math.ceil(cols/P.g.colsPer), fontLoaded:document.fonts.check('16px Lexend'), wordOfPos:pgPageOfEl(wordEl(R.pos)), shownPage:P.page, pos:R.pos}; }));
      await pg.screenshot({path:SH+'late_font.png'});
      // keyboard: click TOC button, close sheet, press space
      await pg.evaluate(()=>{ S.font='original'; afterSet('font'); }); await H.sleep(500);
      await pg.evaluate(()=>setChrome(true));
      await pg.click('#rToc'); await H.sleep(200); await pg.evaluate(()=>closeSheet()); await H.sleep(100);
      const a=await pg.evaluate(()=>[P.page]);
      await pg.keyboard.press(' '); await H.sleep(300);
      console.log('space with focus on TOC button: page', a, '->', await pg.evaluate(()=>[P.page, !$('#sheet').hidden]));
      // panel: context toggle in speed mode
      await pg.evaluate(()=>switchMode('speed')); await H.sleep(500);
      await pg.evaluate(()=>{ S.context=true; afterSet('context'); renderContext(); });
      await pg.click('#rAa'); await H.sleep(200);
      const v0=await pg.evaluate(()=>getComputedStyle($('#context')).visibility);
      await pg.evaluate(()=>{ const t=$('#o_context'); t.click(); }); await H.sleep(200);
      console.log('context toggle in panel: before', v0, 'after', await pg.evaluate(()=>[S.context, getComputedStyle($('#context')).visibility]));
      await pg.evaluate(()=>closeSheet());
      // speed: tap the visible sentence context word (should jump, paused)
      await pg.evaluate(()=>switchMode('pages')); await H.sleep(400);
    }
    if(w===844){
      // scroll mode in landscape focus
      await pg.evaluate(()=>switchMode('scroll')); await H.sleep(500);
      await pg.mouse.move(400,200); await pg.mouse.wheel(0,300); await H.sleep(500);
      await pg.screenshot({path:SH+`focus_scroll_${w}.png`});
    }
    console.log('errs',pg.errs.filter(e=>!/ERR_FAILED/.test(e)));
    await pg.context().close();
  }
  await b.close();
})().catch(e=>{ console.error('FAIL',e); process.exit(1); });
