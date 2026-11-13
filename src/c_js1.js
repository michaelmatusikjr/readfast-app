<script>
'use strict';
/* ---------- icons ---------- */
/*@@OLD:313-334@@*/
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  toc: I('<path d="M4 6h16M4 12h10M4 18h13"/>'),
  speaker: I('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  stop: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect fill="currentColor" x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>`,
  note: I('<path d="M5 4h14v12l-5 4H5z"/><path d="M14 20v-4h5"/>'),
  hl: I('<path d="M4 20h7"/><path d="M14.5 4.5l5 5L10 19l-5 1 1-5z"/>'),
  archive: I('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>'),
  sort: I('<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>'),
  filter: I('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>')
};

/* ---------- utilities ---------- */
/*@@OLD:338-364@@*/

/* ---------- settings (one set, used everywhere) ---------- */
const DEFAULTS = {
  v:2, mode:'pages',
  theme:'auto', nightAuto:false, nightFrom:'21:00', nightTo:'07:00', nightTheme:'dark', dim:0, warmth:0,
  font:'original', size:19, lineH:1.55, margin:'normal', para:'indent', justify:true, hyphen:true, boldText:false, wordStart:false,
  turn:'slide', tapZones:'edges', twoCol:true, focus:true,
  autoScroll:false, scrollWpm:220, asRamp:true, asPauses:true,
  wpm:350, multi:false, charBudget:14, ramp:true, rampSecs:6, commaPause:1.6, sentPause:2.3, paraPause:3.0, longWord:true, autoRewind:3, speedSize:44, focusColor:'#E0303F', context:true,
  speedFont:'same', adaptive:false, ttsRate:1, ttsVoice:'', ttsEngine:'natural', pipVoice:'en_US-lessac-medium', info:0, measuredWpm:0, goalMins:0, linkService:'', bkRemind:7, idleMins:5, yearGoal:0
};
const S = (()=>{
  const saved=LS.get('settings',{})||{};
  if(!saved.v){ /* settings from the speed-reader version */
    if(saved.fontSize) saved.speedSize=saved.fontSize;
    if(saved.font) saved.speedFont=saved.font; /* keep the font chosen for speed reading */
    delete saved.fontSize; delete saved.font;
    saved.theme = saved.theme==='light'?'white' : saved.theme==='dark'?'dark' : 'auto';
    saved.v=2;
  }
  return Object.assign({}, DEFAULTS, saved);
})();
const saveSettings=()=>LS.set('settings',S);
const FONTS = {
  original:{label:'Original', css:null, note:'Book’s own'},
  literata:{label:'Literata', css:'"Literata",Georgia,serif', note:'Book serif'},
  newyork:{label:'New York', css:'ui-serif,"New York","Iowan Old Style",Georgia,serif', note:'Apple serif'},
  iowan:{label:'Iowan', css:'"Iowan Old Style","Iowan",Palatino,Georgia,serif', note:'Classic'},
  charter:{label:'Charter', css:'Charter,"Bitstream Charter","Charis SIL",Georgia,serif', note:'Crisp serif'},
  palatino:{label:'Palatino', css:'Palatino,"Palatino Linotype","Book Antiqua",Georgia,serif', note:'Elegant'},
  georgia:{label:'Georgia', css:'Georgia,serif', note:'Screen serif'},
  system:{label:'San Francisco', css:'-apple-system,BlinkMacSystemFont,system-ui,sans-serif', note:'iPhone sans'},
  atkinson:{label:'Atkinson', css:'"Atkinson Hyperlegible",-apple-system,system-ui,sans-serif', note:'High legibility'},
  lexend:{label:'Lexend', css:'"Lexend",-apple-system,system-ui,sans-serif', note:'Dyslexia-friendly'},
  opendyslexic:{label:'OpenDyslexic', css:'"OpenDyslexic","Lexend",-apple-system,system-ui,sans-serif', note:'Dyslexia font'}
};
const COLORS = [['Red','#E0303F'],['Amber','#E39B12'],['Teal','#139E9A'],['Blue','#3478F6'],['Violet','#8E5BE8'],['Pink','#E0479E']];
/* reading themes: page colours; dark ones also switch the app chrome to dark */
const THEMES = {
  white:{label:'White', bg:'#FFFFFF', ink:'#1B1B1B', muted:'#6E6E73', line:'#E3E3E6', link:'#2456C7', dark:false},
  paper:{label:'Paper', bg:'#F8F5EE', ink:'#262320', muted:'#77716A', line:'#E6E0D3', link:'#2F5BB8', dark:false},
  sepia:{label:'Sepia', bg:'#F1E4C9', ink:'#3D2E1E', muted:'#7C6851', line:'#DECDAA', link:'#8A4B12', dark:false},
  gray:{label:'Gray', bg:'#4B4C50', ink:'#EDEDED', muted:'#B9B9BE', line:'#606166', link:'#A8C2FF', dark:true},
  dark:{label:'Dark', bg:'#16181C', ink:'#D8DBE0', muted:'#8C929C', line:'#2A2E35', link:'#8AA4FF', dark:true},
  black:{label:'Black', bg:'#000000', ink:'#C8C8C8', muted:'#7D7D7D', line:'#1E1E1E', link:'#7C97F2', dark:true}
};
const HL_LIGHT=['#FFE58A','#C4EDB5','#C5E1FF','#FFC9DF'], HL_DARK=['rgba(255,214,64,.42)','rgba(110,200,90,.38)','rgba(90,160,255,.40)','rgba(255,110,170,.40)'];
/* margins grow with the screen: [smallest in px, share of the reading width] */
const MARGINS={narrow:[12,0.03], normal:[22,0.065], wide:[44,0.13]};
function marginPx(W){ const m=MARGINS[S.margin]||MARGINS.normal; if(!W){ const rb=document.getElementById('rBody'); W=(rb&&rb.clientWidth)||window.innerWidth||390; } return Math.round(Math.max(m[0], W*m[1])); }
function isNightNow(){
  const m=(s)=>{ const [h,mm]=String(s||'0:0').split(':').map(Number); return (h||0)*60+(mm||0); };
  const d=new Date(), c=d.getHours()*60+d.getMinutes(), a=m(S.nightFrom), b=m(S.nightTo);
  return a===b ? false : a<b ? (c>=a && c<b) : (c>=a || c<b);
}
function effectiveTheme(){
  let t=S.theme; if(S.nightAuto && isNightNow()) t=S.nightTheme;
  if(t==='auto'){ let dark=false; try{ dark=matchMedia('(prefers-color-scheme: dark)').matches; }catch(e){} t=dark?'dark':'white'; }
  return THEMES[t]?t:'white';
}
function fontCSS(){
  const f=FONTS[S.font]||FONTS.original;
  if(f.css) return f.css;
  return (typeof R!=='undefined' && R.bookFamily ? `"${R.bookFamily}",` : '')+'"Literata",Georgia,serif';
}
function applyLook(){
  const r=document.documentElement, st=r.style, T=THEMES[effectiveTheme()];
  r.setAttribute('data-theme', T.dark?'dark':'light');
  st.setProperty('--page-bg',T.bg); st.setProperty('--page-ink',T.ink); st.setProperty('--page-muted',T.muted); st.setProperty('--page-line',T.line); st.setProperty('--page-link',T.link);
  (T.dark?HL_DARK:HL_LIGHT).forEach((c,k)=>st.setProperty('--hl'+(k+1),c));
  st.setProperty('--hl-ink', T.dark?'#F4F4F4':'#1B1B1B');
  st.setProperty('--tts', T.dark?'rgba(255,200,40,.55)':'#FFD54A');
  st.setProperty('--focus', S.focusColor);
  const fc=fontCSS(); st.setProperty('--bfont', fc);
  const sf=FONTS[S.speedFont]; st.setProperty('--rfont', S.speedFont==='same'||!sf ? fc : (sf.css||fc)); st.setProperty('--rsize', S.speedSize+'px');
  st.setProperty('--bsize', S.size+'px'); st.setProperty('--blh', S.lineH);
  st.setProperty('--mx', marginPx()+'px');
  st.setProperty('--pind', S.para!=='spaced'?'1.4em':'0'); st.setProperty('--pgap', S.para==='indent'?'0':'.8em');
  st.setProperty('--balign', S.justify?'justify':'left'); st.setProperty('--hyph', S.hyphen?'auto':'manual');
  st.setProperty('--bw', S.boldText?'600':'400'); st.setProperty('--bwb', S.boldText?'800':'700');
  const sh=$('#shade'); const d=S.dim/100*0.65, w=S.warmth/100*0.32;
  if(sh){ sh.style.display=(d>0||w>0)?'block':'none'; sh.style.background=`linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${d})),rgba(255,140,40,${w})`; sh.style.mixBlendMode='multiply'; }
  const tc=$('#themeColor'); if(tc) tc.setAttribute('content', (typeof R!=='undefined'&&R.meta&&!$('#v-reader').hidden)?T.bg:(T.dark?'#0E1217':'#E9EDF2'));
}

