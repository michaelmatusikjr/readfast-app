// Generates the test books used by tests/feature and tests/regression into tests/fixtures/.
// Run: npm run fixtures   (needs jszip from npm install). The originals were made in a cloud workspace that's gone;
// these are re-creations with the same names and the same broad shape (titles and features tests look for).
const JSZip = require('jszip'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const OUT = __dirname;
const LOREM = 'the quick reader turns another page and finds a quiet sentence waiting there with words enough for a careful test of how text flows across lines and pages in a small book'.split(' ');
let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
function para(n) { const w = []; for (let k = 0; k < n; k++) w.push(LOREM[Math.floor(rnd() * LOREM.length)]); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(' ') + '.'; }
function png(w, h, rgb) {   // a solid-colour PNG
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(rgb, y * (w * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const xhtml = (title, body) => `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title></head><body>${body}</body></html>`;
async function epub(file, { title, author = 'Test Author', chapters, images = [], epub3 = true, nav, opfDir = 'OEBPS', extra = {}, drm = false, upper = false }) {
  const z = new JSZip();
  z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  z.file('META-INF/container.xml', `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="${opfDir}/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  if (drm) z.file('META-INF/encryption.xml', `<?xml version="1.0"?><encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#"><CipherData><CipherReference URI="${opfDir}/c1.xhtml"/></CipherData></EncryptedData></encryption>`);
  const items = [], spine = [];
  chapters.forEach((c, k) => { const id = 'c' + (k + 1), href = (c.dir || '') + id + '.xhtml'; z.file(`${opfDir}/${href}`, c.raw || xhtml(c.title, `<h1>${c.title}</h1>` + c.body)); items.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`); spine.push(`<itemref idref="${id}"/>`); });
  images.forEach((im, k) => { z.file(`${opfDir}/${im.href}`, im.data); items.push(`<item id="img${k}" href="${im.href}" media-type="image/png"${k === 0 ? ' properties="cover-image"' : ''}/>`); });
  if (epub3) {
    const navHtml = nav || '<ol>' + chapters.map((c, k) => `<li><a href="${(c.dir || '')}c${k + 1}.xhtml">${c.title}</a></li>`).join('') + '</ol>';
    z.file(`${opfDir}/nav.xhtml`, xhtml('Contents', `<nav epub:type="toc"><h1>Contents</h1>${navHtml}</nav>`)); items.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
  } else {
    z.file(`${opfDir}/toc.ncx`, `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>${title}</text></docTitle><navMap>` + chapters.map((c, k) => `<navPoint id="n${k}" playOrder="${k + 1}"><navLabel><text>${c.title}</text></navLabel><content src="${(c.dir || '')}c${k + 1}.xhtml"/></navPoint>`).join('') + '</navMap></ncx>');
    items.push('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>');
  }
  z.file(`${opfDir}/content.opf`, `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="${epub3 ? '3.0' : '2.0'}" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${file}</dc:identifier><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:language>en</dc:language><dc:subject>Testing</dc:subject>${images.length ? '<meta name="cover" content="img0"/>' : ''}</metadata><manifest>${items.join('')}</manifest><spine${epub3 ? '' : ' toc="ncx"'}>${spine.join('')}</spine></package>`);
  for (const [p, d] of Object.entries(extra)) z.file(p, d);
  const buf = await z.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
  fs.writeFileSync(path.join(OUT, upper ? file.toUpperCase() : file), buf); console.log('made', upper ? file.toUpperCase() : file, buf.length, 'bytes');
}
function pdf(file, pages) {   // a minimal text PDF
  const objs = []; const add = s => { objs.push(s); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [], pageIds = [];
  const pagesId = objs.length + 1 + pages.length * 2; // placeholder computed below
  pages.forEach(lines => { const stream = 'BT /F1 12 Tf 72 720 Td 16 TL ' + lines.map(l => `(${l.replace(/[()\\]/g, '')}) '`).join(' ') + ' ET'; const c = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`); pageIds.push(add(`__PAGE__${c}`)); });
  const pagesObj = add(`<< /Type /Pages /Kids [${pageIds.map(i => i + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`);
  pageIds.forEach(i => { const c = objs[i - 1].slice(8); objs[i - 1] = `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${c} 0 R >>`; });
  const cat = add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, k) => { offs.push(out.length); out += `${k + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info << /Title (Simple PDF) >> >>\nstartxref\n${x}\n%%EOF\n`;
  fs.writeFileSync(path.join(OUT, file), out); console.log('made', file, out.length, 'bytes');
}
(async () => {
  const chapter = (k, paras = 12, w = 90) => ({ title: 'Chapter ' + k, body: Array.from({ length: paras }, () => `<p>${para(w)}</p>`).join('') });
  await epub('epub_large.epub', { title: 'Big Book', chapters: Array.from({ length: 60 }, (_, k) => chapter(k + 1, 18, 110)) });
  const imgs = n => Array.from({ length: n }, (_, k) => ({ href: `images/i${k}.png`, data: png(160 + (k % 3) * 80, 120 + (k % 2) * 90, [40 + k * 20 % 200, 90, 160]) }));
  await epub('epub_images.epub', { title: 'Pictures Book', images: imgs(4), chapters: [1, 2, 3].map(k => ({ title: 'Chapter ' + k, body: `<p>${para(60)}</p><p><img src="images/i${k}.png" alt="Picture ${k}"/></p><p>${para(80)}</p>` })) });
  await epub('epub_imgheavy.epub', { title: 'Image Heavy', images: imgs(30), chapters: Array.from({ length: 6 }, (_, c) => ({ title: 'Plates ' + (c + 1), body: Array.from({ length: 5 }, (_, k) => `<p>${para(40)}</p><figure><img src="images/i${c * 5 + k}.png" alt=""/><figcaption>Plate ${c * 5 + k}</figcaption></figure>`).join('') })) });
  await epub('pic.epub', { title: 'Pic Book', images: imgs(3), chapters: [{ title: 'Pictures', body: `<p>${para(50)}</p><p><img src="images/i1.png" alt=""/></p><p>${para(50)}</p><p><img src="images/i2.png" alt=""/></p><p>${para(50)}</p>` }] });
  const nested = '<ol>' + [1, 2, 3].map(p => `<li><a href="c${p}.xhtml">Part ${p}</a><ol>${[1, 2].map(s => `<li><a href="c${p}.xhtml#s${s}">Section ${p}.${s}</a></li>`).join('')}</ol></li>`).join('') + '</ol>';
  await epub('epub3_nested.epub', { title: 'Nested Contents', nav: nested, chapters: [1, 2, 3].map(p => ({ title: 'Part ' + p, body: [1, 2].map(s => `<h2 id="s${s}">Section ${p}.${s}</h2><p>${para(120)}</p><p>${para(90)}</p>`).join('') })) });
  await epub('epub2_ncx.epub', { title: 'Old Style Contents', epub3: false, chapters: [1, 2, 3].map(k => chapter(k, 4, 60)) });
  await epub('epub_paths.epub', { title: 'Odd Paths', opfDir: 'content/book files', chapters: [1, 2].map(k => Object.assign(chapter(k, 3, 50), { dir: 'text/' })) });
  await epub('epub_badxml.epub', { title: 'Broken Markup', chapters: [{ title: 'Chapter 1', raw: `<html><head><title>x</title></head><body><h1>Chapter 1<p>${para(60)}<p>Unclosed <b>tags & stray ampersands<br>${para(40)}</body></html>` }, chapter(2, 3, 50)] });
  await epub('upper.epub', { title: 'Upper Case Name', chapters: [chapter(1, 3, 40)], upper: true });
  await epub('epub_drm.epub', { title: 'Locked Book', chapters: [chapter(1, 2, 30)], drm: true });
  fs.writeFileSync(path.join(OUT, 'epub_notzip.epub'), 'This is not a zip file.\n'); console.log('made epub_notzip.epub');
  pdf('simple.pdf', [1, 2, 3].map(p => [`Page ${p} of a simple PDF.`, para(12), para(12), para(12)]));
})();
