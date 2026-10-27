/** Tipos compartilhados entre o servidor e o app. */

export interface VideoItem {
  id: string;
  title: string;
  publishedAt: string; // ISO
  thumbnail: string;
  url: string;
  /** null = desconhecido (feed público não informa) */
  embeddable: boolean | null;
}

export interface LiveInfo extends VideoItem {
  startedAt: string | null;
  concurrentViewers: number | null;
}

export type LiveCheckStatus =
  /** Verificação feita com a YouTube Data API */
  | 'ok'
  /** Sem chave da API: não há como confirmar lives de forma confiável */
  | 'unconfigured'
  /** A API falhou (cota, rede, etc.); dados podem estar desatualizados */
  | 'error';

export interface YouTubeState {
  channelId: string;
  channelUrl: string;
  live: LiveInfo | null;
  liveCheck: LiveCheckStatus;
  videos: VideoItem[];
  videosSource: 'api' | 'rss' | 'none';
  /** ISO da última verificação bem-sucedida de live (ou null) */
  lastLiveCheckAt: string | null;
  /** ISO da última atualização dos vídeos */
  lastVideosAt: string | null;
  /** ISO do próximo horário da verificação diária obrigatória */
  nextDailyCheckAt: string;
  /** Sugestão de intervalo de consulta do app (segundos) */
  clientPollSeconds: number;
  message: string | null;
}

export interface PublicConfig {
  radioStreamUrl: string;
  whatsappNumber: string;
}
