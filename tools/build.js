#!/usr/bin/env node
// Precompile every proto/*.jsx into proto/dist/*.js using Babel.
// Run with `npm run build`. Watch mode: `npm run watch`.
//
// We deliberately avoid bundling — each file becomes a single .js
// counterpart that runs in the browser as a regular <script>. This keeps
// the simple "drop a file, get a global" model the prototype relies on.

const fs = require('fs');
const path = require('path');

let babel;
try {
  babel = require('@babel/core');
} catch (e) {
  console.error('Missing devDependencies. Run `npm install` first.');
  process.exit(1);
}

const SRC = path.join(__dirname, '..', 'proto');
const DST = path.join(SRC, 'dist');

const BANNER = `/* AUTO-GENERATED from proto/SRC.jsx — do not edit by hand. */\n`;

function compileOne(file) {
  const filename = path.join(SRC, file);
  const src = fs.readFileSync(filename, 'utf8');
  const out = babel.transformSync(src, {
    filename,
    presets: ['@babel/preset-react'],
    sourceMaps: false,
    compact: false,
  });
  const target = path.join(DST, file.replace(/\.jsx$/, '.js'));
  fs.writeFileSync(target, BANNER.replace('SRC', file.replace(/\.jsx$/, '')) + out.code);
  return target;
}

function buildAll() {
  if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });
  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.jsx')).sort();
  const expected = new Set(files.map(f => f.replace(/\.jsx$/, '.js')));
  let bytes = 0;
  for (const f of files) {
    const target = compileOne(f);
    bytes += fs.statSync(target).size;
    process.stdout.write(`  ✓ ${f.padEnd(20)} → dist/${f.replace(/\.jsx$/, '.js')}\n`);
  }
  // Drop any dist .js whose .jsx source has been renamed or deleted —
  // otherwise the stale bundle stays on disk and ships to production.
  for (const stale of fs.readdirSync(DST)) {
    if (stale.endsWith('.js') && !expected.has(stale)) {
      fs.unlinkSync(path.join(DST, stale));
      process.stdout.write(`  ✗ removed dist/${stale} (source missing)\n`);
    }
  }
  console.log(`Built ${files.length} files (${(bytes / 1024).toFixed(1)} KB)`);
}

function watch() {
  buildAll();
  console.log('Watching proto/*.jsx for changes…');
  fs.watch(SRC, { persistent: true }, (event, filename) => {
    if (!filename || !filename.endsWith('.jsx')) return;
    setTimeout(() => {
      try {
        const target = compileOne(filename);
        console.log(`  ↻ ${filename} → ${path.relative(SRC, target)}`);
      } catch (e) {
        console.error(`  ✗ ${filename}: ${e.message}`);
      }
    }, 50); // debounce against double-fire
  });
}

if (process.argv.includes('--watch')) watch();
else buildAll();
