import crypto from 'node:crypto';

/**
 * Notificações push do YouTube via WebSub (PubSubHubbub).
 * O YouTube avisa quando o canal publica/atualiza um vídeo (inclui início de lives
 * na maioria dos casos). Funciona apenas com PUBLIC_URL acessível pela internet.
 * É um complemento: a verificação periódica continua como rede de segurança.
 */

export const HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
export const CALLBACK_PATH = '/api/youtube/websub';
export const topicFor = (channelId: string) =>
  `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`;

const LEASE_SECONDS = 5 * 24 * 60 * 60; // 5 dias
const RENEW_MS = 4 * 24 * 60 * 60 * 1000; // renova antes de expirar

export function verifySignature(body: Buffer, header: string | undefined, secret: string): boolean {
  if (!secret) return true; // sem segredo configurado, não há assinatura para validar
  if (!header) return false;
  const [algo, sig] = header.split('=');
  if (!algo || !sig || !['sha1', 'sha256', 'sha384', 'sha512'].includes(algo)) return false;
  const expected = crypto.createHmac(algo, secret).update(body).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function startWebSub(opts: {
  publicUrl: string;
  channelId: string;
  secret: string;
  log?: (m: string) => void;
}): { stop(): void } | null {
  const log = opts.log ?? console.log;
  if (!opts.publicUrl || !/^https:\/\//.test(opts.publicUrl)) {
    log('[websub] PUBLIC_URL (https) não configurada — notificações instantâneas desativadas; usando verificação periódica.');
    return null;
  }
  const subscribe = async () => {
    const body = new URLSearchParams({
      'hub.callback': opts.publicUrl + CALLBACK_PATH,
      'hub.topic': topicFor(opts.channelId),
      'hub.mode': 'subscribe',
      'hub.verify': 'async',
      'hub.lease_seconds': String(LEASE_SECONDS),
      ...(opts.secret ? { 'hub.secret': opts.secret } : {}),
    });
    try {
      const res = await fetch(HUB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      log(`[websub] inscrição enviada (HTTP ${res.status})`);
    } catch (err) {
      log(`[websub] falha ao inscrever: ${(err as Error).message}`);
    }
  };
  void subscribe();
  const timer = setInterval(subscribe, RENEW_MS);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
