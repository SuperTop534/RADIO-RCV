/**
 * Controlador único do rádio (fora do React).
 * - Um só <audio> para todo o app → nunca há duas conexões simultâneas.
 * - Sobrevive à troca de abas internas (o estado não depende de componentes montados).
 * - Reconexão automática com intervalo progressivo e limite de tentativas.
 * - Integração com Media Session (tela bloqueada / central de notificações).
 */

export type RadioStatus =
  | 'idle'          // ainda não iniciado
  | 'connecting'    // conectando ao streaming
  | 'playing'       // áudio realmente tocando (evento "playing" recebido)
  | 'buffering'     // tocando, mas aguardando dados
  | 'reconnecting'  // falhou; nova tentativa agendada
  | 'paused'        // pausado pelo ouvinte
  | 'blocked'       // navegador exigiu um toque para iniciar o áudio
  | 'offline'       // sem internet; aguardando reconexão da rede
  | 'error';        // tentativas esgotadas

export interface RadioSnapshot {
  status: RadioStatus;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  errorMessage: string | null;
}

export const MAX_ATTEMPTS = 8;
const CONNECT_TIMEOUT_MS = 15_000;
const STALL_TIMEOUT_MS = 12_000;

/** Intervalo progressivo: 1s, 2s, 4s, 8s, 16s, 30s, 30s… (+ variação aleatória de até 20%) */
export function retryDelay(attempt: number, random = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base + base * 0.2 * random());
}

export const STATUS_LABEL: Record<RadioStatus, string> = {
  idle: 'Toque para ouvir',
  connecting: 'Conectando…',
  playing: 'Reproduzindo',
  buffering: 'Carregando…',
  reconnecting: 'Reconectando…',
  paused: 'Pausado',
  blocked: 'Toque para iniciar o áudio',
  offline: 'Sem conexão com a internet',
  error: 'Rádio indisponível no momento',
};

type Listener = () => void;

export class RadioController {
  readonly audio: HTMLAudioElement;
  private url: string;
  private snap: RadioSnapshot = { status: 'idle', attempt: 0, maxAttempts: MAX_ATTEMPTS, nextRetryAt: null, errorMessage: null };
  private listeners = new Set<Listener>();
  private wantPlaying = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  /** ignora eventos "pause" disparados pelo próprio controlador */
  private selfPausing = false;
  private artwork: MediaImage[];

  constructor(url: string, opts: { artwork?: MediaImage[]; audio?: HTMLAudioElement } = {}) {
    this.url = url;
    this.artwork = opts.artwork ?? [];
    this.audio = opts.audio ?? new Audio();
    this.audio.preload = 'none';
    this.audio.setAttribute('playsinline', '');
    this.audio.setAttribute('x-webkit-airplay', 'allow');
    this.bindAudioEvents();
    this.bindNetworkEvents();
    this.setupMediaSession();
  }

  // ---------- assinatura (useSyncExternalStore) ----------
  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;

  private set(patch: Partial<RadioSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.updateMediaSessionState();
    for (const l of this.listeners) l();
  }

  get streamUrl() {
    return this.url;
  }

  get isActive() {
    return this.wantPlaying;
  }

  setUrl(url: string) {
    if (!url || url === this.url) return;
    this.url = url;
    if (this.wantPlaying) this.connect('connecting');
  }

