import re, sys
import os
D=os.path.dirname(os.path.abspath(__file__))+'/'
old=open(D+'old.html',encoding='utf-8').read().split('\n')
def L(a,b): return '\n'.join(old[a-1:b])
def fill(s):
    def r(m):
        a,b=int(m.group(1)),int(m.group(2)); t=L(a,b)
        if (a,b)==(885,910):
            o=t[t.index('function chunkEnd(i){'):t.index('function orp(w){')]
            t=t.replace(o,'''function chunkEnd(i){
  if(i>=R.n) return R.n;
  let j=i+1; while(j<R.n && (glued(j)||isDashTok(j))) j++;   /* a superscript, note number or dash travels with its word */
  if(!S.multi || dashParts(i)) return j;
  let len=textOf(i,j-1).length;
  while(j<R.n && j-i<6 && !isSentEnd(j-1) && !SOFT.test(R.words[j-1]) && !dashParts(j)){ let e=j+1; while(e<R.n && (glued(e)||isDashTok(e))) e++; const add=textOf(j,e-1).length; if(len+1+add>S.charBudget) break; len+=1+add; j=e; }
  return j;
}
''')
        if (a,b)==(912,1022):
            t=t.replace("$('.rhead')","$('#rTop')")
            o="  let h='', open=false;\n  for(let k=0;k<R.n;k++){"
            assert t.count(o)==1; t=t.replace(o,"  const wa=Math.max(0,R.pos-400), wb=Math.min(R.n,R.pos+400); R.winA=wa; R.winB=wb; /* only the words near your place */\n  let h='', open=false;\n  for(let k=wa;k<wb;k++){")
            o="  if(R.n) h+=fig(R.n);\n  box.innerHTML=h;\n  R.spans=box.getElementsByClassName('w'); R.curSpan=null;\n  syncScroll();"
            assert t.count(o)==1; t=t.replace(o,"  if(wb>=R.n) h+=fig(R.n);\n  box.classList.add('manual'); box.innerHTML=h;\n  R.spans=box.getElementsByClassName('w'); R.curSpan=null;\n  syncScroll(true); requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(!manualScroll) box.classList.remove('manual'); }));")
            o="  const span=(R.spans&&R.spans[R.pos]&&+R.spans[R.pos].dataset.i===R.pos)?R.spans[R.pos]:box.querySelector(`[data-i=\"${R.pos}\"]`);"
            assert t.count(o)==1, 'span'; t=t.replace(o,"  if(R.winB!=null && (R.pos<R.winA || R.pos>=R.winB || (R.pos<R.winA+40&&R.winA>0) || (R.pos>R.winB-40&&R.winB<R.n))){ buildScrollText(); return; }\n  const sw=R.spans&&R.winA!=null?R.spans[R.pos-R.winA]:null;\n  const span=(sw&&+sw.dataset.i===R.pos)?sw:box.querySelector(`[data-i=\"${R.pos}\"]`);")
            o="    manualScroll=true; box.classList.add('manual');\n    if(R.playing) pause();\n    dragStartY=e.clientY;"
            assert t.count(o)==1, 'pd'; t=t.replace(o,"    manualScroll=true; box.classList.add('manual');\n    dragStartY=e.clientY; dragMoved=false;")
            o="    const dy=e.clientY - dragStartY;"
            assert t.count(o)==1, 'pm'; t=t.replace(o,"    const dy=e.clientY - dragStartY;\n    if(!dragMoved && Math.abs(dy)>8){ dragMoved=true; if(R.playing) pause(); }")
            o="    manualScroll=false; box.classList.remove('manual');\n    bg.releasePointerCapture(e.pointerId);"
            assert t.count(o)==1, 'pu'; t=t.replace(o,"    manualScroll=false; box.classList.remove('manual');\n    bg.releasePointerCapture(e.pointerId);\n    if(dragMoved){ suppressStageClick=true; setTimeout(()=>{ suppressStageClick=false; },400); speedBrowseRebuild(); }")
            o=' loading="lazy"></figure>`; }).join(\'\'); };'
            assert t.count(o)==1, 'lazy'; t=t.replace(o,'></figure>`; }).join(\'\'); };')
            o="  box.classList.add('manual'); box.innerHTML=h;"
            assert t.count(o)==1; t=t.replace(o,"  box.classList.add('manual'); box.innerHTML=h;\n  box.querySelectorAll('img').forEach(im=>{ if(!im.complete) im.addEventListener('load',()=>{ if(!manualScroll) syncScroll(true); },{once:true}); });")
            o="let dragStartY=0, dragStartTrans=0;"
            assert t.count(o)==1; t=t.replace(o,"let dragStartY=0, dragStartTrans=0, dragMoved=false, suppressStageClick=false;")
            o="  const progress=count<=1 ? 0.5 : idx/(count-1);\n  let alignAt=lineTop + progress*(lineBottom-lineTop);"
            assert t.count(o)==1, 'align'; t=t.replace(o,"  let alignAt=lineTop + span.offsetHeight/2 - line.offsetHeight/2; /* the bar sits exactly over the current line */")
            o="    alignAt=lineTop;\n"
            assert t.count(o)==1, 'figalign'; t=t.replace(o,"    alignAt=lineTop + span.offsetHeight/2 - line.offsetHeight/2;\n")
            o="  line.style.top=Math.max(0, topInStage)+'px';"
            assert t.count(o)==1, 'ltop'; t=t.replace(o,"  line.style.top=Math.max(0, topInStage - line.offsetHeight/2)+'px';")
            a0=t.index("  box.addEventListener('click', e=>{"); b0=t.index("function openImageFull(a){"); t=t[:a0]+t[b0:]
            o="speedBrowseRebuild(); }"
            assert t.count(o)==1, 'pu2'; t=t.replace(o,"speedBrowseRebuild(); }\n    else{ /* a plain tap or mouse click: jump to the word, or open the picture, under the pointer */\n      const hit=document.elementFromPoint(e.clientX,e.clientY); const fig=hit&&hit.closest('#scrollText figure.scroll-img'); const w=hit&&hit.closest('#scrollText .w');\n      if(fig||w){ suppressStageClick=true; setTimeout(()=>{ suppressStageClick=false; },400); }\n      if(fig){ if(R.playing) pause(); const a=R.imgList[+fig.dataset.img]; if(a) showImage(a); }\n      else if(w){ const i=+w.dataset.i; if(!isNaN(i)) goTo(i); }\n    }")
            o="    if(R.ends.has(k)){ h+='</p>'; open=false; } else h+=' ';"
            assert t.count(o)==1; t=t.replace(o,"    if(R.ends.has(k)){ h+='</p>'; open=false; } else if(!glued(k+1)) h+=' ';")
        if (a,b)==(1023,1057):
            o="  else if(SOFT.test(R.words[last])) t+=base*(S.commaPause-1);\n  return t;"
            assert t.count(o)==1; t=t.replace(o,"  else if(SOFT.test(R.words[last])) t+=base*(S.commaPause-1);\n  if(S.adaptive) t*=difficulty(i);\n  return t;")
            o="  for(let k=i;k<j;k++){ let m=1;"
            assert t.count(o)==1; t=t.replace(o,"  for(let k=i;k<j;k++){ if(k>i && (glued(k)||isDashTok(k))) continue; let m=1;")
            o="function showChunk(i){ const j=chunkEnd(i); renderWord(R.words.slice(i,j).join(' ')); syncScroll(); return j; }"
            assert t.count(o)==1; t=t.replace(o,"function showChunk(i){ const P=dashParts(i), sub=R.subFor===i?R.sub:0; if(P && sub<P.length-1){ renderWord(P[sub]); syncScroll(); return i+1; } const j=chunkEnd(i); renderWord(speedText(i,j-1,P?P[P.length-1]:null)); syncScroll(); return j; }")
            o="function delayFor(i,j){\n  const base=60000/effWpm(); let t=0;"
            assert t.count(o)==1; t=t.replace(o,"function delayFor(i,j){\n  const base=60000/effWpm(); let t=0;\n  { const P=dashParts(i), sub=R.subFor===i?R.sub:0; if(P && sub<P.length-1){ let m=1+hyphenSlow(P[sub]); t=base*m+base*(S.commaPause-1); if(S.adaptive) t*=difficulty(i); return t; } }")
            o="if(S.longWord){ const L=R.words[k].replace(/[^\\p{L}\\p{N}]/gu,'').length; if(L>7) m+=Math.min(.7,(L-7)*.07); } t+=base*m; }"
            assert t.count(o)==1, 'lw'; t=t.replace(o,"if(S.longWord){ const L=R.words[k].replace(/[^\\p{L}\\p{N}]/gu,'').length; if(L>7) m+=Math.min(.7,(L-7)*.07); } m+=hyphenSlow(R.words[k]); t+=base*m; }")
            o="h+=`<span data-i=\"${k}\"${k>=R.pos&&k<j?' class=\"cur\"':''}>${esc(R.words[k])}</span> `;"
            assert t.count(o)==1, 'ctx'; t=t.replace(o,"h+=(k>s&&!glued(k)?' ':'')+`<span data-i=\"${k}\"${k>=R.pos&&k<j?' class=\"cur\"':''}>${esc(R.words[k])}</span>`;")
        if (a,b)==(1058,1080):
            o="    if(!R.playing) return;\n    R.runWords+=j-i;"
            assert t.count(o)==1, 'tick'; t=t.replace(o,"    if(!R.playing) return;\n    { const P=dashParts(i), sub=R.subFor===i?R.sub:0; if(P && sub<P.length-1){ R.sub=sub+1; R.subFor=i; tick(); return; } }\n    R.subFor=-1; R.runWords+=j-i;")
        if (a,b)==(1104,1113):
            o="el.stage.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); toggle(); } });\n"
            assert t.count(o)==1, 'kd'; t=t.replace(o,"")
            o="el.stage.addEventListener('click',toggle);"
            assert t.count(o)==1; t=t.replace(o,"el.stage.addEventListener('click',e=>{ if(suppressStageClick){ suppressStageClick=false; return; } toggle(); });")
            o="renderWord(R.words.slice(i,chunkEnd(i)).join(' '));"
            assert t.count(o)==1, 'scrubprev'; t=t.replace(o,"renderWord(textOf(i,chunkEnd(i)-1));")
            o="$('#bWord').onclick=()=>goTo(R.pos-1);"
            assert t.count(o)==1; t=t.replace(o,"$('#bWord').onclick=()=>{ let k=R.pos-1; while(k>0 && glued(k)) k--; goTo(k); };")
        if (a,b)==(1082,1102):
            o="See Settings → Storage check."
            assert t.count(o)==1; t=t.replace(o,"Save a backup from Settings soon.")
        if (a,b)==(554,587):
            o="try{ const md=await pdf.getMetadata(); const t=md?.info?.Title; if(t&&t.trim().length>2) title=t.trim(); }catch(e){}"
            assert t.count(o)==1; t=t.replace(o,"let author=''; try{ const md=await pdf.getMetadata(); const t=md?.info?.Title; if(t&&t.trim().length>2) title=t.trim(); const au=md?.info?.Author; if(au&&au.trim()) author=au.trim().slice(0,80); }catch(e){}")
            o="return {title, kind:'pdf', words, ends, chapters};"
            assert t.count(o)==1; t=t.replace(o,"return {title, author, kind:'pdf', words, ends, chapters};")
        if (a,b)==(1151,1203):
            o="return {text:R.words.slice(s,e+1).join(' '), s, e};"
            assert t.count(o)==1; t=t.replace(o,"return {text:textOf(s,e), s, e};")
            o='<div class="src">${esc(x.docTitle)} · ${new Date(x.at).toLocaleDateString()}</div></div></div></div>`;'
            assert t.count(o)==1; t=t.replace(o,'<div class="src">${esc(x.docTitle)} · ${new Date(x.at).toLocaleDateString()}</div></div><button class="icon-btn wdel" type="button" data-wdel="${x.id}" aria-label="Remove ${esc(x.word)}">${ICON.trash}</button></div></div>`;')
            o="$('#wordList').addEventListener('click',e=>{\n  const g=e.target.closest('[data-look]'); if(!g||swipe.moved) return;"
            assert t.count(o)==1; t=t.replace(o,"function removeWord(id){ const idx=WORDS.findIndex(w=>w.id===id); if(idx<0) return; const item=WORDS[idx]; WORDS.splice(idx,1); saveWords(); renderWords(); toast('Removed “'+item.word+'”',{label:'Undo',fn:()=>{ WORDS.splice(idx,0,item); saveWords(); renderWords(); }}); }\n$('#wordList').addEventListener('click',e=>{\n  const del=e.target.closest('[data-wdel]'); if(del){ removeWord(del.dataset.wdel); return; }\n  const g=e.target.closest('[data-look]'); if(!g||swipe.moved) return;")
            o="$('#wordList').addEventListener('pointerdown',e=>{ const r=e.target.closest('.winner'); if(!r) return;"
            assert t.count(o)==1; t=t.replace(o,"$('#wordList').addEventListener('pointerdown',e=>{ const r=e.target.closest('.winner'); if(!r || e.target.closest('[data-wdel]') || e.pointerType==='mouse') return;")
        return t
    return re.sub(r'/\*@@OLD:(\d+)-(\d+)@@\*/', r, s)
