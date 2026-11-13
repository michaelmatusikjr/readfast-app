/* Tooz downloaded-audio worker. Bundled by build.sh into ../../mp3-worker.js.
   Encodes read-aloud audio to MP3 a piece at a time (so a chapter is never held as raw audio) and saves files into the
   phone's private storage (OPFS, folder "audiobooks/<book id>/").
   Uses @breezystack/lamejs 1.2.7 (LGPL-3.0, unmodified; source: https://github.com/breezystack/lamejs). */
import { Mp3Encoder } from '@breezystack/lamejs';

let enc = null, out = [], id = null;
const BLOCK = 1152 * 8;
async function bookDir(book) { const root = await navigator.storage.getDirectory(); const a = await root.getDirectoryHandle('audiobooks', { create: true }); return a.getDirectoryHandle(book, { create: true }); }
async function save(book, name, data) {
  const fh = await (await bookDir(book)).getFileHandle(name, { create: true });
  if (fh.createWritable) { const w = await fh.createWritable(); await w.write(data); await w.close(); return; }
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  const h = await fh.createSyncAccessHandle(); try { h.truncate(0); h.write(bytes, { at: 0 }); h.flush(); } finally { h.close(); }
}
self.onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === 'start') { id = m.id; out = []; enc = new Mp3Encoder(1, m.sr, m.sr > 32000 ? 64 : 48); }
    else if (m.type === 'pcm') {
      if (!enc || m.id !== id) return;
      const d = m.data;
      for (let k = 0; k < d.length; k += BLOCK) { const b = enc.encodeBuffer(d.subarray(k, k + BLOCK)); if (b.length) out.push(new Uint8Array(b)); }
    } else if (m.type === 'end') {
      if (!enc || m.id !== id) throw new Error('nothing to save');
      const f = enc.flush(); if (f.length) out.push(new Uint8Array(f));
      let n = 0; for (const b of out) n += b.length; const all = new Uint8Array(n); let o = 0; for (const b of out) { all.set(b, o); o += b.length; }
      enc = null; out = [];
      await save(m.book, m.name, all.buffer);
      self.postMessage({ type: 'done', id: m.id, size: n });
    } else if (m.type === 'write') { await save(m.book, m.name, m.text); self.postMessage({ type: 'done', id: m.id }); }
    else if (m.type === 'abort') { enc = null; out = []; id = null; }
  } catch (err) { self.postMessage({ type: 'error', id: m.id, msg: String((err && err.message) || err) }); }
};
