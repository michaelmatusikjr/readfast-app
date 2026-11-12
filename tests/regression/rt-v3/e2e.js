const { chromium } = require('../tooz/t/node_modules/playwright-core'); const fs=require('fs');
const SP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/'; const EP=SP+'redteam-epub/';
const LIBS={'jszip.min.js':EP+'node_modules/jszip/dist/jszip.min.js','pdf.min.js':EP+'node_modules/pdfjs-dist/build/pdf.min.js','pdf.worker.min.js':EP+'node_modules/pdfjs-dist/build/pdf.worker.min.js'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const [W,Hh]=(process.argv[2]||'390x780').split('x').map(Number); const T=W+'_';
(async()=>{ const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await b.newContext({viewport:{width:W,height:Hh},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true,isMobile:true,acceptDownloads:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
 await ctx.route(/cdnjs/,r=>{ const k=Object.keys(LIBS).find(k=>r.request().url().endsWith('/'+k)); return k?r.fulfill({path:LIBS[k],contentType:'application/javascript'}):r.abort(); });
 await ctx.route(/fonts\.(googleapis|gstatic)|allorigins|corsproxy|example\.com/,r=>r.abort());
 await ctx.addInitScript(()=>{ const U=[]; window.__spoken=U; class Utt{ constructor(t){ this.text=t; } } window.SpeechSynthesisUtterance=Utt;
   const ss={speaking:false, getVoices:()=>[{voiceURI:'v1',name:'Samantha',lang:'en-US',localService:true}], addEventListener(){}, cancel(){ this._c=(this._c||0)+1; }, speak(u){ U.push(u.text); const c=this._c||0; const ws=[...u.text.matchAll(/\S+/g)]; let k=0; const tick=()=>{ if((this._c||0)!==c) return; if(k<ws.length){ u.onboundary&&u.onboundary({name:'word',charIndex:ws[k].index}); k++; setTimeout(tick,25); } else u.onend&&u.onend({}); }; setTimeout(tick,25); } };
   Object.defineProperty(window,'speechSynthesis',{value:ss,configurable:true}); });
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error'&&!/ERR_FAILED/.test(m.text())) errs.push('console '+m.text()); });
 let n=0; const shot=async(name)=>{ await pg.screenshot({path:`shots/${T}${String(++n).padStart(2,'0')}_${name}.png`}); };
 const log=(...a)=>console.log(...a.map(x=>typeof x==='string'?x:JSON.stringify(x)));
 const st=()=>pg.evaluate(()=>({mode:R.mode,pos:R.pos,page:P.page,pages:P.pages,chrome:R.chrome,playing:R.playing,auto:SC.auto,tts:TTS.on,sheet:!$('#sheet').hidden&&$('#sheet h2').textContent,toast:!$('#toast').hidden&&$('#toastMsg').textContent}));
 const tapSel=async s=>{ await pg.locator(s).first().scrollIntoViewIfNeeded().catch(()=>{}); const bx=await pg.locator(s).first().boundingBox(); if(!bx) throw new Error('no box '+s); await pg.touchscreen.tap(bx.x+bx.width/2,bx.y+bx.height/2); await sleep(350); };
 const tap=async(x,y)=>{ await pg.touchscreen.tap(x*W,y*Hh); await sleep(450); };
 await pg.goto('http://localhost:8750/'); await sleep(900); await shot('library_fresh');
 log('lib',await pg.evaluate(()=>LIB.map(m=>m.title)));
 await tapSel('#docList .doc'); await sleep(900); log('open sample',await st()); await shot('sample_pages');
 await tap(.9,.5); log('fwd1',await st()); await tap(.9,.5); log('fwd2',await st()); await shot('sample_p2'); await tap(.1,.5); log('back',await st()); await tap(.5,.5); log('mid',await st());
 await tapSel('#rBack'); await sleep(400); log('closed', await pg.evaluate(()=>[R.mode, !$('#v-library').hidden]));
 const imp=async(p)=>{ const n0=await pg.evaluate(()=>LIB.length); await pg.setInputFiles('#fileIn',p); try{ await pg.waitForFunction(n=>LIB.length>n,n0,{timeout:20000}); }catch(e){} await sleep(500); log('import',p.split('/').pop(),await pg.evaluate(()=>$('#toastMsg').textContent)); };
 for(const p of [SP+'tooz/t/rich.epub',SP+'rt-modes/assets/pic.epub',EP+'files/epub_images.epub',EP+'files/epub3_nested.epub',SP+'rt-data/cases/latin1.epub',SP+'rt-data/cases/fonts.epub',SP+'rt-data/cases/inline.epub',SP+'rt-data/cases/cover.epub',SP+'rt-data/cases/rtl.epub',EP+'files/simple.pdf',EP+'files/epub_drm.epub',EP+'files/epub_notzip.epub']) await imp(p);
 await shot('library_full');
 const open=async t=>{ const [tt,ix]=t.split('#'); const bx=await pg.evaluate(([t,ix])=>{ const d=[...document.querySelectorAll('#docList .doc .t')].filter(x=>x.textContent.includes(t))[+ix||0]; d.scrollIntoView({block:'center'}); const r=d.getBoundingClientRect(); return [r.left+20,r.top+8]; },[tt,ix]); await sleep(200); await pg.touchscreen.tap(bx[0],bx[1]); await sleep(1200); };
 for(const t of ['Picture Book','Images Book','Nested','Cases#0','Cases#1','Cases#2','Cases#3','Cases#4','simple']){ try{ await open(t); log('open',t,await st()); await shot('bk_'+t.replace(/\W/g,'')); await tap(.9,.5); await tap(.9,.5); await shot('bk_'+t.replace(/\W/g,'')+'_p2'); await pg.evaluate(()=>switchMode('scroll')); await sleep(600); await shot('bk_'+t.replace(/\W/g,'')+'_sc'); await pg.evaluate(()=>switchMode('pages')); await sleep(400); await pg.evaluate(()=>closeReader()); await sleep(300);}catch(e){ log('OPEN FAIL',t,e.message.slice(0,100)); log(await pg.evaluate(()=>LIB.map(m=>m.title))); } }
 await open('Rich Test'); log('rich',await st()); await shot('rich_pages');
 // footnote tap
 const fn=await pg.evaluate(()=>{ const w=document.querySelector('#pgFlow w.n'); const r=w.getBoundingClientRect(); return [r.left+r.width/2,r.top+r.height/2,pgPageOfEl(w),P.page]; }); log('fn at',fn);
 if(fn[2]===fn[3]){ await pg.touchscreen.tap(fn[0],fn[1]); await sleep(500); log('footnote',await st()); await shot('footnote'); await tapSel('#sheet [data-act="go"]'); await sleep(600); log('fn go',await st()); await shot('fn_go'); await tapSel('#backGo'); await sleep(600); log('fn back',await st()); }
 // selection
 const selw=async(a,bb)=>{ await pg.evaluate(([a,bb])=>{ const r=document.createRange(); r.setStart(wordEl(a).firstChild||wordEl(a),0); const e=wordEl(bb); r.setEnd(e.lastChild||e,(e.lastChild||e).length||0); const s=getSelection(); s.removeAllRanges(); s.addRange(r); },[a,bb]); await sleep(500); };
 const p0=(await st()).pos; await selw(p0+3,p0+8); await shot('selbar'); log('selbar',await pg.evaluate(()=>[!$('#selBar').hidden,JSON.stringify(SEL)]));
 await tapSel('#selBar [data-hl="2"]'); log('hl',await pg.evaluate(()=>R.meta.highlights.map(h=>[h.s,h.e,h.c])));
 await selw(p0+12,p0+14); await tapSel('#selBar [data-sel="note"]'); await sleep(300); await pg.fill('#hlNote','A note with <b>html</b> & stuff'); await shot('note_sheet'); await tapSel('#sheet [data-act="save"]'); log('note',await pg.evaluate(()=>R.meta.highlights.map(h=>[h.s,h.e,h.c,h.note])), await st());
 await selw(p0+20,p0+22); await tapSel('#selBar [data-sel="copy"]'); log('copy',await st());
 await selw(p0+25,p0+25); await tapSel('#selBar [data-sel="define"]'); await sleep(300); log('define',await st(), await pg.evaluate(()=>WORDS.map(w=>w.word))); await shot('define'); await tapSel('#sheet [data-act="__close"]');
 await shot('rich_hl');
 // search
 await tapSel('#rSearch'); await sleep(300); await pg.fill('#srchIn','scene break'); await sleep(600); await shot('search'); log('search',await pg.evaluate(()=>$('#srchMeta').textContent)); await tapSel('#srchOut .result'); await sleep(700); log('after search',await st(), await pg.evaluate(()=>document.querySelectorAll('w.found').length)); await shot('search_jump');
 // toc/bookmarks
 await tapSel('#rToc'); await shot('toc'); log('toc',await pg.evaluate(()=>[...document.querySelectorAll('#sheet .li')].map(x=>x.textContent.trim()))); await tapSel('#sheet .li:nth-child(2)'); await sleep(700); log('toc go',await st());
 await tapSel('#rMark'); log('mark',await st()); await tapSel('#rToc'); await pg.evaluate(()=>openToc('marks')); await sleep(300); await shot('marks'); await pg.evaluate(()=>openToc('hls')); await sleep(300); await shot('hls'); await pg.evaluate(()=>closeSheet());
 // TTS in each of pages/scroll, focus on
 await tapSel('#rTts'); await sleep(1500); log('tts pages',await st(), await pg.evaluate(()=>{ const w=document.querySelector('w.tts'); const f=$('#rFoot').getBoundingClientRect(); const r=w&&w.getBoundingClientRect(); return w?{wb:r.bottom,footTop:f.top,covered:r.bottom>f.top&&R.chrome}:null; })); await shot('tts_pages');
 let cov=0,tot=0; for(let k=0;k<60;k++){ const c=await pg.evaluate(()=>{ const w=document.querySelector('w.tts'); if(!w) return null; const f=$('#rFoot').getBoundingClientRect(), t=$('#rTop').getBoundingClientRect(); const r=w.getBoundingClientRect(); return R.chrome && (r.bottom>f.top+2 || r.top<t.bottom-2); }); if(c!=null){ tot++; if(c){ if(!cov) await shot('tts_covered'); cov++; } } await sleep(60); } log('tts pages covered samples',cov,'/',tot);
 await tapSel('#rTts'); log('tts stop',await st());
 await pg.evaluate(()=>switchMode('scroll')); await sleep(700); log('scroll',await st()); await shot('scroll');
 await pg.touchscreen.tap(W/2,Hh/2); await sleep(400); log('scroll tap',await st());
 await pg.evaluate(()=>setChrome(true)); await tapSel('#rTts'); await sleep(400); cov=0;tot=0; for(let k=0;k<80;k++){ const c=await pg.evaluate(()=>{ const w=document.querySelector('w.tts'); if(!w) return null; const f=$('#rFoot').getBoundingClientRect(), t=$('#rTop').getBoundingClientRect(); const r=w.getBoundingClientRect(); return R.chrome && (r.bottom>f.top+2 || r.top<t.bottom-2); }); if(c!=null){ tot++; if(c){ if(!cov) await shot('tts_sc_covered'); cov++; } } await sleep(60); } log('tts scroll covered',cov,'/',tot, await st()); await pg.evaluate(()=>ttsStop());
 // autoscroll
 await pg.evaluate(()=>{ S.autoScroll=true; saveSettings(); asUI(); goTo(50,true); }); await sleep(600); await shot('as_idle'); await pg.touchscreen.tap(W/2,Hh/2); await sleep(2500); log('as on',await st()); await shot('as_run'); await pg.touchscreen.tap(W/2,Hh/2); await sleep(500); log('as paused',await st()); await shot('as_paused');
 await pg.evaluate(()=>{ S.autoScroll=false; saveSettings(); asUI(); });
 await pg.evaluate(()=>switchMode('speed')); await sleep(700); log('speed',await st()); await shot('speed'); await tapSel('#playBtn'); await sleep(1500); await shot('speed_play'); await tapSel('#stage'); log('speed paused',await st()); await tapSel('#defineBtn'); await shot('speed_define'); await pg.evaluate(()=>closeSheet()); await tapSel('#markBtn'); await sleep(300); await shot('speed_marks'); log('speed marks',await st()); await pg.evaluate(()=>closeSheet());
 await tapSel('#rAa'); await sleep(300); await shot('speed_panel'); await pg.evaluate(()=>closeSheet());
 await pg.evaluate(()=>switchMode('pages')); await sleep(500); await tapSel('#rBack'); await sleep(400);
 for(const t of ['words','stats','settings']){ await tapSel(`#tabs [data-tab="${t}"]`); await sleep(300); await shot('tab_'+t); if(t==='settings'){ await pg.evaluate(()=>$('#v-settings').scrollTo(0,99999)); await sleep(200); await shot('tab_settings_end'); } }
 // backup / restore
 const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:15000}).catch(()=>null), pg.evaluate(()=>{ $('#backupBtn').click(); })]); await sleep(500);
 if(dl){ const f=__dirname+'/'+T+'backup.json'; await dl.saveAs(f); const j=JSON.parse(fs.readFileSync(f)); log('backup',j.app,j.meta.length,j.texts.length,(fs.statSync(f).size/1e6).toFixed(1)+'MB');
   await pg.evaluate(async()=>{ for(const m of LIB.slice()){ await Store.del('meta',m.id); await Store.del('texts',m.id);} }); await pg.reload(); await sleep(900); log('wiped lib',await pg.evaluate(()=>LIB.map(m=>m.title)));
   await pg.setInputFiles('#restoreIn',f); await sleep(500); await shot('restore_sheet'); await tapSel('#sheet [data-act="go"]'); await sleep(2500); log('restored',await pg.evaluate(()=>[LIB.length,$('#toastMsg').textContent])); await tapSel('#tabs [data-tab="library"]');
   await open('Rich Test'); log('rich after restore',await st(), await pg.evaluate(()=>[R.meta.highlights.length,R.meta.bookmarks.length,R.imgUrls.length,R.bookFamily, document.querySelectorAll('#pgFlow w.hl2').length])); await shot('rich_restored'); await pg.evaluate(()=>closeReader()); await sleep(300);
 } else log('NO DOWNLOAD', await pg.evaluate(()=>$('#toastMsg').textContent));
 // paste
 await tapSel('#addPaste'); await sleep(300); await shot('paste_sheet'); await tapSel('#sheet [data-act="add"]'); log('paste empty',await st());
 await pg.fill('#pasteText','# One\nHello there, this is pasted. It has sentences.\n\n# Two\nMore text here for chapter two.'); await tapSel('#sheet [data-act="add"]'); await sleep(600); log('paste add',await st(), await pg.evaluate(()=>LIB.map(m=>m.title).slice(0,3))); await shot('paste_added'); await tapSel('#rBack'); await sleep(400);
 await tapSel('#addLink'); await sleep(300); await tapSel('#sheet [data-act="load"]'); log('link empty',await st()); await pg.fill('#linkUrl','not a url'); await tapSel('#sheet [data-act="load"]'); log('link bad',await st());
 await pg.fill('#linkUrl','https://example.com/article'); await tapSel('#sheet [data-act="load"]'); await sleep(600); await shot('link_loading'); for(let k=0;k<40;k++){ const s=await st(); if(s.toast&&!/Loading|Trying|Connecting|Asking|…$/.test(s.toast)) break; await sleep(500); } log('link fail',await st()); await shot('link_fail');
 log('errs',errs); await b.close(); })().catch(e=>{ console.error('FAIL',e); process.exit(1); });
