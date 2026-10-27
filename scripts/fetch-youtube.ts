/**
 * Robô do YouTube para o site estático (GitHub Pages).
 * Roda no GitHub Actions a cada poucos minutos e grava youtube.json:
 * a live ativa (se houver) e os vídeos do canal do mais novo para o mais antigo.
 *
 * Uso:
 *   node --import tsx scripts/fetch-youtube.ts dist/youtube.json [--full] [--previous URL]
 *
 * Variáveis: YOUTUBE_API_KEY (segredo do repositório), YOUTUBE_CHANNEL_ID (opcional).
 *   --full       inclui a busca dedicada por live (mais cara; usada às 18h00)
 *   --previous   URL do youtube.json publicado; usado se o YouTube estiver fora do ar
 */
import fs from 'node:fs';
import path from 'node:path';
import { YouTubeMonitor } from '../server/services/youtube.ts';
import { nextDailyOccurrence } from '../server/jobs/schedule.ts';
import type { YouTubeState } from '../shared/types.ts';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--previous') ?? 'dist/youtube.json';
const full = args.includes('--full') || process.env.FULL_CHECK === 'true';
const prevIdx = args.indexOf('--previous');
const previousUrl = prevIdx >= 0 ? args[prevIdx + 1] : '';

const env = (k: string, d = '') => (process.env[k] ?? '').trim() || d;

const yt = new YouTubeMonitor({
  apiKey: env('YOUTUBE_API_KEY'),
  channelId: env('YOUTUBE_CHANNEL_ID', 'UCUhM7X3log3z56SWCoEWgSg'),
  channelUrl: 'https://www.youtube.com/@rcvestudioradio4570',
  maxVideos: Math.min(Number(env('YOUTUBE_MAX_VIDEOS', '24')) || 24, 50),
  clientPollSeconds: Number(env('CLIENT_POLL_SECONDS', '60')) || 60,
  livePollMinutes: 10,
  nextDailyCheck: () => nextDailyOccurrence(env('LIVE_DAILY_CHECK_TIME', '18:00'), env('TIMEZONE', 'America/Sao_Paulo')),
  log: (m) => console.log(m),
});

let state: YouTubeState = await yt.refresh({ full, force: true });

// YouTube fora do ar: mantém a última lista publicada (nunca a live antiga)
if (state.videos.length === 0 && previousUrl) {
  try {
    const res = await fetch(previousUrl, { headers: { 'Cache-Control': 'no-cache' } });
    if (res.ok) {
      const prev = (await res.json()) as YouTubeState;
      if (Array.isArray(prev.videos) && prev.videos.length) {
        state = { ...state, videos: prev.videos, videosSource: prev.videosSource, lastVideosAt: prev.lastVideosAt };
        console.log(`[robô] usando a lista anterior (${prev.videos.length} vídeos)`);
      }
    }
  } catch {
    console.log('[robô] lista anterior indisponível (normal na primeira publicação)');
  }
}

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, JSON.stringify(state));
console.log(JSON.stringify({
  arquivo: out,
  verificacaoCompleta: full,
  live: state.live ? state.live.title : null,
  videos: state.videos.length,
  fonte: state.videosSource,
  statusLive: state.liveCheck,
  aviso: state.message,
}, null, 2));
