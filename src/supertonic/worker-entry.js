/* Tooz Supertonic voice worker (test). Bundled by src/supertonic/build.sh into ../../supertonic-worker.js.
   Supertonic 3 (Supertone Inc.; model under the OpenRAIL-M license, sample code MIT) run with onnxruntime-web 1.31.1.
   The model is our own weight-only 8-bit copy (about 101 MB, see voices/supertonic/README.md), served from this site.
   (A third-party int8 copy was tried first; its integer math came out garbled in the browser engine.)
   It downloads once and is kept in the phone's private file storage (OPFS, folder "supertonic-w8"), so it works offline. */
import * as ort from 'onnxruntime-web/wasm';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/';
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

const BASE = new URL('voices/supertonic/', self.location.href).href;
const DIR = 'supertonic-w8';
const MODEL_FILES = ['onnx/tts.json', 'onnx/unicode_indexer.json', 'onnx/duration_predictor.onnx', 'onnx/text_encoder.onnx', 'onnx/vector_estimator.onnx', 'onnx/vocoder.onnx'];
/* denoising steps: fewer is faster. Starts at 5 and drops (to 3 at least) if this phone can't keep up; 2 steps garbles words */
let STEPS = 5;
const SPEED = 1.05;       /* the makers' default pace; the app's speed control is applied on playback */

