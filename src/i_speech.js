/* ---------- what read-aloud says ----------
   Builds the spoken text for a stretch of words: skips note markers and the notes themselves,
   reads scripture references and common abbreviations in full, never says "colon",
   and stops at the end of a paragraph so a pause can follow (longer before a heading). */
const BIBLE_BOOKS=(()=>{
  const full=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','Samuel','Kings','Chronicles','Ezra','Nehemiah','Esther','Job','Psalm','Psalms','Proverbs','Ecclesiastes','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','Corinthians','Galatians','Ephesians','Philippians','Colossians','Thessalonians','Timothy','Titus','Philemon','Hebrews','James','Peter','Jude','Revelation'];
  const m={}; for(const b of full) m[b.toLowerCase()]=b==='Psalms'?'Psalm':b;
  const ab={gen:'Genesis',gn:'Genesis',ex:'Exodus',exod:'Exodus',exo:'Exodus',lev:'Leviticus',lv:'Leviticus',num:'Numbers',nm:'Numbers',deut:'Deuteronomy',dt:'Deuteronomy',josh:'Joshua',jos:'Joshua',judg:'Judges',jdg:'Judges',ru:'Ruth',sam:'Samuel',sm:'Samuel',kgs:'Kings',ki:'Kings',chron:'Chronicles',chr:'Chronicles',neh:'Nehemiah',esth:'Esther',est:'Esther',ps:'Psalm',psa:'Psalm',pss:'Psalm',prov:'Proverbs',pr:'Proverbs',prv:'Proverbs',eccl:'Ecclesiastes',eccles:'Ecclesiastes',ecc:'Ecclesiastes',qoh:'Ecclesiastes',song:'Song of Songs',sos:'Song of Solomon',isa:'Isaiah',jer:'Jeremiah',lam:'Lamentations',ezek:'Ezekiel',eze:'Ezekiel',dan:'Daniel',hos:'Hosea',obad:'Obadiah',ob:'Obadiah',jon:'Jonah',mic:'Micah',nah:'Nahum',hab:'Habakkuk',zeph:'Zephaniah',hag:'Haggai',zech:'Zechariah',mal:'Malachi',matt:'Matthew',mt:'Matthew',mk:'Mark',mrk:'Mark',lk:'Luke',jn:'John',rom:'Romans',cor:'Corinthians',gal:'Galatians',eph:'Ephesians',phil:'Philippians',php:'Philippians',col:'Colossians',thess:'Thessalonians',thes:'Thessalonians',tim:'Timothy',tit:'Titus',philem:'Philemon',phlm:'Philemon',heb:'Hebrews',jas:'James',pet:'Peter',pt:'Peter',rev:'Revelation'};
  return Object.assign(m,ab);
})();
const BOOK_ORD={1:'First',2:'Second',3:'Third',i:'First',ii:'Second',iii:'Third'};
const ABBR={'e.g.':'for example','i.e.':'that is','etc.':'et cetera','cf.':'compare','vs.':'versus','viz.':'namely','Mr.':'Mister','Mrs.':'Missus','Ms.':'Miz','Dr.':'Doctor','Jr.':'Junior','Sr.':'Senior','Prof.':'Professor','pp.':'pages','ch.':'chapter','chap.':'chapter','chs.':'chapters','vol.':'volume','vols.':'volumes','vv.':'verses','ff.':'and following','ca.':'circa','approx.':'approximately','&':'and','A.D.':'A D','B.C.':'B C','a.m.':'A M','p.m.':'P M'};
const REF_RE=/^(\d{1,3}):(\d{1,3})[a-c]?(?:[–—-](\d{1,3})(?::(\d{1,3}))?[a-c]?)?$/;
const bookKey=w=>w.replace(/^[(\[“"‘']+/,'').replace(/[.,;:)\]”"’']+$/,'').toLowerCase();
function refPhrase(m, book){
  const [,c,v,x,y]=m; const ch=book==='Psalm'?`${c}`:`chapter ${c}`;
  if(x && y) return `${ch} verse ${v} through ${book==='Psalm'?'':'chapter '}${x} verse ${y}`;
  if(x) return `${ch} verses ${v} through ${x}`;
  return `${ch} verse ${v}`;
}
/* "3:7–" + "8": a number range that an earlier version split at the dash (books opened Nov 13); spoken as one */
const rangeJoin=k=>/\d[–-]$/.test(R.words[k]||'') && glued(k+1) && /^\d/.test(R.words[k+1]||'');
const coreOf=w=>String(w||'').replace(/^[(\[“"‘']+/,'').replace(/[.,;:!?)\]”"’'—–]+$/,'');
const isRef=w=>REF_RE.test(coreOf(w));
/* a book name (or abbreviation) that is followed by chapter:verse */
const bookAtWord=k=>{ const b=BIBLE_BOOKS[bookKey(R.words[k]||'')]; return b && isRef(R.words[k+1]) ? b : null; };
/* the period after these isn't the end of a sentence, so speech isn't split there */
function noBreakAfter(k){
  const w=R.words[k]||''; const bare=w.replace(/[)\]”"’']+$/,'');
  if(bookAtWord(k)) return true;
  if(ABBR[bare] && bare.endsWith('.')) return true;
  if(/^(St|Mt|Rev|No|no|p|pp|v|vv|ch|cf|vs|ca|c|vol|Gen|Ex|Lev|Num|Deut|Isa|Jer|Ezek|Dan|Matt|Rom|Cor|Gal|Eph|Phil|Col|Heb|Jas|Pet|Ps|Prov|Eccl|Gal|Thess|Tim)\.$/.test(bare)) return true;
  if(/^[A-Z]\.$/.test(bare)) return true; /* initials: C. S. Lewis */
  return false;
}
/* spoken form of each word from i to j (exclusive); '' means silent, null means unchanged.
   Looks at the words just before i and just after j too, so a reference split across two stretches still reads in full. */
function spokenWords(i, j){
  const out=new Array(j-i).fill(null);
  /* a reference list that started before this stretch ("Rom. 8:28; 12:1") */
  let book=null, bookAt=-99;
  for(let k=Math.max(0,i-8);k<i;k++){ if(isRef(R.words[k])){ const b=BIBLE_BOOKS[bookKey(R.words[k-1]||'')]; if(b){ book=b; bookAt=k; } else if(book && k-bookAt<=6) bookAt=k; } }
  let skip=false;
  for(let k=i;k<j;k++){
    if(skip){ skip=false; continue; }
    const join=k+1<j && rangeJoin(k);
    const raw=(R.words[k]||'')+(join? R.words[k+1] : '');
    if(join){ out[k+1-i]=''; out[k-i]=raw; skip=true; } const trail=(raw.match(/[.,;:!?)\]”"’'—–]+$/)||[''])[0];
    const core=coreOf(raw);
    const pausePunct=trail.replace(/[)\]”"’']/g,'').replace(/:/g,',');
    /* book name before chapter:verse ("Isa.", "1 Cor.") */
    const bk=bookAtWord(k);
    if(bk){
      const ord=BOOK_ORD[bookKey(R.words[k-1]||'')];
      out[k-i]=(ord?ord+' ':'')+bk; if(ord && k-1>=i) out[k-1-i]='';
      continue;
    }
    /* chapter:verse */
    const m=REF_RE.exec(core);
    if(m){
      const b=BIBLE_BOOKS[bookKey(R.words[k-1]||'')];
      if(b && isRef(raw)){ book=b; bookAt=k; out[k-i]=refPhrase(m,b)+pausePunct; continue; }
      if(book && k-bookAt<=6){ bookAt=k; out[k-i]=refPhrase(m,book)+pausePunct; continue; }
      out[k-i]=`${m[1]} ${m[2]}`+(m[3]?` to ${m[3]}`:'')+pausePunct; continue;
    }
    /* v. 6 / vv. 6–8 */
    if((core==='v' && trail.startsWith('.')) || core==='vv'){ out[k-i]=core==='v'?'verse':'verses'; continue; }
    const ab=ABBR[core+trail.slice(0,1)]||ABBR[raw.replace(/[,;)]+$/,'')]||ABBR[core];
    if(ab){ out[k-i]=ab+(trail.length>1?trail.slice(1).replace(/[)\]”"’':]/g,''):''); continue; }
    if(/^(St|Mt)\.$/.test(raw)){ const nx=R.words[k+1]||''; out[k-i]= /^[A-Z]/.test(nx)? (raw[0]==='S'?'Saint':'Mount') : (raw[0]==='S'?'Street':'Mount'); continue; }
    if(raw==='Rev.'){ out[k-i]='Reverend'; continue; }
    if(/^(no|No)\.$/.test(raw) && /^\d/.test(R.words[k+1]||'')){ out[k-i]='number'; continue; }
    if(/^p\.$/.test(raw) && /^\d/.test(R.words[k+1]||'')){ out[k-i]='page'; continue; }
    /* initialisms read letter by letter ("NIV" → N.I.V); acronyms said as words (NASA, FEMA) are left alone */
    const ac=acronymSpoken(raw); if(ac){ out[k-i]=ac; continue; }
  }
  return out;
}
/* Capitals with a vowel are read as a word (NASA, FEMA, LORD, I AM) unless listed in SPELL_OUT;
   capitals with no vowel (KJV, NSA, LSB) are always spelled, except Roman numerals and a few sounds. */
const SPELL_OUT=new Set(('NIV NIRV NASB NASB95 ESV ASV RSV NRSV NRSVUE NKJV KJV AKJV CSB HCSB NLT NET NAB NABRE NJB JB TEV GNT CEV CEB ISV WEB YLT LEB NCV ICB ERV MEV AMPC BSB LSB NEB REB TLB TPT '+
  'CIA FBI NSA IRS USA US UK EU UN UAE USSR KGB DOJ DOD DOE DOT DHS EPA FDA CDC NIH NIEHS OSHA? FAA FCC FTC SEC FEC ATF DEA ICE? TSA USPS UPS IBM HP AT&T CEO CFO COO CTO VP HR PR IT? '+
  'ATM PIN? PDF USB URL HTML CSS API AI IQ EQ ID? IOU UFO DIY FAQ ETA EST CST MST PST GMT UTC AM? PM? BC BCE AD CE OT NT LXX '+
  'YMCA YWCA NAACP NCAA NFL NBA MLB NHL NASCAR? ESPN CNN BBC NPR PBS ABC CBS NBC HBO MSNBC FOX? MIT UCLA USC LSU UCF TCU SMU BYU NYU UNC UVA UGA OSU ASU '+
  'MBA MD DDS RN LPN CPA PHD THD DMIN MDIV THM BA BS MA MS JD LLC INC? GPA SAT ACT? PTA PTSD ADHD OCD HIV DNA RNA ICU ER? EMT CPR IV? MRI CT ADA '+
  'USAF USMC USN ROTC POW MIA AWOL? GI VA VFW NATO? WWI WWII TV DVD CD PC OK? VIP RSVP ASAP? PS PPS NB IVP SBC PCA PCUSA ELCA LCMS UMC AME CMA EFCA OPC ARP BBQ').split(' ').filter(x=>!x.endsWith('?')));
const SAY_AS_WORD=new Set('NASA FEMA PETA NATO UNESCO UNICEF OPEC AIDS SCUBA LASER RADAR NASCAR SWAT GIF JPEG ZIP COVID POTUS SCOTUS FLOTUS NAFTA OSHA HUD CAPTCHA RAM ROM DOS MIDI WASP YOLO NIMBY AWOL ASAP IKEA LEGO FIFA ISIS NOAA DARPA SALT START ESL TESOL GAAP OPSEC HAZMAT SONAR WAC AMEN'.split(' '));
const NO_SPELL=new Set('MR MRS DR ST JR SR MT HMM HMMM SHH SHHH PSST BRR TSK GRR ZZZ PFFT MMM MM'.split(' '));
function acronymSpoken(raw){
  const m=/^[(\[“"‘']*([A-Z][A-Z&]*[A-Z](?:95)?|NIrV|PhD|ThD|ThM|DMin|MDiv)(['’]s|s)?([.,;:!?)\]”"’'—–]*)$/.exec(raw);
  if(!m) return null;
  const a=m[1], up=a.toUpperCase();
  if(SAY_AS_WORD.has(up) || NO_SPELL.has(up)) return null;
  let spell=SPELL_OUT.has(up);
  if(!spell && !/[AEIOUY]/.test(up) && !/^[MDCLXVI]+$/.test(up) && up.length<=6) spell=true;
  if(!spell) return null;
  const letters=up.replace('&',' and ').replace(/95$/,' 95');
  const said=letters.replace(/[A-Z]{2,}/g,x=>x.split('').join('.'));
  const tail=m[3]||'';
  return said+(m[2]? (m[2]==='s'?'s':"'s") : '')+tail.replace(/[)\]”"’']/g,'');
}
/* blocks that hold the text of footnotes/endnotes (read-aloud skips them) */
function noteBlocks(){
  if(R._nb && R._nbFor===R.meta) return R._nb;
  const s=new Set(); if(R.notes && R.blocks) for(const [ref,t] of R.notes){ if(t>ref) s.add(blockAt(t)); }
  R._nb=s; R._nbFor=R.meta; return s;
}
const isHeadBlock=b=>!!b && /^h\d/.test(b.t||'');
/* the next stretch to speak from word i: up to max words, ending at a sentence end (after min words) or the end of the paragraph */
/* a word that is only dots or an ellipsis (". . ." is stored as three such words) */
const dotTok=k=>/^[.…]+["”’)\]]*$/.test(R.words[k]||'');
/* an ellipsis, however it's typed (..., . . ., …), is one pause: a full stop before a capital or the end, else a comma */
function ellipsisPause(k){ let n=k+1; while(n<R.n && dotTok(n)) n++; const nx=R.words[n]||''; return (n>=R.n || /^["“‘(]*[A-Z]/.test(nx) || R.ends.has(k))? '.' : ','; }
/* an ellipsis followed by more of the same sentence keeps going in the same stretch */
const midEllipsis=k=>(dotTok(k) || /(?:\.\.|…)["”’)\]]*$/.test(R.words[k]||'')) && ellipsisPause(k)===',';
function speechChunk(i, max, min){
  const NB=noteBlocks();
  /* skip whole note blocks */
  let bi=blockAt(i);
  while(i<R.n && NB.has(bi)){ i=R.blocks[bi].e; bi=blockAt(i); }
  if(i>=R.n) return {i, j:R.n, text:'', cum:[], map:[], pauseAfter:0};
  const bEnd=R.blocks[bi]? R.blocks[bi].e : R.n;
  /* ". . ." written as separate dots is one pause: never end a stretch before a lone dot */
  let j=i, len=0, ends='cap'; while(j<R.n && j<bEnd && len<max){ j++; len++; if(len>=min && isSentEnd(j-1) && !noBreakAfter(j-1) && !dotTok(j) && !midEllipsis(j-1) && j<bEnd){ ends='sent'; break; } }
  if(j>=bEnd || j>=R.n) ends='block';
  /* a sentence too long for one stretch is cut at its last comma, semicolon, colon or dash, not mid-phrase */
  if(ends==='cap'){ for(let k=j-1;k>i+Math.max(3,min);k--){ if(/[,;:—–]["”’)\]]*$/.test(R.words[k]||'') && !rangeJoin(k) && !noBreakAfter(k)){ j=k+1; ends='clause'; break; } } }
  /* never end a stretch on a book name or abbreviation that belongs with the next word */
  while(j<bEnd && j<R.n && noBreakAfter(j-1) && j-i<max+8) j++;
  const sp=spokenWords(i,j);
  let text=''; const wt=[], map=[];
  for(let k=i;k<j;k++){
    map.push(text.length);
    if(R.wf && (R.wf[k]&F_N)){ wt.push(0); continue; }
    let w=sp[k-i]; if(w===''){ wt.push(0); continue; }
    if(w==null) w=R.words[k];
    if(dotTok(k)){ if(k>0 && (dotTok(k-1) || /(?:\.|…)["”’)\]]*$/.test(R.words[k-1]||''))){ wt.push(0); continue; } w=ellipsisPause(k); }
    else w=w.replace(/(?:\.\s*){2,}|…/g, ()=>ellipsisPause(k));
    w=w.replace(/:(?=\s|$)/g,',').replace(/:/g,' ');
    /* dashes pause like a comma and semicolons like a period (Nov 13); hyphens don't pause; number ranges read "to" */
    w=w.replace(/(\d)\s*[–-]\s*(\d)/g,'$1 to $2').replace(/\s*(?:[—–]|-{2,})\s*/g,', ').replace(/;/g,'.').replace(/\s+$/,'');
    /* a short pause before "(" and after ")" */
    const raw=R.words[k]||'';
    if(/^[(\[]/.test(raw) && text && !/[,;:.!?—–]$/.test(text)) text+=',';
    if(/[)\]]["”’]*$/.test(raw) && !/[,;:.!?]$/.test(w)) w+=',';
    /* a word split off after a dash still needs a space, or the pause is lost ("me...and") */
    if(k>i && text && (!glued(k) || /(\.\.\.|,)$/.test(text)) && !/^[.,]$/.test(w)) text+=' ';
    map[map.length-1]=text.length; text+=w;
    wt.push(w.replace(/[^\p{L}\p{N} ]/gu,'').length+1 + (/[,;]/.test(w)?3:0) + (/\.\.\./.test(w)?5:0) + (/[.!?]["”’)]*$/.test(w)?6:0));
  }
  const tot=wt.reduce((a,b)=>a+b,0)||1; let acc=0; const cum=wt.map(x=>{ const c=acc/tot; acc+=x; return c; });
  let pauseAfter=0;
  if(j>=bEnd){ const cur=R.blocks[bi], nx=R.blocks[bi+1]; pauseAfter= isHeadBlock(nx)? 1100 : isHeadBlock(cur)? 700 : 350; }
  return {i, j, text:text.trim(), cum, map, pauseAfter, ends};
}
/* listening speed, for "time left" while read-aloud is on (words per minute at normal speed, learned as you listen) */
function ttsLearn(words, ms){
  if(words<4 || ms<800) return; const w=words/(ms/60000)/(S.ttsRate||1); if(w<60||w>400) return;
  S.ttsWpm=S.ttsWpm?Math.round(S.ttsWpm*0.8+w*0.2):Math.round(w); saveSettings();
}
const ttsWpmNow=()=>(S.ttsWpm||165)*(S.ttsRate||1);
