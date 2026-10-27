import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app.ts';
import { config } from '../server/config.ts';
import { YouTubeMonitor } from '../server/services/youtube.ts';
import { topicFor } from '../server/services/websub.ts';

let base = '';
let server: ReturnType<typeof createApp>;
let refreshes = 0;

before(async () => {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcv-static-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>RCV</title>');
  const cfg = { ...config, staticDir, youtubeApiKey: '', websubSecret: 'segredo' };
  const yt = new YouTubeMonitor({
    apiKey: '', channelId: cfg.channelId, channelUrl: cfg.channelUrl, maxVideos: 5,
    clientPollSeconds: 60, livePollMinutes: 10,
    fetch: async () => { refreshes++; throw new Error('sem rede no teste'); },
    nextDailyCheck: () => new Date('2026-10-28T21:00:00Z'), log: () => {},
  });
  server = createApp(cfg, yt, () => {});
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

test('saúde e configuração pública', async () => {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const cfg = await (await fetch(`${base}/api/config`)).json();
  assert.equal(cfg.radioStreamUrl, 'https://stm12.voxhd.com.br:13010/stream//');
  assert.equal(cfg.whatsappNumber, '5543984195925');
  assert.ok(!JSON.stringify(cfg).includes('KEY'), 'nenhum segredo exposto');
});

test('YouTube indisponível e sem chave: resposta válida, sem erro fatal', async () => {
  const res = await fetch(`${base}/api/youtube?fresh=1`);
  assert.equal(res.status, 200);
  const s = await res.json();
  assert.equal(s.liveCheck, 'unconfigured');
  assert.equal(s.live, null);
  assert.ok(Array.isArray(s.videos));
  assert.equal(s.nextDailyCheckAt, '2026-10-28T21:00:00.000Z');
});

test('WebSub: confirma inscrição do canal correto e recusa outros', async () => {
  const ok = await fetch(`${base}/api/youtube/websub?hub.mode=subscribe&hub.topic=${encodeURIComponent(topicFor(config.channelId))}&hub.challenge=abc123`);
  assert.equal(await ok.text(), 'abc123');
  const bad = await fetch(`${base}/api/youtube/websub?hub.mode=subscribe&hub.topic=x&hub.challenge=abc`);
  assert.equal(bad.status, 404);
});

test('WebSub: notificação assinada dispara verificação; sem assinatura é ignorada', async () => {
  const body = '<feed><entry><yt:videoId>x</yt:videoId></entry></feed>';
  const before = refreshes;
  const unsigned = await fetch(`${base}/api/youtube/websub`, { method: 'POST', body });
  assert.equal(unsigned.status, 202);
  const sig = 'sha1=' + crypto.createHmac('sha1', 'segredo').update(body).digest('hex');
  const signed = await fetch(`${base}/api/youtube/websub`, { method: 'POST', body, headers: { 'X-Hub-Signature': sig } });
  assert.equal(signed.status, 204);
  await new Promise((r) => setTimeout(r, 50));
  assert.ok(refreshes > before);
});

test('rotas do app caem no index.html; arquivos inexistentes dão 404', async () => {
  const page = await fetch(`${base}/qualquer/rota`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy') ?? '', /media-src 'self' https:\/\/stm12\.voxhd\.com\.br:13010/);
  assert.equal((await fetch(`${base}/nao-existe.js`)).status, 404);
});

test('gatilho externo exige o segredo', async () => {
  const res = await fetch(`${base}/api/youtube/check`, { method: 'POST' });
  assert.equal(res.status, 401);
});

test('endereço malformado não derruba o servidor', async () => {
  const net = await import('node:net');
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => {
    const sock = net.connect(port, '127.0.0.1', () => sock.end('GET // HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
    sock.on('data', () => {}); sock.on('close', () => resolve()); sock.on('error', () => resolve());
  });
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
});
