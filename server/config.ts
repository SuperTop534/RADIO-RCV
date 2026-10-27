import fs from 'node:fs';
import path from 'node:path';

/** Carrega um arquivo .env simples (sem dependências externas). */
function loadDotEnv(file = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotEnv();

const env = (k: string, d = '') => (process.env[k] ?? '').trim() || d;
const num = (k: string, d: number, min: number) => {
  const n = Number(env(k));
  return Number.isFinite(n) && n >= min ? n : d;
};

export const config = {
  port: num('PORT', 8080, 1),
  publicUrl: env('PUBLIC_URL').replace(/\/+$/, ''),
  youtubeApiKey: env('YOUTUBE_API_KEY'),
  channelId: env('YOUTUBE_CHANNEL_ID', 'UCUhM7X3log3z56SWCoEWgSg'),
  channelUrl: 'https://www.youtube.com/@rcvestudioradio4570',
  dailyCheckTime: env('LIVE_DAILY_CHECK_TIME', '18:00'),
  timezone: env('TIMEZONE', 'America/Sao_Paulo'),
  livePollMinutes: num('LIVE_POLL_MINUTES', 10, 1),
  clientPollSeconds: num('CLIENT_POLL_SECONDS', 60, 15),
  maxVideos: Math.min(num('YOUTUBE_MAX_VIDEOS', 12, 1), 50),
  websubSecret: env('WEBSUB_SECRET'),
  cronSecret: env('CRON_SECRET'),
  radioStreamUrl: env('RADIO_STREAM_URL', 'https://stm12.voxhd.com.br:13010/stream//'),
  whatsappNumber: env('WHATSAPP_NUMBER', '5543984195925').replace(/\D/g, ''),
  dataDir: path.resolve(process.cwd(), env('DATA_DIR', 'data')),
  staticDir: path.resolve(process.cwd(), env('STATIC_DIR', 'dist')),
};

export type AppConfig = typeof config;
