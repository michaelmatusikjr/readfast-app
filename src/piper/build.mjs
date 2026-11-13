// Builds ../../piper-worker.js with esbuild, patching @mintplex-labs/piper-tts-web so the speaking speed can be set per sentence
// (Piper's length_scale is multiplied by globalThis.__toozLenMul). Run: node build.mjs <folder with node_modules>
import path from 'path'; import fs from 'fs'; import { createRequire } from 'module';
const NM = path.resolve(process.argv[2] || '.'); const D = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(path.join(NM, 'node_modules', 'x.js')); const esbuild = require('esbuild');
const patch = { name: 'piper-speed', setup(b) { b.onLoad({ filter: /piper-tts-web[\\/]dist[\\/]piper-tts-web\.js$/ }, a => {
  let src = fs.readFileSync(a.path, 'utf8');
  const from = 'const lengthScale = __privateGet(this, _modelConfig).inference.length_scale;';
  if (!src.includes(from)) throw new Error('piper-tts-web changed: speed patch not applied');
  src = src.replace(from, 'const lengthScale = __privateGet(this, _modelConfig).inference.length_scale * (globalThis.__toozLenMul || 1);');
  return { contents: src, loader: 'js' }; }); } };
await esbuild.build({ entryPoints: [path.join(D, 'worker-entry.js')], bundle: true, format: 'esm', minify: true, target: 'safari15',
  external: ['fs', 'path', 'crypto', 'worker_threads'], outfile: path.join(D, '../../piper-worker.js'), logLevel: 'warning',
  nodePaths: [path.join(NM, 'node_modules')], plugins: [patch] });
