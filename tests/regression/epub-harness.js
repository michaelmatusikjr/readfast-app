// Usage: node harness.js [file ...]   (defaults to all in ./files)
// Env: APP=/path/to/index.html  OFFLINE=1 (block CDN)  SLOWCDN=ms
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const DIR = __dirname;
const APP = process.env.APP || '/home/claude/readfast-app/index.html';
const LOCAL = {
  'jszip.min.js': path.join(DIR, 'node_modules/jszip/dist/jszip.min.js'),
  'pdf.min.js': path.join(DIR, 'node_modules/pdfjs-dist/build/pdf.min.js'),
  'pdf.worker.min.js': path.join(DIR, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'),
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] }).catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith('http://app.test/')) {
      const p = u.slice(16).split('?')[0] || 'index.html';
      if (p === 'index.html') return route.fulfill({ path: APP, contentType: 'text/html' });
      return route.fulfill({ status: 404, body: '' });
    }
    if (u.includes('cdnjs.cloudflare.com')) {
      if (process.env.OFFLINE) return route.abort();
      if (process.env.SLOWCDN) await new Promise(r => setTimeout(r, +process.env.SLOWCDN));
      const f = Object.keys(LOCAL).find(k => u.endsWith('/' + k));
      if (f) return route.fulfill({ path: LOCAL[f], contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' } });
    }
    return route.abort();
  });
  await page.goto('http://app.test/index.html');
  await page.waitForTimeout(800);
  const boot = await page.evaluate(() => ({ db: !!(window.Store && Store.db), tabs: [...document.querySelectorAll('#tabs button')].map(b => b.textContent), lib: document.querySelector('#docList').innerText.slice(0, 120) }));
  console.log('BOOT', JSON.stringify(boot)); console.log('BOOT ERRORS', errs.splice(0));
  // record toast timeline
  await page.evaluate(() => {
    window.__tl = []; const t0 = performance.now();
    const snap = () => { const t = document.querySelector('#toast'); window.__tl.push([Math.round(performance.now() - t0), t.hidden ? 'HIDDEN' : document.querySelector('#toastMsg').textContent, document.querySelector('#toastProg').hidden ? '-' : document.querySelector('#toastBar').style.width]); };
    new MutationObserver(snap).observe(document.querySelector('#toast'), { attributes: true, childList: true, subtree: true, characterData: true });
    window.__reset = () => { window.__tl = []; };
  });
  const list = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(DIR, 'files')).map(f => path.join(DIR, 'files', f));
  for (const f of list) {
    await page.evaluate(() => { window.__reset(); if (window.closeReader && !document.querySelector('#v-reader').hidden) closeReader(); });
    const before = await page.evaluate(() => LIB.length);
    const t0 = Date.now();
    await page.setInputFiles('#fileIn', f);
    // wait until library grows or an error toast appears (no progress bar) or 60s
    let res = 'timeout';
    for (let k = 0; k < 600; k++) {
      await page.waitForTimeout(100);
      const s = await page.evaluate(b => ({ n: LIB.length, prog: !document.querySelector('#toastProg').hidden, hidden: document.querySelector('#toast').hidden, msg: document.querySelector('#toastMsg').textContent }), before);
      if (s.n > before && !s.prog) { res = 'added'; break; }
      if (!s.prog && !s.hidden && s.n === before) { res = 'error'; break; }
    }
    const info = await page.evaluate(async b => {
      const m = LIB[LIB.length - 1]; if (LIB.length === b) return null;
      const t = await Store.get('texts', m.id);
      return { title: m.title, count: m.count, chapters: m.chapters.map(c => '  '.repeat(c.d) + c.t + ' @' + c.i), images: m.imageCount, first: t.words.slice(0, 12).join(' '), imgTypes: t.images ? t.images.files.map(x => x.path + ' ' + (x.data ? x.data.slice(0, 30) : 'blob ' + x.blob.type + ' ' + x.blob.size)) : null };
    }, before);
    const tl = await page.evaluate(() => window.__tl);
    console.log('\n=== ' + path.basename(f) + ' -> ' + res + ' in ' + (Date.now() - t0) + 'ms');
    console.log('toast timeline:', JSON.stringify(tl.filter((x, i, a) => i === 0 || JSON.stringify(x.slice(1)) !== JSON.stringify(a[i - 1].slice(1))).slice(0, 40)));
    console.log('result:', JSON.stringify(info, null, 1));
    if (info && process.env.OPEN) {
      await page.evaluate(() => openDoc(LIB[LIB.length - 1].id)); await page.waitForTimeout(500);
      console.log('reader:', await page.evaluate(() => ({ view: !document.querySelector('#v-reader').hidden, word: document.querySelector('#word').innerText, sub: document.querySelector('#rSub').textContent, figs: document.querySelectorAll('#scrollText figure').length })));
    }
    if (errs.length) console.log('ERRORS', errs.splice(0));
  }
  await browser.close();
})();
