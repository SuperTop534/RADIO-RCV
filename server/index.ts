import path from 'node:path';
import { config } from './config.ts';
import { YouTubeMonitor } from './services/youtube.ts';
import { startWebSub } from './services/websub.ts';
import { nextDailyOccurrence, scheduleDaily } from './jobs/schedule.ts';
import { createApp } from './app.ts';

const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

const yt = new YouTubeMonitor({
  apiKey: config.youtubeApiKey,
  channelId: config.channelId,
  channelUrl: config.channelUrl,
  maxVideos: config.maxVideos,
  clientPollSeconds: config.clientPollSeconds,
  livePollMinutes: config.livePollMinutes,
  cacheFile: path.join(config.dataDir, 'youtube-cache.json'),
  nextDailyCheck: () => nextDailyOccurrence(config.dailyCheckTime, config.timezone),
  log,
});

// 1) Verificação diária obrigatória às 18h00 (America/Sao_Paulo)
const daily = scheduleDaily(config.dailyCheckTime, config.timezone, () => yt.refresh({ full: true, force: true }), log);

// 2) Verificação periódica de segurança (detecta lives iniciadas a qualquer hora)
const poll = setInterval(() => void yt.refresh(), config.livePollMinutes * 60_000);

// 3) Notificações instantâneas do YouTube (quando PUBLIC_URL estiver configurada)
const websub = startWebSub({ publicUrl: config.publicUrl, channelId: config.channelId, secret: config.websubSecret, log });

// Primeira carga ao iniciar
void yt.refresh({ full: true, force: true });

const server = createApp(config, yt, log);
server.listen(config.port, () => {
  log(`[rcv] servidor em http://localhost:${config.port}`);
  log(`[rcv] YouTube Data API: ${yt.hasApiKey ? 'configurada' : 'NÃO configurada (só feed público, sem detecção de live)'}`);
  log(`[rcv] próxima verificação diária: ${daily.next().toLocaleString('pt-BR', { timeZone: config.timezone })} (${config.timezone})`);
  log(`[rcv] verificação periódica a cada ${config.livePollMinutes} min`);
});

function shutdown() {
  log('[rcv] encerrando…');
  daily.stop();
  clearInterval(poll);
  websub?.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
