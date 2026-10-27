import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { AppConfig } from './config.ts';
import type { YouTubeMonitor } from './services/youtube.ts';
import { CALLBACK_PATH, topicFor, verifySignature } from './services/websub.ts';
import type { PublicConfig } from '../shared/types.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = /^(text\/|application\/(json|manifest|javascript)|image\/svg)/;

function streamOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return ''; }
}

function securityHeaders(cfg: AppConfig): Record<string, string> {
  const media = streamOrigin(cfg.radioStreamUrl);
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://i.ytimg.com https://*.ggpht.com",
    `media-src 'self' ${media} blob:`,
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');
  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage, limit = 512 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload grande demais')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createApp(cfg: AppConfig, yt: YouTubeMonitor, log: (m: string) => void = console.log) {
  const headers = securityHeaders(cfg);
  const staticRoot = cfg.staticDir;
  const websubTimers = new Set<NodeJS.Timeout>();

  function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
    let rel = decodeURIComponent(pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file = path.join(staticRoot, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(staticRoot)) { res.writeHead(403); res.end(); return; }

    let isFallback = false;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // arquivos com extensão inexistentes → 404; rotas do app → index.html
      if (path.extname(rel)) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Não encontrado'); return; }
      file = path.join(staticRoot, 'index.html');
      isFallback = true;
      if (!fs.existsSync(file)) {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('App ainda não compilado. Rode "npm run build".');
        return;
      }
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    const base = path.basename(file);
    const hashed = rel.startsWith('/static/'); // arquivos com hash no nome
    const cache = (base === 'index.html' || base === 'sw.js' || base === 'manifest.webmanifest' || isFallback)
      ? 'no-cache'
      : hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=86400';

    const resHeaders: Record<string, string> = { 'Content-Type': type, 'Cache-Control': cache };
    if (base === 'sw.js') resHeaders['Service-Worker-Allowed'] = '/';

    const accept = String(req.headers['accept-encoding'] ?? '');
    const stream = fs.createReadStream(file);
    if (COMPRESSIBLE.test(type) && /\bgzip\b/.test(accept)) {
      resHeaders['Content-Encoding'] = 'gzip';
      resHeaders['Vary'] = 'Accept-Encoding';
      res.writeHead(200, resHeaders);
      if (req.method === 'HEAD') { res.end(); stream.destroy(); return; }
      stream.pipe(zlib.createGzip()).pipe(res);
    } else {
      resHeaders['Content-Length'] = String(fs.statSync(file).size);
      res.writeHead(200, resHeaders);
      if (req.method === 'HEAD') { res.end(); stream.destroy(); return; }
      stream.pipe(res);
    }
  }

  const server = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    // Concatena em vez de usar base: "//algo" (endereço malformado) não pode derrubar o servidor
    let url: URL;
    try {
      url = new URL('http://localhost' + (req.url?.startsWith('/') ? req.url : '/' + (req.url ?? '')));
    } catch {
      res.writeHead(400); res.end(); return;
    }
    const p = url.pathname;

    try {
      if (p === '/api/health') return sendJson(res, 200, { ok: true, time: new Date().toISOString() });

      if (p === '/api/config' && req.method === 'GET') {
        const body: PublicConfig = { radioStreamUrl: cfg.radioStreamUrl, whatsappNumber: cfg.whatsappNumber };
        return sendJson(res, 200, body);
      }

      if (p === '/api/youtube' && req.method === 'GET') {
        // O app pede dados "frescos" ao abrir a aba; o servidor só consulta o YouTube
        // se o cache estiver mais velho que o intervalo de segurança.
        const wantFresh = url.searchParams.get('fresh') === '1';
        const maxAge = (wantFresh ? Math.min(cfg.livePollMinutes, 5) : cfg.livePollMinutes) * 60_000;
        const state = await yt.ensureFresh(maxAge);
        return sendJson(res, 200, state);
      }

      if (p === '/api/youtube/check' && (req.method === 'POST' || req.method === 'GET')) {
        // Gatilho para agendadores externos (ex.: cron-job.org às 18h00) em hospedagens
        // que "dormem". Protegido por CRON_SECRET.
        const token = url.searchParams.get('token') ?? String(req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '');
        if (!cfg.cronSecret || token !== cfg.cronSecret) return sendJson(res, 401, { error: 'unauthorized' });
        const state = await yt.refresh({ full: true, force: true });
        return sendJson(res, 200, { ok: true, liveCheck: state.liveCheck, live: Boolean(state.live), videos: state.videos.length });
      }

      if (p === CALLBACK_PATH && req.method === 'GET') {
        // Verificação de inscrição do hub WebSub
        const topic = url.searchParams.get('hub.topic');
        const challenge = url.searchParams.get('hub.challenge');
        if (topic !== topicFor(cfg.channelId) || !challenge) { res.writeHead(404); res.end(); return; }
        log(`[websub] ${url.searchParams.get('hub.mode')} confirmado (lease ${url.searchParams.get('hub.lease_seconds')}s)`);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
        return;
      }

      if (p === CALLBACK_PATH && req.method === 'POST') {
        const body = await readBody(req);
        if (!verifySignature(body, req.headers['x-hub-signature'] as string | undefined, cfg.websubSecret)) {
          // Resposta 2xx exigida pelo protocolo, mas a notificação é ignorada
          res.writeHead(202); res.end(); return;
        }
        res.writeHead(204); res.end();
        log('[websub] notificação recebida — verificando live');
        // Verifica agora e de novo em 90s (o status "ao vivo" pode demorar a propagar)
        void yt.refresh({ full: true, force: true });
        const t = setTimeout(() => { websubTimers.delete(t); void yt.refresh({ force: true }); }, 90_000);
        t.unref?.();
        websubTimers.add(t);
        return;
      }

      if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' });

      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      serveStatic(req, res, p);
    } catch (err) {
      log(`[http] erro em ${p}: ${(err as Error).message}`);
      if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
      else res.end();
    }
  });

  server.on('close', () => { for (const t of websubTimers) clearTimeout(t); });
  return server;
}
