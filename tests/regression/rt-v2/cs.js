const H=require(process.env.HP||'../rt-modes/h.js'); const fs=require('fs');
(async()=>{
  const b=await H.launch(); const pg=await H.page(b,{});
  for(const f of fs.readdirSync(__dirname+'/cs').sort()){
    try{ const id=await H.importBook(pg,__dirname+'/cs/'+f); const t=await pg.evaluate(async(id)=>{ const t=await Store.get('texts',id); return t.words.join(' '); },id); console.log(f.padEnd(24),t); }catch(e){ console.log(f,'ERR',e.message.slice(0,100)); }
  }
  console.log(pg.errs.filter(e=>!/ERR_FAILED/.test(e)));
  await b.close();
})();
