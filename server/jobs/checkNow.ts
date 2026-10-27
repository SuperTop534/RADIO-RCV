/**
 * Verificação manual (ou via cron externo): `npm run check:live`
 * Útil em hospedagens serverless onde o processo não fica ligado o tempo todo.
 */
import path from 'node:path';
import { config } from '../config.ts';
import { YouTubeMonitor } from '../services/youtube.ts';
import { nextDailyOccurrence } from './schedule.ts';

const yt = new YouTubeMonitor({
  apiKey: config.youtubeApiKey,
  channelId: config.channelId,
  channelUrl: config.channelUrl,
  maxVideos: config.maxVideos,
  clientPollSeconds: config.clientPollSeconds,
  livePollMinutes: config.livePollMinutes,
  cacheFile: path.join(config.dataDir, 'youtube-cache.json'),
  nextDailyCheck: () => nextDailyOccurrence(config.dailyCheckTime, config.timezone),
});

const s = await yt.refresh({ full: true, force: true });
console.log(JSON.stringify({
  liveCheck: s.liveCheck,
  live: s.live ? { id: s.live.id, title: s.live.title, startedAt: s.live.startedAt } : null,
  videos: s.videos.length,
  videosSource: s.videosSource,
  message: s.message,
}, null, 2));