/* ---------- text model ----------
   A book is a list of words. Formatting rides alongside, indexed by word:
   blocks [{s,e,t,q}] (paragraph types), wf[] per-word flags, notes [[refWord,targetWord]],
   breaks [word] (scene breaks), secs [word] (chapter file starts). */
const F_I=1, F_B=2, F_C=4, F_P=8, F_S=16, F_U=32, F_N=64, F_GLUE=128;
/*@@OLD:382-385@@*/
function fromParagraphs(paras){
  const words=[], ends=[], chapters=[], blocks=[];
  for(const p of paras){
    const ws=splitWords(p.text); if(!ws.length) continue;
    const s=words.length;
    if(p.heading) chapters.push({t:p.text.trim().slice(0,100), i:s, d:p.level||0});
    pushAll(words,ws); ends.push(words.length-1);
    const b={s, e:words.length, t: p.heading?'h'+Math.min(6,(p.level||0)+2) : (p.type||'p')}; if(p.quote) b.q=1;
    blocks.push(b);
  }
  return {words, ends, chapters, blocks};
}
/*@@OLD:395-409@@*/
const BLOCK=new Set(['p','div','h1','h2','h3','h4','h5','h6','li','blockquote','section','article','tr','dd','dt','figcaption','pre','header','footer','aside','table','ul','ol','hr','br','td','th','caption','nav','figure','main','body']);
const SKIP=new Set(['script','style','head','title','svg','math','noscript','rt','rp','template']);
const INLINE_FLAG={em:F_I,i:F_I,cite:F_I,dfn:F_I,var:F_I,strong:F_B,b:F_B,code:F_C,kbd:F_C,samp:F_C,tt:F_C,sup:F_P,sub:F_S,u:F_U,ins:F_U};
function newCtx(withAnchors){ return {words:[], ends:[], blocks:[], wf:[], notes:[], breaks:[], anchors:withAnchors?{}:null, firstHeading:withAnchors?{}:null, images:withAnchors?[]:null}; }
/* Some books mark section titles as ordinary paragraphs and make them look like headings with their stylesheet.
   Read the stylesheet for classes that look like headings (bold, larger, centred, or named head/title), and classes that are bold. */
