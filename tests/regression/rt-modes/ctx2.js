const H=require('./h.js');
(async()=>{
  const b=await H.launch();
  const pg=await H.page(b,{settings:{mode:'speed',focus:false,context:true}});
  await pg.evaluate(()=>openDoc(LIB[0].id)); await H.sleep(500);
  await pg.click('#rAa'); await H.sleep(600);
  await pg.evaluate(()=>{ window.__ev=[]; $('#o_context').addEventListener('change',e=>__ev.push('change '+e.target.checked)); $('#o_context').addEventListener('click',e=>__ev.push('click '+e.target.checked+' dp='+e.defaultPrevented)); });
  await pg.click('#o_context'); await H.sleep(200);
  console.log('ctxvis',await pg.evaluate(()=>getComputedStyle($('#context')).visibility)); console.log(await pg.evaluate(()=>[__ev, $('#o_context')&&$('#o_context').checked, S.context, !!$('#o_context').isConnected]));
  // other toggles
  for(const k of ['ramp','multi','adaptive','longWord','boldText']){ const before=await pg.evaluate((k)=>S[k],k); await pg.click('#o_'+k); await H.sleep(150); console.log(k, before,'->', await pg.evaluate((k)=>S[k],k)); }
  await b.close();
})();
