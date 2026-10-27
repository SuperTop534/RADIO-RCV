/**
 * Build de produção (sem Vite/Webpack — só esbuild):
 *   dist/          → app (HTML, JS, CSS com hash, PWA, assets)
 *   dist-server/   → servidor Node compilado
 * Uso: node scripts/build.mjs [--watch]
 *      node scripts/build.mjs --static   → só o site, para GitHub Pages (sem servidor;
 *                                          os vídeos vêm de youtube.json gerado pelo robô)
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// fileURLToPath funciona em Windows, macOS e Linux (pathname daria "/C:/..." no Windows)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--watch');
const isStatic = process.argv.includes('--static');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

/** Gera index.html e sw.js a partir do resultado do esbuild. */
function writeShell(metafile) {
  const outs = Object.keys(metafile.outputs).map((f) => path.relative(dist, path.resolve(process.cwd(), f)).split(path.sep).join('/'));
  const js = outs.find((f) => f.endsWith('.js') && f.startsWith('static/main'));
  const css = outs.find((f) => f.endsWith('.css'));
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html
    .replace('<!--CSS-->', css ? `<link rel="stylesheet" href="${css}" />` : '')
    .replace('<!--JS-->', `<script type="module" src="${js}"></script>`);
  fs.writeFileSync(path.join(dist, 'index.html'), html);

  // Caminhos relativos: o site funciona na raiz (rcv.com.br/) ou numa subpasta (usuario.github.io/rcv/)
  const precache = ['./', 'index.html', ...listFiles(dist)]
    .filter((f) =>
      !f.endsWith('.map') &&
      f !== 'sw.js' &&
      f !== 'youtube.json' &&               // dados: sempre da rede
      f !== '.nojekyll' &&
      f !== 'assets/logo-rcv.webp' &&       // versão grande: só em telas de alta densidade
      f !== 'assets/logo-rcv-900.png' &&    // reserva para navegadores sem WebP
      !f.includes('maskable'));
  const version = crypto.createHash('sha1').update(precache.join('|') + (js ?? '') + (css ?? '')).digest('hex').slice(0, 10);
  const sw = fs.readFileSync(path.join(root, 'src/sw.template.js'), 'utf8')
    .replace('__VERSION__', version)
    .replace('__PRECACHE__', JSON.stringify([...new Set(precache)], null, 2));
  fs.writeFileSync(path.join(dist, 'sw.js'), sw);
  console.log(`[build] app pronto: ${js} ${css ?? ''} (sw ${version})`);
}

fs.rmSync(dist, { recursive: true, force: true });
copyDir(path.join(root, 'public'), dist);
if (isStatic) {
  fs.writeFileSync(path.join(dist, '.nojekyll'), ''); // GitHub Pages: servir os arquivos como estão
  fs.writeFileSync(path.join(dist, '404.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./"><title>RCV Estúdio Rádio</title>');
}

const shellPlugin = {
  name: 'shell',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length || !result.metafile) return;
      writeShell(result.metafile);
    });
  },
};

const appOptions = {
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  outdir: path.join(dist, 'static'),
  entryNames: '[name]-[hash]',
  assetNames: '[name]-[hash]',
  format: 'esm',
  splitting: false,
  target: ['es2022', 'safari15'],
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : 'linked',
  metafile: true,
  external: ['../assets/*', 'assets/*', 'icons/*'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    __PREVIEW__: 'false',
    __STATIC__: String(isStatic),
  },
  legalComments: 'none',
  logLevel: 'info',
  plugins: [shellPlugin],
};

const serverOptions = {
  entryPoints: [path.join(root, 'server/index.ts'), path.join(root, 'server/jobs/checkNow.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outdir: path.join(root, 'dist-server'),
  outbase: path.join(root, 'server'),
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(appOptions);
  await ctx.watch();
  console.log('[build] observando alterações em src/…');
} else if (isStatic) {
  await esbuild.build(appOptions);
  console.log('[build] site estático pronto em dist/ (gere dist/youtube.json com scripts/fetch-youtube.ts)');
} else {
  await esbuild.build(appOptions);
  fs.rmSync(path.join(root, 'dist-server'), { recursive: true, force: true });
  await esbuild.build(serverOptions);
  console.log('[build] servidor pronto em dist-server/');
}