  // ---------- ações públicas ----------
  /** Inicia a rádio. Chamadas repetidas enquanto conecta/toca são ignoradas. */
  play() {
    if (this.wantPlaying && ['connecting', 'playing', 'buffering', 'reconnecting'].includes(this.snap.status)) return;
    this.wantPlaying = true;
    this.set({ attempt: 0, errorMessage: null });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.set({ status: 'offline', nextRetryAt: null });
      return;
    }
    this.connect('connecting');
  }

  /** Pausa e encerra o download (rádio ao vivo: ao voltar, reconecta no ponto atual). */
  pause() {
    this.wantPlaying = false;
    this.clearTimers();
    this.hardStop();
    this.set({ status: 'paused', nextRetryAt: null, attempt: 0 });
  }

  toggle() {
    if (this.wantPlaying) this.pause();
    else this.play();
  }

  // ---------- conexão ----------
  private connect(state: 'connecting' | 'reconnecting') {
    this.clearTimers();
    this.set({ status: state, nextRetryAt: null });
    // Recarrega a fonte: garante áudio ao vivo (sem trecho antigo em buffer)
    this.selfPausing = true;
    this.audio.src = this.url;
    this.audio.load();
    this.selfPausing = false;

    this.watchdog = setTimeout(() => {
      if (this.snap.status !== 'playing') this.fail('Tempo de conexão esgotado');
    }, CONNECT_TIMEOUT_MS);

    const p = this.audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch((err: DOMException) => {
        if (!this.wantPlaying) return;
        if (err?.name === 'NotAllowedError') {
          // Política de reprodução automática: precisa de um toque do ouvinte.
          this.clearTimers();
          this.wantPlaying = false;
          this.hardStop();
          this.set({ status: 'blocked', nextRetryAt: null });
        } else if (err?.name === 'AbortError') {
          // interrompido por novo load(): ignorado
        } else {
          this.fail(err?.message || 'Falha ao reproduzir');
        }
      });
    }
  }

  private fail(reason: string) {
    if (!this.wantPlaying) return;
    this.clearTimers();
    this.hardStop();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.set({ status: 'offline', nextRetryAt: null, errorMessage: reason });
      return;
    }
    const attempt = this.snap.attempt + 1;
    if (attempt > MAX_ATTEMPTS) {
      this.wantPlaying = false;
      this.set({ status: 'error', attempt: MAX_ATTEMPTS, nextRetryAt: null, errorMessage: reason });
      return;
    }
    const delay = retryDelay(attempt);
    this.set({ status: 'reconnecting', attempt, nextRetryAt: Date.now() + delay, errorMessage: reason });
    this.retryTimer = setTimeout(() => {
      if (this.wantPlaying) this.connect('reconnecting');
    }, delay);
  }

  private hardStop() {
    this.selfPausing = true;
    try {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load(); // encerra a conexão HTTP com o servidor de streaming
    } catch { /* ignore */ }
    this.selfPausing = false;
  }

  private clearTimers() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.retryTimer = this.watchdog = null;
  }

  // ---------- eventos do <audio> ----------
  private bindAudioEvents() {
    const a = this.audio;
    a.addEventListener('playing', () => {
      if (!this.wantPlaying) return;
      this.clearTimers();
      this.set({ status: 'playing', attempt: 0, nextRetryAt: null, errorMessage: null });
    });
    const onWaiting = () => {
      if (!this.wantPlaying || this.snap.status !== 'playing') return;
      this.set({ status: 'buffering' });
      if (this.watchdog) clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        if (this.wantPlaying && this.snap.status === 'buffering') this.fail('Transmissão travou');
      }, STALL_TIMEOUT_MS);
    };
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('stalled', onWaiting);
    a.addEventListener('error', () => {
      if (!this.wantPlaying || !a.getAttribute('src')) return;
      const code = a.error?.code;
      this.fail(code === 4 ? 'Formato do streaming não suportado ou servidor fora do ar' : 'Erro de rede no streaming');
    });
    a.addEventListener('ended', () => {
      // Uma transmissão ao vivo não "termina": se terminar, o servidor caiu.
      if (this.wantPlaying) this.fail('Transmissão encerrada pelo servidor');
    });
    a.addEventListener('pause', () => {
      // O evento "pause" é assíncrono: só conta como pausa do sistema se a rádio
      // estava de fato tocando (pausas internas já mudaram o status antes).
      if (this.selfPausing || !this.wantPlaying) return;
      if (this.snap.status !== 'playing' && this.snap.status !== 'buffering') return;
      if (!a.getAttribute('src')) return;
      // Pausa vinda do sistema (ligação, outro app de áudio, fone desconectado)
      this.wantPlaying = false;
      this.clearTimers();
      this.hardStop();
      this.set({ status: 'paused', nextRetryAt: null });
    });
  }

  private bindNetworkEvents() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      if (this.wantPlaying && (this.snap.status === 'offline' || this.snap.status === 'reconnecting')) {
        this.set({ attempt: 0 });
        this.connect('reconnecting');
      }
    });
    window.addEventListener('offline', () => {
      if (this.wantPlaying && this.snap.status !== 'playing') {
        this.clearTimers();
        this.set({ status: 'offline', nextRetryAt: null });
      }
    });
    // Ao voltar para o app, se a conexão morreu em segundo plano, tenta de novo imediatamente.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.wantPlaying && this.snap.status === 'reconnecting') {
        this.connect('reconnecting');
      }
    });
  }

  // ---------- Media Session ----------
  private setupMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: 'RCV Estúdio Rádio',
        artist: 'Ao vivo',
        album: 'A sua playlist digital na internet',
        artwork: this.artwork,
      });
    } catch { /* MediaMetadata indisponível */ }
    const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { /* ação não suportada */ }
    };
    safe('play', () => this.play());
    safe('pause', () => this.pause());
    safe('stop', () => this.pause());
    // Rádio ao vivo: sem avançar/voltar/arrastar
    for (const a of ['seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'] as MediaSessionAction[]) safe(a, null);
  }

  private updateMediaSessionState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const s = this.snap.status;
    navigator.mediaSession.playbackState =
      s === 'playing' || s === 'buffering' ? 'playing' : s === 'idle' ? 'none' : 'paused';
  }
}
