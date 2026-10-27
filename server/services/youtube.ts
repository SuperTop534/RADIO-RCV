import fs from 'node:fs';
import path from 'node:path';
import type { LiveInfo, VideoItem, YouTubeState, LiveCheckStatus } from '../../shared/types.ts';
import { parseChannelPage, PAGE_HEADERS, type PageVideo } from './youtubePage.ts';

/**
 * Consulta do canal do YouTube com proteção de cota.
 *
 * Com YOUTUBE_API_KEY:
 *   - playlistItems (uploads do canal)   → 1 unidade
 *   - videos.list (status ao vivo)        → 1 unidade
 *   - search.list eventType=live          → 100 unidades (só na verificação completa:
 *                                           18h00 diária, notificações WebSub e chamadas manuais)
 * Sem chave: feed RSS público do canal (somente vídeos; live não é confirmada).
 */

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean; status: number; text(): Promise<string>; json(): Promise<any>;
}>;

export interface YouTubeOptions {
  apiKey: string;
  channelId: string;
  channelUrl: string;
  maxVideos: number;
  clientPollSeconds: number;
  livePollMinutes: number;
  cacheFile?: string;
  fetch?: FetchLike;
  now?: () => Date;
  nextDailyCheck: () => Date;
  log?: (msg: string) => void;
}

const API = 'https://www.googleapis.com/youtube/v3';
const TIMEOUT_MS = 12_000;

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