parts=[open(D+f,encoding='utf-8').read() for f in ['a_head.html','b_body.html','c_js1.js']]
d=L(601,854)
def rep(s,o,n):
    assert s.count(o)==1,(s.count(o),o[:80]); return s.replace(o,n)
d=rep(d,"  const text={id, words:d.words, ends:d.ends, images:d.images||null};","  const text={id, words:d.words, ends:d.ends, images:d.images||null, blocks:d.blocks||null, wf:d.wf||null, notes:d.notes||null, breaks:d.breaks||null, secs:d.secs||null, font:d.font||null, lang:d.lang||null};")
d=rep(d,"chapters:d.chapters||[], bookmarks:[], finished:false,","chapters:d.chapters||[], bookmarks:[], highlights:[], finished:false,")
d=rep(d,"    paras.push({text:t});\n  });","    paras.push({text:t, type: el.tagName==='LI'?'li': el.tagName==='PRE'?'pre':'p', quote: el.tagName==='BLOCKQUOTE'});\n  });")
d=rep(d,"if(textLen<300){ const ctx={words:[],ends:[],anchors:null,firstHeading:null}; walkHTML(root,ctx,''); if(ctx.words.length>out.words.length) out={words:ctx.words, ends:ctx.ends, chapters:[]}; }",
        "{ /* some sites keep text outside paragraph tags (a reply under a quoted letter, say); when the full walk finds clearly more, use it */ const ctx=newCtx(false); walkHTML(root,ctx,''); if(textLen<300 ? ctx.words.length>out.words.length : ctx.words.length>out.words.length*1.3+20){ const ch=ctx.blocks.filter(b=>/^h[1-3]$/.test(b.t)&&b.e-b.s<=20).map(b=>({t:ctx.words.slice(b.s,b.e).join(' ').slice(0,100), i:b.s, d:+b.t[1]-1})); out={words:ctx.words, ends:ctx.ends, blocks:ctx.blocks, wf:ctx.wf, chapters:ch}; } }")
