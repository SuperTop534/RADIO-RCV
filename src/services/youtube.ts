import type { YouTubeState } from '../../shared/types.ts';
import { readCache, writeCache } from './cache.ts';

export const CHANNEL_URL = 'https://www.youtube.com/@rcvestudioradio4570';

export function embedUrl(videoId: string, opts: { autoplay?: boolean } = {}): string {
  const p = new URLSearchParams({
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
    ...(opts.autoplay ? { autoplay: '1' } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${p}`;
}

/** Store de estado do YouTube, compartilhado pelo app (aberto/fechado de abas não reinicia). */
type Listener = () => void;

export interface YouTubeClientSnapshot {
  data: YouTubeState | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  fromCache: boolean;
}

class YouTubeClient {
  private snap: YouTubeClientSnapshot;
  private listeners = new Set<Listener>();
  private inflight: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const cached = readCache<YouTubeState>('youtube');
    this.snap = {
      data: cached ? { ...cached.value, live: null } : null, // live em cache nunca é exibida como ativa
      loading: false,
      error: null,
      fetchedAt: null,
      fromCache: Boolean(cached),
    };
  }

  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;

  private set(p: Partial<YouTubeClientSnapshot>) {
    this.snap = { ...this.snap, ...p };
    for (const l of this.listeners) l();
  }

  get pollMs() {
    return Math.max(15, this.snap.data?.clientPollSeconds ?? 60) * 1000;
  }

  isStale() {
    return !this.snap.fetchedAt || Date.now() - this.snap.fetchedAt > this.pollMs;
  }

  refresh(fresh = false): Promise<void> {
    if (this.inflight) return this.inflight;
    this.set({ loading: true });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    // Servidor Node: /api/youtube. GitHub Pages: youtube.json (atualizado pelo robô do GitHub Actions).
    const url = __STATIC__ ? `youtube.json?t=${Date.now()}` : `/api/youtube${fresh ? '?fresh=1' : ''}`;
    this.inflight = fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as YouTubeState;
        writeCache('youtube', data);
        this.set({ data, error: null, fetchedAt: Date.now(), fromCache: false });
      })
      .catch(() => {
        this.set({
          error: __PREVIEW__
            ? 'Nesta prévia os vídeos não carregam (precisam do servidor do app). Abra o canal no YouTube:'
            : navigator.onLine === false
            ? 'Sem conexão com a internet.'
            : 'Não foi possível carregar os vídeos agora.',
        });
      })
      .finally(() => {
        clearTimeout(t);
        this.inflight = null;
        this.set({ loading: false });
      });
    return this.inflight;
  }

  /** Verificações periódicas enquanto o app está aberto e visível. */
  startPolling() {
    if (this.timer) return;
    const tick = () => {
      if (document.visibilityState === 'visible' && this.isStale()) void this.refresh();
    };
    this.timer = setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
  }
}

export const youtube = new YouTubeClient();
