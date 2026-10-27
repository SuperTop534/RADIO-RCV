import { RadioController } from './radio.ts';

export const DEFAULT_STREAM_URL = 'https://stm12.voxhd.com.br:13010/stream//';

/** Instância única do rádio para todo o app. */
export const radio = new RadioController(DEFAULT_STREAM_URL, {
  artwork: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
});

if (typeof __PREVIEW__ !== 'undefined' && __PREVIEW__) {
  // Na prévia o navegador bloqueia áudio de outros sites: avisa em vez de fingir que toca.
  radio.play = () => {
    (radio as any).set({ status: 'error', errorMessage: 'preview' });
  };
}

/** Lê a configuração pública do servidor (permite trocar a URL do streaming sem recompilar). */
export async function loadPublicConfig(): Promise<{ whatsappNumber?: string } | null> {
  if (__PREVIEW__ || __STATIC__) return null; // site estático: usa os valores padrão
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (!res.ok) return null;
    const cfg = await res.json();
    if (typeof cfg.radioStreamUrl === 'string') radio.setUrl(cfg.radioStreamUrl);
    return cfg;
  } catch {
    return null; // sem servidor: usa os valores padrão
  }
}