def cut(d,start,end):
    assert d.count(start)==1 and d.count(end)==1,(start,end)
    i=d.index(start); j=d.index(end); return d[:i]+d[j:]
d=cut(d,"function renderLibrary(){","$('#docList').addEventListener('click',e=>{")
d=cut(d,"function docOptions(id){","/* ---------- paste ---------- */")
d=cut(d,"$('#addPaste').innerHTML=ICON.paste+'Paste text';","function openLink(){")
d=rep(d,"{ /* some sites keep text outside paragraph tags","const subjects=[...new Set([...doc.querySelectorAll('meta[property=\"article:tag\"],meta[property=\"article:section\"]')].map(m=>(m.getAttribute('content')||'').trim()).concat(metaC('meta[name=\"keywords\"]').split(',').map(x=>x.trim())).filter(x=>x&&x.length<=40))].slice(0,12);\n  { /* some sites keep text outside paragraph tags")
d=rep(d,"  const subjects=[...new Set(","const byline=[metaC('meta[name=\"author\"]'),metaC('meta[property=\"article:author\"]'),metaC('meta[name=\"byl\"]').replace(/^by\\s+/i,'')].find(x=>x&&!/^https?:/i.test(x))||'';\n  const subjects=[...new Set(")
d=rep(d,"  return {title:title||h1.slice(0,120), ...out};","  return {title:title||h1.slice(0,120), author:byline.slice(0,80), subjects, ...out};")
d=rep(d,"chapters:d.chapters||[], bookmarks:[], highlights:[], finished:false,","chapters:d.chapters||[], bookmarks:[], highlights:[], author:(d.author||'').trim(), tags:[], subjects:(d.subjects||[]).slice(0,20), finished:false,")
d=d.replace('ReadFast asks','Tooz asks').replace('ReadFast couldn','Tooz couldn')
parts.append('\n/* ---------- library ---------- */\n'+d.split('/* ---------- library ---------- */',1)[-1] if '/* ---------- library' in d else d)
parts.append(open(D+'e_reader.js',encoding='utf-8').read())
parts.append(open(D+'i_speech.js',encoding='utf-8').read())
parts.append(open(D+'h_voice.js',encoding='utf-8').read())
parts.append(open(D+'j_audiobook.js',encoding='utf-8').read())
parts.append(open(D+'g_extra.js',encoding='utf-8').read())
parts.append(open(D+'f_js3.js',encoding='utf-8').read())
out=fill('\n'.join(parts))
left=re.findall(r'@@OLD',out); assert not left, left
open(os.path.join(D,'..','index.html'),'w',encoding='utf-8').write(out)
print('lines',out.count('\n'))