let M = null;             /* loaded model: {cfg, indexer, dp, te, ve, voc} */
let style = null, voice = null, busy = false;
const jobs = [];
const post = (m, t) => self.postMessage(m, t || []);
const fname = p => p.replace(/\//g, '__');

let cleaned = false;
async function dir() {
  const root = await navigator.storage.getDirectory();
  if (!cleaned) { cleaned = true; try { await root.removeEntry('supertonic', { recursive: true }); } catch (e) {} }   /* the old, garbled copy */
  return root.getDirectoryHandle(DIR, { create: true });
}
async function readStored(name) { try { const d = await dir(); const f = await (await d.getFileHandle(name)).getFile(); return f.size ? f : null; } catch (e) { return null; } }
async function writeStored(name, chunks) {
  const d = await dir(); const fh = await d.getFileHandle(name, { create: true });
  if (fh.createWritable) { const w = await fh.createWritable(); for (const c of chunks) await w.write(c); await w.close(); return; }
  const h = await fh.createSyncAccessHandle(); h.truncate(0); let at = 0; for (const c of chunks) { h.write(c, { at }); at += c.byteLength; } h.flush(); h.close();
}
/* fetch every missing file, reporting progress per file */
/* exact sizes, so progress covers the whole download from the start and a half-saved file is never mistaken for a whole one
   (GitHub Pages compresses some files, so the server's own length can't be trusted) */
const SIZES = { 'onnx/tts.json': 8253, 'onnx/unicode_indexer.json': 277676, 'onnx/duration_predictor.onnx': 1202876, 'onnx/text_encoder.onnx': 9695953,
  'onnx/vector_estimator.onnx': 65655054, 'onnx/vocoder.onnx': 25820142 };
const VOICE_SIZE = 292500;
async function have(p) { const f = await readStored(fname(p)); return !!f && (!SIZES[p] || f.size === SIZES[p]); }
/* fetch every missing file straight into storage (nothing large is held in memory), reporting overall progress */
async function ensureFiles(paths) {
  const need = [];
  for (const p of paths) if (!(await have(p))) need.push(p);
  if (!need.length) return;
  const total = need.reduce((a, p) => a + (SIZES[p] || VOICE_SIZE), 0); let done = 0;
  const report = n => post({ type: 'progress', p: { file: BASE, loaded: Math.min(done + n, total), total } });
  for (const p of need) {
    let tries = 0;
    for (;;) {
      try { await fetchTo(p, report); break; }
      catch (e) { if (++tries >= 3) throw e; }
    }
    done += SIZES[p] || VOICE_SIZE; report(0);
  }
}
async function fetchTo(p, report) {
  const ac = new AbortController(); let timer = 0;
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(), 30000); };   /* give up on a stalled download after 30 s and retry */
  kick();
  try {
    const r = await fetch(BASE + p, { signal: ac.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('Download failed (' + r.status + ')');
    const d = await dir(); const fh = await d.getFileHandle(fname(p), { create: true });
    const rd = r.body.getReader(); let loaded = 0;
    if (fh.createWritable) {
      const w = await fh.createWritable();
      try { for (;;) { kick(); const { done, value } = await rd.read(); if (done) break; await w.write(value); loaded += value.byteLength; report(loaded); } await w.close(); }
      catch (e) { try { await w.abort(); } catch (e2) {} throw e; }
    } else {
      const h = await fh.createSyncAccessHandle(); h.truncate(0);
      try { for (;;) { kick(); const { done, value } = await rd.read(); if (done) break; h.write(value, { at: loaded }); loaded += value.byteLength; report(loaded); } h.flush(); } finally { h.close(); }
    }
    if (SIZES[p] && loaded !== SIZES[p]) throw new Error('Download incomplete');
  } finally { clearTimeout(timer); }
}
async function loadModel(extra) {
  if (M) return;
  await ensureFiles(MODEL_FILES.concat(extra || []));   /* the first voice comes in the same download, so progress runs once to 100% */
  const txt = async p => JSON.parse(await (await readStored(fname(p))).text());
  const bin = async p => new Uint8Array(await (await readStored(fname(p))).arrayBuffer());
  const opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' };
  const cfg = await txt('onnx/tts.json'), indexer = await txt('onnx/unicode_indexer.json');
  const dp = await ort.InferenceSession.create(await bin('onnx/duration_predictor.onnx'), opt);
  const te = await ort.InferenceSession.create(await bin('onnx/text_encoder.onnx'), opt);
  const ve = await ort.InferenceSession.create(await bin('onnx/vector_estimator.onnx'), opt);
  const voc = await ort.InferenceSession.create(await bin('onnx/vocoder.onnx'), opt);
  M = { cfg, indexer, dp, te, ve, voc };
}
const flat = a => Array.isArray(a) ? a.flat(Infinity) : a;
async function load(v) {
  await loadModel(['voice_styles/' + v + '.json']);
  if (style && voice === v) return;
  const p = 'voice_styles/' + v + '.json';
  await ensureFiles([p]);
  const j = JSON.parse(await (await readStored(fname(p))).text());
  style = {
    ttl: new ort.Tensor('float32', Float32Array.from(flat(j.style_ttl.data)), j.style_ttl.dims),
    dp: new ort.Tensor('float32', Float32Array.from(flat(j.style_dp.data)), j.style_dp.dims)
  };
  voice = v;
}

/* ---- text: the makers' clean-up, then split into pieces of up to 300 characters at sentence ends ---- */
function prep(text) {
  text = text.normalize('NFKD');
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu, '');
  const rep = { '–': '-', '‑': '-', '—': '-', '_': ' ', '“': '"', '”': '"', '‘': "'", '’': "'", '´': "'", '`': "'", '[': ' ', ']': ' ', '|': ' ', '/': ' ', '#': ' ', '→': ' ', '←': ' ' };
  for (const k in rep) text = text.split(k).join(rep[k]);
  text = text.replace(/[♥☆♡©\\]/g, '').split('@').join(' at ').split('e.g.,').join('for example, ').split('i.e.,').join('that is, ');
  text = text.replace(/ ([,.!?;:'])/g, '$1').replace(/"{2,}/g, '"').replace(/'{2,}/g, "'").replace(/\s+/g, ' ').trim();
  if (!/[.!?;:,'")\]}…]$/.test(text)) text += '.';
  return '<en>' + text + '</en>';
}
function pieces(text, max = 300) {
  const sents = text.trim().split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/);
  const out = []; let cur = '';
  for (const s of sents) { if (cur && cur.length + s.length + 1 > max) { out.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s; }
  if (cur) out.push(cur);
  return out;
}
function gauss(n) { const a = new Float32Array(n); for (let i = 0; i < n; i += 2) { const u = Math.max(1e-4, Math.random()), v = Math.random(), r = Math.sqrt(-2 * Math.log(u)); a[i] = r * Math.cos(2 * Math.PI * v); if (i + 1 < n) a[i + 1] = r * Math.sin(2 * Math.PI * v); } return a; }
async function synth(text) {
  const t = prep(text), L = [...t].length, ids = new BigInt64Array(L); let k = 0;
  for (const ch of t) { const cp = ch.codePointAt(0); ids[k++] = BigInt(cp < M.indexer.length ? M.indexer[cp] : -1); }
  const idsT = new ort.Tensor('int64', ids, [1, L]);
  const maskT = new ort.Tensor('float32', new Float32Array(L).fill(1), [1, 1, L]);
  const dur = (await M.dp.run({ text_ids: idsT, style_dp: style.dp, text_mask: maskT })).duration.data[0] / SPEED;
  const emb = (await M.te.run({ text_ids: idsT, style_ttl: style.ttl, text_mask: maskT })).text_emb;
  const sr = M.cfg.ae.sample_rate, chunk = M.cfg.ae.base_chunk_size * M.cfg.ttl.chunk_compress_factor;
  const D = M.cfg.ttl.latent_dim * M.cfg.ttl.chunk_compress_factor, wavLen = Math.floor(dur * sr), T = Math.max(1, Math.ceil(wavLen / chunk));
  let xt = gauss(D * T);
  const lmask = new ort.Tensor('float32', new Float32Array(T).fill(1), [1, 1, T]);
  const tot = new ort.Tensor('float32', new Float32Array([STEPS]), [1]);
  for (let s = 0; s < STEPS; s++) {
    const out = await M.ve.run({ noisy_latent: new ort.Tensor('float32', xt, [1, D, T]), text_emb: emb, style_ttl: style.ttl, latent_mask: lmask, text_mask: maskT, current_step: new ort.Tensor('float32', new Float32Array([s]), [1]), total_step: tot });
    xt = Float32Array.from(out.denoised_latent.data);
  }
  const wav = (await M.voc.run({ latent: new ort.Tensor('float32', xt, [1, D, T]) })).wav_tts.data;
  return { wav: wav.subarray(0, Math.min(wav.length, wavLen || wav.length)), sr };
}
function toWav(parts, sr, gap) {
  const g = Math.floor(gap * sr); let n = 0; for (const p of parts) n += p.length; n += g * Math.max(0, parts.length - 1);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44; parts.forEach((p, i) => { if (i) o += g * 2; for (let k = 0; k < p.length; k++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, p[k])) * 32767, true); });
  return buf;
}
async function run() {
  if (busy) return; busy = true;
  while (jobs.length) {
    const j = jobs.shift();
    try {
      await load(j.voice);
      const t0 = performance.now(); const parts = []; let sr = 44100;
      for (const p of pieces(j.text)) { const r = await synth(p); parts.push(r.wav); sr = r.sr; }
      const buf = toWav(parts, sr, 0.15);
      /* keep up with playback: fewer steps when making speech takes more than ~80% of its length */
      let n = 0; for (const p of parts) n += p.length; const rtf = (performance.now() - t0) / 1000 / Math.max(0.5, n / sr);
      if (rtf > 0.8 && STEPS > 3) STEPS--; else if (rtf < 0.45 && STEPS < 5) STEPS++;
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
};
