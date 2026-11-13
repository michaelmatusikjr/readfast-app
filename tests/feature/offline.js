const { chromium } = require('playwright-core');
const S='/tmp/claude-0/-home-claude/99ef2298-0981-5d84-8afa-8770d83afcea/scratchpad/';
const P=S+'pip/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x).slice(0,400):''));
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--autoplay-policy=no-user-gesture-required','--ignore-certificate-errors'], proxy:{server:process.env.HTTPS_PROXY, bypass:'localhost,127.0.0.1'}});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', ignoreHTTPSErrors:true});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const cors={'access-control-allow-origin':'*'};
  await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/onnxruntime-web\/1\.18\.0\/(.*)/, r=>{ const f=r.request().url().split('/').pop(); r.fulfill({path:P+'build/node_modules/onnxruntime-web/dist/'+f, headers:Object.assign({'content-type':f.endsWith('.wasm')?'application/wasm':'application/javascript'},cors)}); });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/@diffusionstudio\/piper-wasm@1\.0\.0\/build\/(.*)/, r=>{ const f=r.request().url().split('/').pop(); r.fulfill({path:P+'pw/package/build/'+f, headers:Object.assign({'content-type':f.endsWith('.wasm')?'application/wasm':'application/octet-stream'},cors)}); });
  await ctx.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{ if(m.type()==='error' && !/ERR_|net::/.test(m.text())) errs.push('console '+m.text()); });
  await pg.goto('http://localhost:8750/'); await sleep(1500);
  await pg.evaluate(async()=>{
    closeSheet(); S.ttsEngine='natural'; S.pipVoice='en_US-lessac-medium'; S.ttsRate=1; S.mode='pages'; saveSettings();
    const c1='One. The first chapter is short. It has only a few sentences, but they are enough to test saving audio; the voice reads them in order.';
    const c2='Two. Here is the second chapter. It comes from Philippians 3:7–8 and ends with a question? Yes, it does.';
    const words=(c1+' '+c2).split(' '); const n1=c1.split(' ').length;
    const text={id:'abt', words, ends:[n1-1, words.length-1], blocks:[{s:0,e:1,t:'h1'},{s:1,e:n1,t:'p'},{s:n1,e:n1+1,t:'h1'},{s:n1+1,e:words.length,t:'p'}], wf:null, notes:null, breaks:null, secs:null, dashSplit:1, rangeJoin:1};
    await Store.put('texts',text);
    const m={id:'abt',title:'Audio Test',author:'Tester',kind:'text',count:words.length,chapters:[{t:'One',i:0,d:0},{t:'Two',i:n1,d:0}],pos:0,highlights:[],bookmarks:[],added:Date.now(),lastRead:Date.now(),mod:Date.now(),tags:[],dashSplit:1,rangeJoin:1};
    LIB.push(m); touch(m); await openDoc('abt');
  }); await sleep(800);
  await pg.evaluate(()=>{ $('#rTts').click(); openVoiceSheet(); }); await sleep(800);
  const s0=await pg.evaluate(()=>$('#abSec').textContent);
  ok('voice sheet offers the download', /Download this book’s audio/.test(s0), s0);
  await pg.evaluate(()=>document.querySelector('[data-act="abstart"]').click());
  let mf=null; for(let t=0;t<120;t++){ await sleep(1000); mf=await pg.evaluate(()=>AB.mf && !AB.job && (AB.mf.done || AB.mf.parts.length) ? {done:AB.mf.done, parts:AB.mf.parts.map(p=>({k:p.k,i:p.i,j:p.j,dur:p.dur,size:p.size,segs:p.segs.length}))} : null); if(mf) break; }
  ok('whole book downloaded in chapter parts', mf && mf.done && mf.parts.length===2 && mf.parts.every(p=>p.size>5000 && p.dur>3), mf);
  const s1=await pg.evaluate(()=>$('#abSec').textContent);
  ok('sheet shows downloaded', /Downloaded with Lessac/.test(s1), s1);
  const files=await pg.evaluate(async()=>{ const d=await abDir('abt'); const n=[]; for await (const [k] of d.entries()) n.push(k); return n.sort(); });
  ok('files saved', JSON.stringify(files)===JSON.stringify(['manifest.json','p0.mp3','p1.mp3']), files);
  /* decode chapter 2's mp3 to check the speech */
  const pcm=await pg.evaluate(async()=>{ const f=await abFile('abt','p1.mp3'); const ac=new OfflineAudioContext(1,16000*30,16000); const ab=await ac.decodeAudioData(await f.arrayBuffer()); const x=ab.getChannelData(0); const o=new Int16Array(x.length); for(let i=0;i<x.length;i++) o[i]=Math.max(-1,Math.min(1,x[i]))*32767; return {sr:ab.sampleRate, d:Array.from(o)}; });
  const buf=Buffer.alloc(44+pcm.d.length*2); buf.write('RIFF',0); buf.writeUInt32LE(36+pcm.d.length*2,4); buf.write('WAVE',8); buf.write('fmt ',12); buf.writeUInt32LE(16,16); buf.writeUInt16LE(1,20); buf.writeUInt16LE(1,22); buf.writeUInt32LE(pcm.sr,24); buf.writeUInt32LE(pcm.sr*2,28); buf.writeUInt16LE(2,32); buf.writeUInt16LE(16,34); buf.write('data',36); buf.writeUInt32LE(pcm.d.length*2,40);
  pcm.d.forEach((v,i)=>buf.writeInt16LE(v,44+i*2)); fs.writeFileSync(S+'st/offline_ch2.wav',buf);
  /* play from the saved audio, starting mid chapter 2 */
  await pg.evaluate(()=>{ closeSheet(); const k=R.words.indexOf('Philippians'); ttsPickWord(k); $('#ttsPlay').click(); }); await sleep(2500);
  const p1=await pg.evaluate(()=>[TTS.on, TTS.ab, R.words[TTS.cur], NAT.audio.currentTime.toFixed(2), NAT.audio.src.slice(0,5), navigator.mediaSession.metadata&&navigator.mediaSession.metadata.title]);
  ok('plays saved audio from the chosen sentence, words highlighted', p1[0] && p1[1] && p1[4]==='blob:' && +p1[3]>1 && p1[5]==='Two', p1);
  await sleep(6000);
  ok('reaches the end and finishes', await pg.evaluate(()=>!TTS.on), await pg.evaluate(()=>[TTS.on,TTS.cur,R.n]));
  const ch=await pg.evaluate(async()=>(await abChapterFiles()).map(g=>[g.name,g.parts.length,g.size>0]));
  ok('one file per chapter for saving', ch.length===2 && /^01 One - Audio Test\.mp3$/.test(ch[0][0]) && /^02 Two/.test(ch[1][0]), ch);
  await pg.evaluate(()=>{ openVoiceSheet(); }); await sleep(500);
  await pg.evaluate(()=>document.querySelector('[data-act="abshare"]').click()); await sleep(500);
  await pg.evaluate(()=>document.querySelector('[data-act="all"]').click()); await sleep(1500);
  ok('share sheet prepares files', await pg.evaluate(()=>/Ready/.test($('#abPrep').textContent)));
  await pg.evaluate(()=>{ S.pipVoice='en_US-amy-medium'; saveSettings(); openVoiceSheet(); }); await sleep(700);
  ok('other voice: saved audio not used', await pg.evaluate(()=>!abPartAt(0) && /saved with <b>Lessac/.test($('#abSec').innerHTML)));
  await pg.evaluate(async()=>{ S.pipVoice='en_US-lessac-medium'; saveSettings(); await abDelete('abt'); });
  ok('remove deletes it', await pg.evaluate(async()=>{ try{ await abDir('abt'); return false; }catch(e){ return !abPartAt(0); } }));
  ok('no page errors', !errs.length, errs);
  await b.close();
})();