function bestThumb(thumbs: any, id: string): string {
  return thumbs?.maxres?.url || thumbs?.standard?.url || thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || thumbUrl(id);
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

/** Interpreta o feed Atom público do canal. */
export function parseChannelFeed(xml: string, max: number): VideoItem[] {
  const out: VideoItem[] = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const entry of entries) {
    const id = /<yt:videoId>([^<]+)<\/yt:videoId>/.exec(entry)?.[1]?.trim();
    if (!id) continue;
    const title = decodeXml(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1] ?? '').trim();
    const published = /<published>([^<]+)<\/published>/.exec(entry)?.[1]?.trim() ?? '';
    const thumb = /<media:thumbnail[^>]*url="([^"]+)"/.exec(entry)?.[1];
    out.push({
      id,
      title: title || 'Vídeo sem título',
      publishedAt: published,
      thumbnail: thumb ? decodeXml(thumb) : thumbUrl(id),
      url: watchUrl(id),
      embeddable: null,
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Canal UCxxxx → playlist de uploads UUxxxx */
export const uploadsPlaylistId = (channelId: string) =>
  channelId.startsWith('UC') ? `UU${channelId.slice(2)}` : channelId;

interface CacheShape {
  state: YouTubeState;
  liveConfirmedAt: string | null;
}

export class YouTubeMonitor {
  private opts: Required<Omit<YouTubeOptions, 'cacheFile'>> & { cacheFile?: string };
  private state: YouTubeState;
  private liveConfirmedAt: string | null = null;
  private inflight: Promise<YouTubeState> | null = null;
  private lastRefreshStarted = 0;
  private listeners = new Set<(s: YouTubeState) => void>();

  constructor(options: YouTubeOptions) {
    this.opts = {
      fetch: (globalThis.fetch as unknown as FetchLike),
      now: () => new Date(),
      log: console.log,
      ...options,
    } as any;
    this.state = this.emptyState();
    this.loadCache();
  }

  get hasApiKey() { return Boolean(this.opts.apiKey); }

  private emptyState(): YouTubeState {
    return {
      channelId: this.opts.channelId,
      channelUrl: this.opts.channelUrl,
      live: null,
      liveCheck: this.opts.apiKey ? 'error' : 'unconfigured',
      videos: [],
      videosSource: 'none',
      lastLiveCheckAt: null,
      lastVideosAt: null,
      nextDailyCheckAt: this.opts.nextDailyCheck().toISOString(),
      clientPollSeconds: this.opts.clientPollSeconds,
      message: null,
    };
  }

  private loadCache() {
    const file = this.opts.cacheFile;
    if (!file || !fs.existsSync(file)) return;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheShape;
      if (data?.state?.channelId === this.opts.channelId) {
        this.state = { ...data.state, clientPollSeconds: this.opts.clientPollSeconds };
        this.liveConfirmedAt = data.liveConfirmedAt;
        // Uma live salva no disco não é considerada ativa até nova confirmação.
        if (this.state.live && !this.isLiveConfirmationRecent()) this.state.live = null;
        if (!this.opts.apiKey) { this.state.live = null; this.state.liveCheck = 'unconfigured'; }
      }
    } catch (err) {
      this.opts.log(`[youtube] cache ignorado: ${(err as Error).message}`);
    }
  }

  private saveCache() {
    const file = this.opts.cacheFile;
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const data: CacheShape = { state: this.state, liveConfirmedAt: this.liveConfirmedAt };
      fs.writeFileSync(file + '.tmp', JSON.stringify(data));
      fs.renameSync(file + '.tmp', file);
    } catch (err) {
      this.opts.log(`[youtube] não foi possível salvar o cache: ${(err as Error).message}`);
    }
  }

  private isLiveConfirmationRecent() {
    if (!this.liveConfirmedAt) return false;
    const age = this.opts.now().getTime() - new Date(this.liveConfirmedAt).getTime();
    return age < this.opts.livePollMinutes * 2 * 60_000 + 60_000;
  }

  getState(): YouTubeState {
    return { ...this.state, nextDailyCheckAt: this.opts.nextDailyCheck().toISOString() };
  }

  onChange(fn: (s: YouTubeState) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Idade (ms) dos dados atuais. */
  ageMs(): number {
    const ref = this.state.lastLiveCheckAt ?? this.state.lastVideosAt;
    return ref ? this.opts.now().getTime() - new Date(ref).getTime() : Infinity;
  }

  /**
   * Atualiza se os dados estiverem mais velhos que `maxAgeMs`.
   * Usado quando o app abre a aba de vídeos — nunca dispara mais de uma consulta por vez.
   */
  async ensureFresh(maxAgeMs: number): Promise<YouTubeState> {
    if (this.ageMs() <= maxAgeMs) return this.getState();
    return this.refresh({ full: false });
  }

  /**
   * @param full  true = inclui search.list eventType=live (mais cara, mais abrangente)
   * @param force ignora o intervalo mínimo entre consultas
   */
  refresh({ full = false, force = false }: { full?: boolean; force?: boolean } = {}): Promise<YouTubeState> {
    if (this.inflight) return this.inflight;
    const sinceLast = Date.now() - this.lastRefreshStarted;
    if (!force && !full && sinceLast < 30_000) return Promise.resolve(this.getState());
    this.lastRefreshStarted = Date.now();
    this.inflight = this.doRefresh(full)
      .catch((err) => {
        this.opts.log(`[youtube] erro inesperado: ${(err as Error).message}`);
        return this.getState();
      })
      .finally(() => { this.inflight = null; });
    return this.inflight;
  }

  private async getText(url: string, headers: Record<string, string> = { 'User-Agent': 'RCV-Estudio-Radio/1.0' }): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await this.opts.fetch(url, { signal: ctrl.signal, headers });
      const body = await res.text();
      if (!res.ok) {
        let reason = `HTTP ${res.status}`;
        try { reason = JSON.parse(body)?.error?.errors?.[0]?.reason ?? JSON.parse(body)?.error?.message ?? reason; } catch { /* corpo não-JSON */ }
        throw new Error(reason);
      }
      return body;
    } finally {
      clearTimeout(t);
    }
  }

  private async api(pathname: string, params: Record<string, string>) {
    const qs = new URLSearchParams({ ...params, key: this.opts.apiKey });
    return JSON.parse(await this.getText(`${API}/${pathname}?${qs}`));
  }

  private async fetchRss(): Promise<VideoItem[]> {
    const xml = await this.getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(this.opts.channelId)}`);
    return parseChannelFeed(xml, this.opts.maxVideos);
  }

  /**
   * Lê as abas "Vídeos" e "Ao vivo" da página pública do canal (sem chave).
   * Detecta a live em andamento e inclui as lives já encerradas na lista.
   */
  private async fetchFromPages(): Promise<{ videos: VideoItem[]; live: LiveInfo | null; liveChecked: boolean }> {
    const base = `https://www.youtube.com/channel/${encodeURIComponent(this.opts.channelId)}`;
    const now = this.opts.now();
    const [vids, streams] = await Promise.allSettled([
      this.getText(`${base}/videos`, PAGE_HEADERS).then((h) => parseChannelPage(h, now)),
      this.getText(`${base}/streams`, PAGE_HEADERS).then((h) => parseChannelPage(h, now)),
    ]);
    const list: PageVideo[] = [
      ...(streams.status === 'fulfilled' ? streams.value : []),
      ...(vids.status === 'fulfilled' ? vids.value : []),
    ];
    if (vids.status === 'rejected' && streams.status === 'rejected') throw vids.reason;
    const liveItem = list.find((v) => v.isLive) ?? null;
    const seen = new Set<string>();
    const videos = list
      .filter((v) => !v.isLive && !v.isUpcoming && !seen.has(v.id) && seen.add(v.id))
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
      .slice(0, this.opts.maxVideos)
      .map(({ isLive: _l, isUpcoming: _u, ...v }) => v);
    const live: LiveInfo | null = liveItem
      ? { id: liveItem.id, title: liveItem.title, publishedAt: liveItem.publishedAt, thumbnail: liveItem.thumbnail, url: liveItem.url, embeddable: null, startedAt: null, concurrentViewers: null }
      : null;
    return { videos, live, liveChecked: streams.status === 'fulfilled' };
  }

  private async doRefresh(full: boolean): Promise<YouTubeState> {
    const nowIso = this.opts.now().toISOString();
    const prev = this.state;
    let next: YouTubeState;

    if (!this.opts.apiKey) {
      next = { ...prev, live: null, liveCheck: 'unconfigured' };
      // 1) página do canal (vídeos + lives); 2) feed RSS como reserva
      let page: Awaited<ReturnType<YouTubeMonitor['fetchFromPages']>> | null = null;
      try {
        page = await this.fetchFromPages();
      } catch (err) {
        this.opts.log(`[youtube] página do canal indisponível: ${(err as Error).message}`);
      }
      if (page && (page.videos.length || page.live)) {
        next.videos = page.videos;
        next.live = page.live;
        next.liveCheck = page.liveChecked ? 'ok' : 'unconfigured';
        next.videosSource = 'page';
        next.lastVideosAt = nowIso;
        next.lastLiveCheckAt = page.liveChecked ? nowIso : prev.lastLiveCheckAt;
        next.message = null;
      } else {
        try {
          next.videos = await this.fetchRss();
          next.videosSource = 'rss';
          next.lastVideosAt = nowIso;
          next.message = null;
        } catch (err) {
          this.opts.log(`[youtube] feed RSS indisponível: ${(err as Error).message}`);
          next.message = page ? null : 'Não foi possível atualizar a lista de vídeos agora.';
          if (page) { next.videos = []; next.videosSource = 'page'; next.lastVideosAt = nowIso; }
        }
      }
    } else {
      next = await this.refreshWithApi(full, prev, nowIso);
    }

    this.state = { ...next, nextDailyCheckAt: this.opts.nextDailyCheck().toISOString(), clientPollSeconds: this.opts.clientPollSeconds };
    this.saveCache();
    const liveChanged = (prev.live?.id ?? null) !== (this.state.live?.id ?? null);
    if (liveChanged) this.opts.log(`[youtube] live: ${this.state.live ? `ATIVA (${this.state.live.title})` : 'nenhuma'}`);
    for (const fn of this.listeners) fn(this.getState());
    return this.getState();
  }

  private async refreshWithApi(full: boolean, prev: YouTubeState, nowIso: string): Promise<YouTubeState> {
    const max = this.opts.maxVideos;
    try {
      // 1) Uploads recentes (lives aparecem aqui ao começar)
      const pl = await this.api('playlistItems', {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId(this.opts.channelId),
        maxResults: String(Math.min(50, max + 8)),
      });
      const ids = new Set<string>((pl.items ?? []).map((i: any) => i?.contentDetails?.videoId).filter(Boolean));

      // 2) Busca dedicada por live ativa (verificação completa)
      if (full) {
        try {
          const s = await this.api('search', {
            part: 'id', channelId: this.opts.channelId, eventType: 'live', type: 'video', maxResults: '3',
          });
          for (const it of s.items ?? []) if (it?.id?.videoId) ids.add(it.id.videoId);
        } catch (err) {
          this.opts.log(`[youtube] search.list falhou (seguindo só com uploads): ${(err as Error).message}`);
        }
      }

      // 3) Detalhes + status ao vivo
      const details: any[] = [];
      const all = [...ids];
      for (let i = 0; i < all.length; i += 50) {
        const v = await this.api('videos', {
          part: 'snippet,liveStreamingDetails,status',
          id: all.slice(i, i + 50).join(','),
          maxResults: '50',
        });
        details.push(...(v.items ?? []));
      }

      const toItem = (v: any): VideoItem => ({
        id: v.id,
        title: v.snippet?.title ?? 'Vídeo sem título',
        publishedAt: v.snippet?.publishedAt ?? '',
        thumbnail: bestThumb(v.snippet?.thumbnails, v.id),
        url: watchUrl(v.id),
        embeddable: typeof v.status?.embeddable === 'boolean' ? v.status.embeddable : null,
      });

      const lives = details.filter((v) =>
        v.snippet?.liveBroadcastContent === 'live' &&
        v.liveStreamingDetails?.actualStartTime &&
        !v.liveStreamingDetails?.actualEndTime &&
        v.status?.privacyStatus !== 'private');
      lives.sort((a, b) => String(b.liveStreamingDetails.actualStartTime).localeCompare(String(a.liveStreamingDetails.actualStartTime)));

      const live: LiveInfo | null = lives[0] ? {
        ...toItem(lives[0]),
        startedAt: lives[0].liveStreamingDetails.actualStartTime ?? null,
        concurrentViewers: lives[0].liveStreamingDetails.concurrentViewers != null
          ? Number(lives[0].liveStreamingDetails.concurrentViewers) : null,
      } : null;

      const videos = details
        .filter((v) => v.snippet?.liveBroadcastContent === 'none' && v.status?.privacyStatus !== 'private')
        .sort((a, b) => String(b.snippet?.publishedAt).localeCompare(String(a.snippet?.publishedAt)))
        .slice(0, max)
        .map(toItem);

      this.liveConfirmedAt = nowIso;
      return {
        ...prev,
        live,
        liveCheck: 'ok' as LiveCheckStatus,
        videos,
        videosSource: 'api',
        lastLiveCheckAt: nowIso,
        lastVideosAt: nowIso,
        message: null,
      };
    } catch (err) {
      const reason = (err as Error).message;
      this.opts.log(`[youtube] Data API falhou: ${reason}`);
      const next: YouTubeState = {
        ...prev,
        liveCheck: 'error',
        // mantém a live só se foi confirmada há pouco tempo; nunca a inventa
        live: this.isLiveConfirmationRecent() ? prev.live : null,
        message: /quota/i.test(reason)
          ? 'Limite diário de consultas do YouTube atingido. A verificação de live volta automaticamente.'
          : 'A verificação de transmissão ao vivo está temporariamente indisponível.',
      };
      try {
        next.videos = await this.fetchRss();
        next.videosSource = 'rss';
        next.lastVideosAt = nowIso;
      } catch {
        try {
          const page = await this.fetchFromPages();
          if (page.videos.length) { next.videos = page.videos; next.videosSource = 'page'; next.lastVideosAt = nowIso; }
        } catch { /* mantém a última lista conhecida */ }
      }
      return next;
    }
  }
}
