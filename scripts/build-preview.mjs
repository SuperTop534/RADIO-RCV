/**
 * Prévia estática (página do Claude): um único HTML com CSS e JS embutidos,
 * caminhos relativos e o modo __PREVIEW__ ligado (sem servidor).
 * Uso: node scripts/build-preview.mjs <pasta-de-saída>
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath funciona em Windows, macOS e Linux (pathname daria "/C:/..." no Windows)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'preview'));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true, write: false, outdir: out, format: 'iife', minify: true,
  target: ['es2022', 'safari15'], jsx: 'automatic', legalComments: 'none',
  external: ['../assets/*', 'assets/*', 'icons/*'],
  define: { 'process.env.NODE_ENV': '"production"', __PREVIEW__: 'true', __STATIC__: 'false' },
});
// o CSS vai embutido na página: "../assets/" (relativo a static/) vira "assets/"
const rel = (s) => s.replaceAll('../assets/', 'assets/');
let js = '', css = '';
for (const f of result.outputFiles) {
  if (f.path.endsWith('.js')) js = rel(f.text);
  if (f.path.endsWith('.css')) css = rel(f.text);
}

const page = `<title>RCV Estúdio Rádio</title>
<meta name="theme-color" content="#131419">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&display=swap">
<style>:root{color-scheme:dark}${css}</style>
<div id="root"></div>
<script>${js.replaceAll('</script', '<\\/script')}</script>
`;
fs.writeFileSync(path.join(out, 'index.html'), page);

for (const dir of ['assets', 'icons']) {
  fs.mkdirSync(path.join(out, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'public', dir))) {
    if (f.includes('maskable')) continue;
    fs.copyFileSync(path.join(root, 'public', dir, f), path.join(out, dir, f));
  }
}
console.log('[preview] pronto em', out, `(${(page.length / 1024).toFixed(0)} KB)`);