function cssClasses(css){
  const head=new Map(), bold=new Set(); css=String(css||'').replace(/\/\*[\s\S]*?\*\//g,'');
  const re=/([^{}@]+)\{([^{}]*)\}/g; let m;
  while((m=re.exec(css))){
    const d=m[2].toLowerCase();
    const isBold=/font-weight\s*:\s*(bold|bolder|[6-9]00)\b/.test(d);
    let big=false; const fs=d.match(/font-size\s*:\s*(?:([\d.]+)\s*(em|rem|%|pt|px)?|(larger|large|x-large|xx-large))/);
    if(fs){ if(fs[3]) big=true; else { const v=parseFloat(fs[1]), u=fs[2]||''; big= u==='%'? v>=112 : (u==='em'||u==='rem')? v>=1.12 : u==='pt'? v>=14 : u==='px'? v>=19 : false; } }
    const center=/text-align\s*:\s*center/.test(d), caps=/font-variant\s*:\s*small-caps|text-transform\s*:\s*uppercase/.test(d);
    for(const sel of m[1].split(',')){
      const last=(sel.trim().split(/[\s>+~]+/).pop()||'').replace(/::?[\w-]+(\(.*?\))?/g,'');
      const tg=(last.match(/^[a-z][\w-]*/i)||[''])[0].toLowerCase(); if(tg && !/^(p|div|span|section)$/.test(tg)) continue;
      for(const c of (last.match(/\.[\w-]+/g)||[]).map(x=>x.slice(1))){
        if(isBold) bold.add(c);
        if(tg==='span') continue;
        const hint=/(^|[-_])(h[1-6]|head|header|heading|title|subtitle|subhead|chaptertitle|sectiontitle|chapter-title|section-title)($|[-_\d])/i.test(c);
        const score=(isBold?1:0)+(big?1:0)+(center?1:0)+(caps?.5:0)+(hint?1.5:0);
        if(score>=2){ const prev=head.get(c); head.set(c,{big:big||(prev&&prev.big), center:center||(prev&&prev.center)}); }
      }
    }
  }
  return {head, bold};
}
function headingOf(n, ctx){
  const tx=(n.textContent||'').replace(/\s+/g,' ').trim(); if(!tx || tx.length>160) return null;
  if(n.querySelector && n.querySelector('p,div,li,table,img,blockquote')) return null;
  if(ctx.headCls && ctx.headCls.size){ for(const c of (n.getAttribute('class')||'').split(/\s+/)){ const h=ctx.headCls.get(c); if(h) return {tag:h.big?'h3':'h4', center:!!h.center}; } }
  /* a short paragraph that is entirely bold, with no closing punctuation, reads as a sub-heading */
  if((n.localName||'').toLowerCase()==='p' && tx.length<=100 && !/[.,;:!?…”"']$/.test(tx) && tx.split(' ').length<=14){
    const kids=[...n.childNodes].filter(c=>c.nodeType===1||(c.nodeType===3&&c.nodeValue.trim()));
    if(kids.length===1 && kids[0].nodeType===1){ const k=kids[0], kt=(k.localName||'').toLowerCase(); const kc=(k.getAttribute('class')||'').split(/\s+/);
      if(kt==='b'||kt==='strong'||(ctx.boldCls&&kc.some(c=>ctx.boldCls.has(c)))) return {tag:'h4', center:false}; }
  }
  return null;
}
/* walks an HTML tree into words, keeping paragraph types and inline styles */
function walkHTML(root, ctx, path){
  const rich=!!ctx.blocks;
  let buf='', segs=[], flags=0, quote=0, hLeft=0;
  const stack=[];
  const curType=()=>{ for(let k=stack.length-1;k>=0;k--){ const t=stack[k]; if(/^h[1-6]$/.test(t)) return t; if(t==='li'||t==='dt') return 'li'; if(t==='pre') return 'pre'; if(t==='figcaption'||t==='caption') return 'cap'; } return 'p'; };
  const flush=()=>{
    if(!/\S/.test(buf)){ buf=''; segs=[]; return; }
    const s=ctx.words.length;
    if(!rich){ pushAll(ctx.words, splitWords(buf)); }
    else{
      const re=/\S+/g; let m;
      while((m=re.exec(buf))){
        const tokS=m.index, tokE=m.index+m[0].length;
        /* style runs that touch this token */
        const runs=[]; for(let q=0;q<segs.length;q++){ const a=segs[q][0], b=q+1<segs.length?segs[q+1][0]:buf.length; if(b>tokS && a<tokE) runs.push([Math.max(a,tokS), Math.min(b,tokE), segs[q][1]]); }
        if(!runs.length) runs.push([tokS,tokE,0]);
        /* split a token where superscripts, subscripts or note links begin or end, so they render properly */
        let pieceS=tokS, pieceF=runs[0][2], first=true;
        const emit=(a,b,f)=>{ const t=buf.slice(a,b); if(!t) return; ctx.words.push(t); ctx.wf.push((f&~F_GLUE)|(first?0:F_GLUE)); first=false; };
        for(let q=1;q<runs.length;q++){
          const f=runs[q][2];
          if(((f^pieceF)&(F_P|F_S|F_N))){ emit(pieceS, runs[q][0], pieceF); pieceS=runs[q][0]; pieceF=f; }
          else if(runs[q][1]-runs[q][0] > (runs[q][0]-pieceS)) pieceF=(pieceF&(F_P|F_S|F_N))|(f&~(F_P|F_S|F_N));
        }
        emit(pieceS, tokE, pieceF);
      }
    }
    buf=''; segs=[];
    if(ctx.words.length>s){ ctx.ends.push(ctx.words.length-1); if(rich){ const b={s, e:ctx.words.length, t:curType()}; if(quote) b.q=1; if(hLeft && /^h/.test(b.t)) b.l=1; if(ctx.gap){ b.g=1; ctx.gap=false; } ctx.blocks.push(b); } }
  };
  const addText=(t)=>{ if(rich && (!segs.length || segs[segs.length-1][1]!==flags)) segs.push([buf.length, flags]); buf+=t; };
  const visit=(n)=>{
    if(n.nodeType===3){
      if(rich && stack.includes('pre') && n.nodeValue.includes('\n')){ const parts=n.nodeValue.split('\n'); parts.forEach((p,k)=>{ if(k){ if(!/\S/.test(buf)) ctx.gap=true; flush(); } addText(p); }); }
      else addText(n.nodeValue);
      return;
    }
    if(n.nodeType!==1) return;
    const tag=(n.localName||'').toLowerCase();
    if(ctx.images && (tag==='img'||tag==='image'||tag==='svg')){
      let src=null, alt='';
      const href=(x)=>x.getAttribute('href')||x.getAttributeNS('http://www.w3.org/1999/xlink','href')||x.getAttribute('xlink:href');
      if(tag==='svg'){ const im=n.getElementsByTagNameNS('*','image')[0]; if(im) src=href(im); }
      else { src=n.getAttribute('src')||href(n); alt=n.getAttribute('alt')||''; }
      if(src && !/^(https?:|data:)/i.test(src)){ flush(); ctx.images.push({i:ctx.words.length, path:resolvePath(dirOf(path), src), alt}); }
      return;
    }
    if(SKIP.has(tag)) return;
    const isB=BLOCK.has(tag);
    if(isB) flush();
    const id=n.getAttribute&&(n.getAttribute('id')||(tag==='a'&&n.getAttribute('name')));
    if(id && ctx.anchors) ctx.anchors[path+'#'+id]=ctx.words.length+splitWords(buf).length;
    if(tag==='br'){ flush(); return; }
    if(tag==='hr'){ flush(); if(rich) ctx.breaks.push(ctx.words.length); return; }
    if(/^h[1-3]$/.test(tag) && ctx.firstHeading && !ctx.firstHeading[path]){ const t=(n.textContent||'').trim(); if(t) ctx.firstHeading[path]=t.slice(0,100); }
    const saveFlags=flags; let isNote=false, ptag=tag, left=false;
    if(rich && (tag==='p'||tag==='div') && !stack.some(x=>/^h[1-6]$/.test(x))){
      const hd=headingOf(n, ctx); if(hd){ ptag=hd.tag; left=!hd.center; }
    }
    if(rich){
      if(INLINE_FLAG[tag]) flags|=INLINE_FLAG[tag];
      if(ctx.boldCls && ctx.boldCls.size){ const cl=(n.getAttribute('class')||'').split(/\s+/); if(cl.some(c=>ctx.boldCls.has(c))) flags|=F_B; }
      if(tag==='a' && ctx.anchors){
        const href=n.getAttribute('href')||'';
        const et=(n.getAttribute('epub:type')||n.getAttributeNS('http://www.idpf.org/2007/ops','type')||n.getAttribute('role')||'');
        const txt=(n.textContent||'').trim();
        const hint=/note|fn|ftn|sup|super|ref/i.test((n.getAttribute('class')||'')+' '+(n.getAttribute('id')||'')+' '+href.split('#')[1]);
        const inSup=stack.includes('sup') || !!(n.querySelector&&n.querySelector('sup'));
        const sym=/^[\[(]?[*†‡§¶]{1,3}[\])]?$/.test(txt), bracket=/^[\[(]\d{1,3}[\])]$/.test(txt), digit=/^\d{1,3}$/.test(txt), letter=/^[a-z]{1,2}$/i.test(txt);
        if(href.includes('#') && (/noteref/.test(et) || sym || bracket || ((digit||letter) && (inSup||hint)))){
          isNote=true; flags|=F_N;
          const full=href.startsWith('#')? path+href : resolvePath(dirOf(path), href);
          ctx.notes.push({at:ctx.words.length, buf:buf, full});
        }
      }
      if(tag==='blockquote') quote++;
      stack.push(ptag); if(left) hLeft++;
    }
    for(let c=n.firstChild;c;c=c.nextSibling) visit(c);
    if(isB) flush(); /* before leaving the element, so the paragraph keeps its type */
    if(rich){ stack.pop(); if(left) hLeft--; if(tag==='blockquote') quote--; flags=saveFlags; }
  };
  visit(root); flush();
}
/* note references were recorded with the text buffered at the time; turn them into word indexes */
function resolveNotes(ctx, lookup){
  const out=[];
  for(const nt of ctx.notes){
    const before=splitWords(nt.buf).length; const glued=nt.buf && !/\s$/.test(nt.buf);
    let i=nt.at+before; if(glued){ /* the reference was split off as its own glued word */ }
    while(i<ctx.words.length && !(ctx.wf[i]&F_N)) i++;
    const t=lookup(nt.full);
    if(i<ctx.words.length && t!==undefined && t!==i) out.push([i,t]);
  }
  return out;
}
/* books imported before formatting was kept: rebuild simple paragraphs (and headings from the chapter list) */
function deriveBlocks(text, chapters){
  if(text.blocks && text.blocks.length) return text.blocks;
  const out=[]; let s=0; const heads=new Map((chapters||[]).map(c=>[c.i,c]));
  const ends=(text.ends||[]).slice().sort((a,b)=>a-b);
  const norm=(x)=>String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  for(const e of ends){ if(e<s) continue; const b={s, e:e+1, t:'p'}; const c=heads.get(s);
    if(c && b.e-b.s<=16 && !/^Page \d+$/.test(c.t)){ const bt=norm(text.words.slice(b.s,b.e).join(' ')), ct=norm(c.t); if(ct && (bt===ct || bt.startsWith(ct.slice(0,24)) || ct.startsWith(bt))) b.t='h2'; }
    out.push(b); s=e+1; }
  if(s<text.words.length) out.push({s, e:text.words.length, t:'p'});
  return out;
}

/* ---------- progress ---------- */
let toastT;
/*@@OLD:442-469@@*/
async function parseEpub(buf, fname, onP){
  const P=onP||(()=>{});
  P('Loading the EPUB reader…', 6);
  await loadScript(CDN.jszip);
  P('Unzipping…', 10);
  let zip;
  try{ zip=await JSZip.loadAsync(buf); }
  catch(e){ throw new Error('This file isn’t a complete EPUB. If it’s stored in iCloud, download it in the Files app first, then try again.'); }
  const files={}; zip.forEach((p,f)=>{ if(f.dir) return; files[p]=f; files[p.toLowerCase()]=files[p.toLowerCase()]||f; });
  /* decode each file in the character set it declares (most are UTF-8; some older books use Latin-1 or Windows-1252) */
  const read=async(p)=>{ const f=files[p]||files[p.toLowerCase()]; if(!f) return null;
    const u8=await f.async('uint8array');
    if(u8[0]===0xFE&&u8[1]===0xFF) return new TextDecoder('utf-16be').decode(u8);
    if(u8[0]===0xFF&&u8[1]===0xFE) return new TextDecoder('utf-16le').decode(u8);
    try{ return new TextDecoder('utf-8',{fatal:true}).decode(u8); }catch(e){}
    const head=new TextDecoder('windows-1252').decode(u8.subarray(0,1024));
    const cs=(head.match(/<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)/i)||[])[1]||'windows-1252';
    try{ return new TextDecoder(cs).decode(u8); }catch(e){ return new TextDecoder('windows-1252').decode(u8); } };
  const cont=await read('META-INF/container.xml'); if(!cont) throw new Error('This EPUB is missing its table of contents file.');
  const rf=byTag(parseXML(cont),'rootfile')[0]; if(!rf||!rf.getAttribute('full-path')) throw new Error('This EPUB could not be read.');
  const opfPath=rf.getAttribute('full-path'); const base=dirOf(opfPath);
  const opfText=await read(opfPath); if(!opfText) throw new Error('This EPUB could not be read.');
  const opf=parseXML(opfText);
  const title=(byTag(opf,'title')[0]?.textContent||'').trim() || fname.replace(/\.[^.]+$/,'');
  const lang=(byTag(opf,'language')[0]?.textContent||'').trim().slice(0,12);
  const author=[...new Set(byTag(opf,'creator').map(c=>c.textContent.replace(/\s+/g,' ').trim()).filter(Boolean))].slice(0,3).join(', ');
  const seSub=[...opf.getElementsByTagName('meta')].find(m=>m.getAttribute('property')==='se:subject');
  const dcSub=byTag(opf,'subject').map(x=>x.textContent.replace(/\s+/g,' ').trim()).find(x=>x && !x.includes('--') && x.length<=40);
  const category=((seSub&&seSub.textContent)||dcSub||'').replace(/\s+/g,' ').trim().slice(0,60);
  const subjects=[...new Set([...[...opf.getElementsByTagName('meta')].filter(m=>m.getAttribute('property')==='se:subject').map(m=>m.textContent), ...byTag(opf,'subject').map(x=>x.textContent)].map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean))].slice(0,20);
  const items={}; let navHref=null;
  for(const it of byTag(opf,'item')){ const href=resolvePath(base,it.getAttribute('href')||''); items[it.getAttribute('id')]={href, type:it.getAttribute('media-type')||'', props:it.getAttribute('properties')||''}; if(/\bnav\b/.test(it.getAttribute('properties')||'')) navHref=href; }
  const spineEl=byTag(opf,'spine')[0]; if(!spineEl) throw new Error('This EPUB has no readable chapters.');
  const tocId=spineEl.getAttribute('toc');
  /* copy protection: refuse up front instead of importing scrambled text */
  const DRM_MSG='This book is copy-protected (DRM), so its text can’t be read.';
  if(files['META-INF/rights.xml']||files['META-INF/sinf.xml']) throw new Error(DRM_MSG);
  const encXml=await read('META-INF/encryption.xml'); const encSet=new Set();
  if(encXml){
    const enc=parseXML(encXml); const spinePaths=new Set(byTag(spineEl,'itemref').map(r=>items[r.getAttribute('idref')]?.href.toLowerCase()).filter(Boolean));
    for(const ed of byTag(enc,'EncryptedData')){
      const alg=byTag(ed,'EncryptionMethod')[0]?.getAttribute('Algorithm')||'';
      const uri=byTag(ed,'CipherReference')[0]?.getAttribute('URI')||'';
      encSet.add(resolvePath('',uri).toLowerCase());
      if(/idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/.test(alg)) continue; /* font obfuscation only */
      if(spinePaths.has(resolvePath('',uri).toLowerCase())) throw new Error(DRM_MSG);
    }
  }
  const refs=byTag(spineEl,'itemref');
  const ctx=newCtx(true); const fileStarts=[];
  try{ ctx.headCls=new Map(); ctx.boldCls=new Set(); for(const it of Object.values(items)){ if(!/css/.test(it.type)) continue; const css=await read(it.href); if(!css) continue; const r=cssClasses(css); for(const [k,v] of r.head) ctx.headCls.set(k,v); for(const b of r.bold) ctx.boldCls.add(b); } }catch(e){}
  let done=0;
  for(const ref of refs){
    done++;
    if(done%8===0){ P('Reading chapter '+done+' of '+refs.length+'…', 20+50*done/refs.length); await yieldUI(); }
    const it=items[ref.getAttribute('idref')]; if(!it) continue;
    if(it.type && !/html|xml/.test(it.type)) continue;
    const html=await read(it.href); if(html==null) continue;
    const d=parseXHTML(html); const body=d.body||d.getElementsByTagNameNS('*','body')[0]||d.documentElement;
    try{ for(const st of d.getElementsByTagName('style')){ const r=cssClasses(st.textContent); for(const [k,v] of r.head) if(!ctx.headCls.has(k)) ctx.headCls.set(k,v); for(const b of r.bold) ctx.boldCls.add(b); } }catch(e){}
    ctx.anchors[it.href]=ctx.words.length; fileStarts.push({path:it.href, i:ctx.words.length});
    walkHTML(body, ctx, it.href);
  }
  if(!ctx.words.length) throw new Error(encXml ? DRM_MSG : 'No readable text was found in this EPUB.');
  P('Building the chapter list…', 70);
  const lookup=(full)=>{ if(full in ctx.anchors) return ctx.anchors[full]; const p=full.split('#')[0]; return p in ctx.anchors? ctx.anchors[p] : undefined; };
  let chapters=[];
  try{
    if(navHref){
      const nd=parseXHTML(await read(navHref)||''); const nbase=dirOf(navHref);
      const navs=byTag(nd,'nav'); const nav=navs.find(n=>(n.getAttribute('epub:type')||n.getAttributeNS('http://www.idpf.org/2007/ops','type')||'').includes('toc')) || navs[0];
      const kids=(el,name)=>[...el.children].filter(c=>c.localName===name);
      const walkOl=(ol,depth)=>{ for(const li of kids(ol,'li')){ const a=[...li.children].find(c=>c.localName==='a'||c.localName==='span'); if(a&&a.getAttribute('href')){ const i=lookup(resolvePath(nbase,a.getAttribute('href'))); const t=(a.textContent||'').replace(/\s+/g,' ').trim(); if(i!==undefined&&t) chapters.push({t:t.slice(0,100),i,d:depth}); } const sub=kids(li,'ol')[0]; if(sub) walkOl(sub,depth+1); } };
      const ol=nav&&byTag(nav,'ol')[0]; if(ol) walkOl(ol,0);
    }
    if(!chapters.length && tocId && items[tocId]){
      const np=items[tocId].href; const nx=parseXML(await read(np)||''); const nbase=dirOf(np);
      const walkNp=(el,depth)=>{ for(const pt of [...el.children].filter(c=>c.localName==='navPoint')){ const t=(byTag(pt,'text')[0]?.textContent||'').replace(/\s+/g,' ').trim(); const src=byTag(pt,'content')[0]?.getAttribute('src'); if(src&&t){ const i=lookup(resolvePath(nbase,src)); if(i!==undefined) chapters.push({t:t.slice(0,100),i,d:depth}); } walkNp(pt,depth+1); } };
      const nm=byTag(nx,'navMap')[0]; if(nm) walkNp(nm,0);
    }
  }catch(e){ chapters=[]; }
  if(!chapters.length){ fileStarts.forEach((f,k)=>{ if(k===0||f.i!==fileStarts[k-1].i) chapters.push({t:ctx.firstHeading[f.path]||('Section '+(chapters.length+1)), i:f.i, d:0}); }); }
  chapters=chapters.filter(c=>c.i<ctx.words.length).sort((a,b)=>a.i-b.i);
  const notes=resolveNotes(ctx, lookup);
  /* images: each picture file once (kept as a Blob, not text), plus every place it appears */
  const typeByHref={}; for(const k in items) typeByHref[items[k].href]=items[k].type;
  const imgFiles=[], fidx={}, at=[]; let missing=0, n=0;
  const uniq=new Set(ctx.images.map(im=>im.path.split('#')[0])).size;
  for(const im of ctx.images){
    const p=im.path.split('#')[0];
    if(!(p in fidx)){
      n++; P('Loading picture '+n+' of '+uniq+'…', 72+18*n/Math.max(1,uniq)); if(n%4===0) await yieldUI();
      const f=files[p]||files[p.toLowerCase()];
      if(!f){ fidx[p]=-1; }
      else { try{ const raw=await f.async('blob'); fidx[p]=imgFiles.length; imgFiles.push({path:p, blob:new Blob([raw],{type:typeByHref[p]||guessImgType(p)})}); }catch(e){ fidx[p]=-1; } }
    }
    if(fidx[p]>=0) at.push({i:Math.min(im.i,ctx.words.length), f:fidx[p], alt:im.alt}); else missing++;
  }
  P('Looking for the book’s font…', 92);
  let font=null; try{ font=await epubFont(items, read, files, encSet); }catch(e){ font=null; }
  const secs=[...new Set(fileStarts.map(f=>f.i))].filter(i=>i>0&&i<ctx.words.length);
  return {title, author, category, subjects, lang, kind:'epub', words:ctx.words, ends:ctx.ends, chapters, blocks:ctx.blocks, wf:ctx.wf, notes, breaks:ctx.breaks, secs, font, images: at.length?{files:imgFiles, at}:null, imagesMissing:missing};
}
/* the font the book's own stylesheet uses for body text, if it ships one */
async function epubFont(items, read, files, encSet){
  const faces=[], use={};
  for(const k in items){
    const it=items[k]; if(!/css/.test(it.type) && !/\.css$/i.test(it.href)) continue;
    const txt=await read(it.href); if(!txt) continue; const cb=dirOf(it.href);
    const clean=txt.replace(/\/\*[\s\S]*?\*\//g,'');
    clean.replace(/@font-face\s*\{([^}]*)\}/gi,(m,body)=>{
      const fam=(body.match(/font-family\s*:\s*["']?([^;"']+)["']?/i)||[])[1];
      const srcs=[...body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map(m=>m[1]).filter(u=>!/^data:/i.test(u));
      if(fam&&srcs.length) faces.push({fam:fam.trim(), paths:srcs.map(u=>resolvePath(cb,u)), w:((body.match(/font-weight\s*:\s*([\w]+)/i)||[])[1]||'normal'), st:((body.match(/font-style\s*:\s*(\w+)/i)||[])[1]||'normal')});
      return '';
    });
    clean.replace(/([^{}@]+)\{([^}]*)\}/g,(m,sel,body)=>{
      const ff=(body.match(/font-family\s*:\s*([^;]+)/i)||[])[1]; if(!ff) return '';
      const first=ff.split(',')[0].trim().replace(/["']/g,'');
      const weight=/(^|[\s,])(html|body|p|div|\.calibre\d*|\.text|\.body\w*)(?=[\s,.:#>{]|$)/i.test(sel.trim())?5:1;
      use[first]=(use[first]||0)+weight; return '';
    });
  }
  if(!faces.length) return null;
  const fams=[...new Set(faces.map(f=>f.fam))].filter(f=>!/mono|code|courier/i.test(f));
  if(!fams.length) return null;
  fams.sort((a,b)=>(use[b]||0)-(use[a]||0));
  const fam=fams[0]; if(!use[fam]) return null;
  const out=[];
  for(const f of faces.filter(x=>x.fam===fam)){
    const path=f.paths.find(p=>(files[p]||files[p.toLowerCase()]) && !encSet.has(p.toLowerCase())); if(!path) continue;
    const file=files[path]||files[path.toLowerCase()];
    const raw=await file.async('blob'); if(raw.size>3*1048576) continue;
    out.push({w:f.w, st:f.st, blob:new Blob([raw])});
  }
  return out.length? {family:fam, faces:out} : null;
}

/*@@OLD:554-587@@*/
async function parseFile(file, onP){
  const name=file.name||'Document'; const ext=(name.split('.').pop()||'').toLowerCase();
  (onP||(()=>{}))('Opening “'+name+'”…', 3);
  const buf=await file.arrayBuffer(); const head=new Uint8Array(buf.slice(0,5));
  const isZip=head[0]===0x50&&head[1]===0x4B; const isPdf=head[0]===0x25&&head[1]===0x50&&head[2]===0x44&&head[3]===0x46;
  if(ext==='epub'||(isZip&&ext!=='docx')) return parseEpub(buf,name,onP);
  if(ext==='pdf'||isPdf) return parsePdf(buf,name,onP);
  if(ext==='docx') throw new Error('Word files aren’t supported yet. Open the document, copy the text, and use Paste text.');
  const text=new TextDecoder('utf-8').decode(buf);
  if(ext==='html'||ext==='htm'||ext==='xhtml'){ const d=new DOMParser().parseFromString(text,'text/html'); const ctx=newCtx(false); walkHTML(d.body,ctx,''); return {title:(d.title||name.replace(/\.[^.]+$/,'')).trim(), kind:'web', words:ctx.words, ends:ctx.ends, blocks:ctx.blocks, wf:ctx.wf, breaks:ctx.breaks, chapters:[]}; }
  const m=fromPlainText(text); return {title:name.replace(/\.[^.]+$/,''), kind: ext==='md'?'md':'text', ...m};
}
