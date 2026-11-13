/* Tooz natural voice (Piper) worker. Bundled by src/piper/build.sh into ../../piper-worker.js.
   Uses @mintplex-labs/piper-tts-web (MIT) with onnxruntime-web 1.18.0.
   Voice files are downloaded from Hugging Face once and kept in the phone's private file storage (OPFS). */
import { TtsSession, stored, remove } from '@mintplex-labs/piper-tts-web';

let session = null, voice = null, busy = false;
const jobs = [];
const post = (m, t) => self.postMessage(m, t || []);

async function load(v) {
  if (session && voice === v) return;
  TtsSession._instance = null;            /* the library keeps one session; start fresh for a new voice */
  session = null; voice = null;
  const s = new TtsSession({ voiceId: v, progress: p => post({ type: 'progress', p: { file: p.url, loaded: p.loaded, total: p.total } }) });
  await s.waitReady;
  session = s; voice = v;
}
async function run() {
  if (busy) return; busy = true;
  while (jobs.length) {
    const j = jobs.shift();
    try {
      await load(j.voice);
      const t0 = performance.now();
      const wav = await session.predict(j.text);
      const buf = await wav.arrayBuffer();
      post({ type: 'audio', id: j.id, wav: buf, ms: performance.now() - t0 }, [buf]);
    } catch (err) { post({ type: 'error', id: j.id, msg: String((err && err.message) || err) }); }
  }
  busy = false;
}
self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'load') {
    try { await load(m.voice); post({ type: 'ready', voice: m.voice }); }
    catch (err) { post({ type: 'loaderror', msg: String((err && err.message) || err) }); }
  } else if (m.type === 'gen') { jobs.push(m); run(); }
  else if (m.type === 'cancel') { while (jobs.length) { const j = jobs.pop(); post({ type: 'error', id: j.id, msg: 'cancelled' }); } }
  else if (m.type === 'stored') { try { post({ type: 'stored', id: m.id, list: await stored() }); } catch (err) { post({ type: 'stored', id: m.id, list: [] }); } }
  else if (m.type === 'remove') { try { await remove(m.voice); } catch (err) {} if (voice === m.voice) { session = null; voice = null; TtsSession._instance = null; } post({ type: 'removed', id: m.id }); }
};
