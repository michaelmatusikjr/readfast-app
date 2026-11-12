// shared harness
const { chromium } = require('/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/tooz/t/node_modules/playwright-core');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const FILES=EP+'files/';
const RICH='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/tooz/t/rich.epub';
const LIB={'jszip.min.js':EP+'node_modules/jszip/dist/jszip.min.js','pdf.min.js':EP+'node_modules/pdfjs-dist/build/pdf.min.js','pdf.worker.min.js':EP+'node_modules/pdfjs-dist/build/pdf.worker.min.js'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(){ return chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}); }
async function page(b, {w=390,h=780,touch=true,settings=null,fontRoute=null}={}){
  const ctx=await b.newContext({viewport:{width:w,height:h}, deviceScaleFactor:2, serviceWorkers:'block', hasTouch:touch, isMobile:touch}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>{ const k=Object.keys(LIB).find(k=>r.request().url().endsWith('/'+k)); return k?r.fulfill({path:LIB[k],contentType:'application/javascript'}):r.abort(); });
  if(fontRoute) await fontRoute(ctx); else await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); pg.errs=[]; pg.on('pageerror',e=>pg.errs.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error') pg.errs.push('console '+m.text()); });
  if(settings) await pg.addInitScript((s)=>{ try{ const o=JSON.parse(localStorage.getItem('rf.settings')||'{}'); localStorage.setItem('rf.settings', JSON.stringify(Object.assign({v:2},o,s))); }catch(e){} }, settings);
  await pg.goto((process.env.PORT?'http://localhost:'+process.env.PORT+'/':'http://localhost:8750/')); await sleep(700);
  return pg;
}
async function importBook(pg, path, title){
  await pg.setInputFiles('#fileIn', path);
  await pg.waitForFunction(()=>!document.querySelector('#toast')||true);
  await pg.waitForFunction((n)=>LIB.length>n, await pg.evaluate(()=>LIB.length-1), {timeout:60000});
  await sleep(500);
  return pg.evaluate(()=>LIB.slice().sort((a,b)=>(b.added||b.mod||0)-(a.added||a.mod||0))[0].id);
}
module.exports={launch,page,importBook,sleep,FILES,RICH};
