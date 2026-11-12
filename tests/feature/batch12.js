const { chromium } = require('playwright-core');
const fs=require('fs');
const EP='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/redteam-epub/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:EP+'node_modules/jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1300);
  // headings
  const hd=await pg.evaluate(async(b64)=>{ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const d=await parseFile(new File([bin],'hd.epub')); return [d.subjects, d.blocks.map(x=>x.t+(x.l?'L':'')+':'+d.words.slice(x.s,Math.min(x.e,x.s+4)).join(' '))]; }, fs.readFileSync('hd.epub').toString('base64'));
  console.log('headings', JSON.stringify(hd,null,0));
  console.log('tidy', await pg.evaluate(()=>tidySubjects(['Christian life -- Early works to 1800','Sermons, English','Lewis, C. S. (Clive Staples), 1898-1963','Browsing: Religion/Spirituality/Paranormal','Best Books Ever Listings','Whaling -- Fiction','Bible. N.T. Romans -- Commentaries','Sea stories','Juvenile fiction'])));
  // article fallback
  const art=await pg.evaluate(()=>{ const html=`<html><head><title>Mostly Peaceful November Letters</title><meta name="keywords" content="Letters, Culture"></head><body><article class="post"><div class="entry-content"><h2>Family Dilemma</h2><blockquote><p>What advice on following the Fifth Commandment would you give to an American-born citizen whose parents are here illegally? I have wondered about this for a long time and could not settle it.</p><p>Jake</p></blockquote><div class="reply">Jake, I would advise them not to lie on anyone's behalf, and to reserve their views on it for family discussions. I don't believe they would have a moral duty to act as an informant. There is a great deal more that could be said here, but that is the heart of it.</div><h2>Tariffs and Cornyn</h2><blockquote><p>Question two is a long question about tariffs and senators and what you think of the whole business, written at length so the questions alone pass three hundred characters easily.</p><p>Sam</p></blockquote><div class="reply">Sam, the answer to the second letter goes here, and it is also a fairly long reply with several sentences. It explains the view in some detail and closes the thought.</div></div></article></body></html>`; const d=extractArticle(html,'https://x.com/a'); return [d.words.join(' ').includes('informant'), d.words.join(' ').includes('second letter goes here'), d.chapters.map(c=>c.t), (d.blocks||[]).filter(b=>b.q).length, d.subjects]; });
  console.log('article', art);
  // backlinks in the tutorial
  await pg.evaluate(async()=>{ S.mode='pages'; saveSettings(); await openDoc(LIB.find(m=>m.kind==='sample').id); }); await sleep(800);
  const bl=await pg.evaluate(()=>[...R.notes].map(([a,t])=>[a,t,R.words[a],R.words[t]]).concat([[...R.back]]));
  console.log('notes/backlinks', JSON.stringify(bl));
  const k=await pg.evaluate(()=>[...R.back.keys()][0]);
  await pg.evaluate(k=>goTo(k,true),k); await sleep(600);
  console.log('nb rendered', await pg.evaluate(k=>{ const w=wordEl(k); return w&&w.className; },k));
  await pg.evaluate(k=>{ const w=wordEl(k); const r=w.getBoundingClientRect(); readerTap({clientX:r.left+r.width/2, clientY:r.top+r.height/2, target:w}); },k); await sleep(700);
  console.log('tap backlink ->', await pg.evaluate(()=>[R.pos, R.words[R.pos], !$('#backPill').hidden]));
  // paragraph option
  await pg.evaluate(()=>{ S.para='both'; saveSettings(); applyLook(); });
  console.log('para both', await pg.evaluate(()=>[getComputedStyle(document.documentElement).getPropertyValue('--pind'), getComputedStyle(document.documentElement).getPropertyValue('--pgap')]));
  // OpenDyslexic
  await pg.evaluate(()=>{ S.font='opendyslexic'; saveSettings(); applyLook(); relayoutSoon(); }); await sleep(1500);
  console.log('opendyslexic', await pg.evaluate(async()=>{ await document.fonts.load('16px OpenDyslexic'); return [document.fonts.check('16px OpenDyslexic'), getComputedStyle(document.querySelector('#pgFlow p')).fontFamily.slice(0,40)]; }));
  await pg.evaluate(()=>{ S.font='original'; saveSettings(); applyLook(); });
  // layout anchor across settings changes
  await pg.evaluate(async()=>{ await goTo(0); }); for(let i=0;i<6;i++){ await pg.evaluate(()=>pgTurn(1)); await sleep(200); }
  const a0=await pg.evaluate(()=>[R.pos, R.words[R.pos], pgFirstWord(P.page)]);
  const res=[];
  for(const sz of [24,15,30,19,22,19]){ await pg.evaluate(s=>{ S.size=s; saveSettings(); relayoutSoon(); }, sz); await sleep(700); res.push(await pg.evaluate(a=>{ const w=wordEl(a); const c=$('#pgClip').getBoundingClientRect(), r=w.getBoundingClientRect(); return [S.size, R.anchor, r.left>=c.left-2&&r.right<=c.right+2]; }, a0[2])); }
  console.log('anchor', a0, JSON.stringify(res));
  await pg.evaluate(()=>pgTurn(1)); console.log('anchor cleared on turn', await pg.evaluate(()=>R.anchor));
  // inset change without a resize event (ResizeObserver)
  await pg.evaluate(()=>pgTurn(1)); await sleep(300); const a1=await pg.evaluate(()=>pgFirstWord(P.page));
  await pg.evaluate(()=>{ document.getElementById('rBody').style.paddingLeft='60px'; document.getElementById('rBody').style.paddingRight='60px'; }); await sleep(1200);
  console.log('inset relayout keeps word', await pg.evaluate(a=>{ const w=wordEl(a); const c=$('#pgClip').getBoundingClientRect(), r=w.getBoundingClientRect(); return [R.anchor===a, r.left>=c.left-2&&r.right<=c.right+2]; },a1));
  await pg.evaluate(()=>{ document.getElementById('rBody').style.paddingLeft=''; document.getElementById('rBody').style.paddingRight=''; closeReader(true); }); await sleep(500);
  // tag suggestions with subjects & form
  const sug=await pg.evaluate(async()=>{ const o={}; for(const id of ['shelf-paradise','shelf-holmes','shelf-pilgrim','shelf-moby']){ const m=LIB.find(x=>x.id===id); await fetchShelfBook(m); SUGG.delete(id); o[id]=[ (m.subjects||[]).slice(0,4), await suggestTags(m)]; } return o; });
  console.log('suggestions', JSON.stringify(sug,null,1));
  // edit sheet: other tags collapsed; typing opens
  await pg.click('[data-more="shelf-pilgrim"]'); await sleep(700);
  console.log('other tags', await pg.evaluate(()=>[!!$('#knownDet'), $('#knownDet')&&$('#knownDet').open]));
  await pg.fill('#edTag','rom'); await sleep(150);
  console.log('typing opens', await pg.evaluate(()=>[$('#knownDet').open, [...document.querySelectorAll('#knownDet .chip')].filter(c=>!c.hidden).map(c=>c.dataset.v)]));
  await pg.fill('#edTag',''); 
  // delete scrolls
  const before=await pg.evaluate(()=>{ const b=document.querySelector('#sheet .sheet-body')||$('#sheet'); return b.scrollTop; });
  await pg.click('#sheet [data-act=askdel]'); await sleep(800);
  console.log('delete scroll', before, await pg.evaluate(()=>{ const b=document.querySelector('#sheet .sheet-body')||$('#sheet'); const z=$('#delZone').getBoundingClientRect(); return [b.scrollTop, Math.round(z.bottom), innerHeight]; }));
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  // settings tags collapsed
  await pg.click('#tabs [data-tab=settings]'); await sleep(300);
  console.log('settings tags', await pg.evaluate(()=>[!!$('#tagDet'), $('#tagDet').open, $('#tagDet summary').textContent]));
  await pg.screenshot({path:'b12_settings.png'});
  console.log('errors', errs); await b.close();
})();
