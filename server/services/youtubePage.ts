import type { VideoItem } from '../../shared/types.ts';

/**
 * Leitura da página pública do canal (abas "Vídeos" e "Ao vivo"), sem chave de API.
 * Usada quando o feed RSS do YouTube falha. Percorre o objeto ytInitialData de forma
 * genérica (procura qualquer bloco com ID de vídeo + título), para resistir a mudanças
 * de layout do YouTube.
 */

export interface PageVideo extends VideoItem {
  isLive: boolean;
  isUpcoming: boolean;
}

export const PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  // evita a página de consentimento de cookies
  Cookie: 'CONSENT=YES+cb; SOCS=CAI',
};

/** Extrai o JSON de `var ytInitialData = {...};` */
export function extractInitialData(html: string): unknown | null {
  const marker = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*/);
  if (!marker || marker.index === undefined) return null;
  const start = marker.index + marker[0].length;
  if (html[start] !== '{') return null;
  // acha o fim do objeto contando chaves, respeitando strings
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

const UNIT_SECONDS: [RegExp, number][] = [
  [/^(segundo|second)/, 1],
  [/^(minuto|minute)/, 60],
  [/^(hora|hour)/, 3600],
  [/^(dia|day)/, 86400],
  [/^(semana|week)/, 7 * 86400],
  [/^(m[eê]s|meses|month)/, 30 * 86400],
  [/^(ano|year)/, 365 * 86400],
];

/** "há 3 dias", "Transmitido há 2 semanas", "5 hours ago" → data aproximada */
export function parseRelativeTime(text: string, now: Date): string {
  const m = /(\d+)\s+([a-zà-ú]+)/i.exec(text.toLowerCase());
  if (!m) return '';
  const n = Number(m[1]);
  const unit = UNIT_SECONDS.find(([re]) => re.test(m[2]));
  if (!unit) return '';
  return new Date(now.getTime() - n * unit[1] * 1000).toISOString();
}

function textOf(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v.simpleText === 'string') return v.simpleText;
  if (typeof v.content === 'string') return v.content;
  if (Array.isArray(v.runs)) return v.runs.map((r: any) => r?.text ?? '').join('');
  return '';
}

const LIVE_RE = /BADGE_STYLE_TYPE_LIVE_NOW|"style":"LIVE"|THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE|"iconType":"LIVE"/;
const UPCOMING_RE = /"upcomingEventData"|"style":"UPCOMING"|BADGE_STYLE_UPCOMING/;

/** Percorre ytInitialData e devolve os vídeos na ordem em que aparecem na página. */
export function parseChannelPage(html: string, now = new Date()): PageVideo[] {
  const data = extractInitialData(html);
  if (!data) return [];
  const out: PageVideo[] = [];
  const seen = new Set<string>();

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }

    // Formato clássico: videoRenderer / gridVideoRenderer
    const vr = node.videoRenderer ?? node.gridVideoRenderer;
    if (vr?.videoId && !seen.has(vr.videoId)) {
      const raw = JSON.stringify(vr);
      seen.add(vr.videoId);
      out.push(item(vr.videoId, textOf(vr.title), textOf(vr.publishedTimeText), LIVE_RE.test(raw), UPCOMING_RE.test(raw), now));
      return;
    }
    // Formato novo: lockupViewModel
    const lv = node.lockupViewModel;
    if (lv?.contentId && (lv.contentType ?? '').includes('VIDEO') && !seen.has(lv.contentId)) {
      const raw = JSON.stringify(lv);
      const meta = lv.metadata?.lockupMetadataViewModel;
      const parts: string[] = [];
      for (const row of meta?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
        for (const p of row?.metadataParts ?? []) parts.push(textOf(p?.text));
      }
      seen.add(lv.contentId);
      out.push(item(lv.contentId, textOf(meta?.title), parts.join(' '), LIVE_RE.test(raw), UPCOMING_RE.test(raw), now));
      return;
    }
    for (const k in node) visit(node[k]);
  };
  visit(data);
  return out;
}

function item(id: string, title: string, when: string, isLive: boolean, isUpcoming: boolean, now: Date): PageVideo {
  return {
    id,
    title: title || 'Vídeo sem título',
    publishedAt: isLive ? now.toISOString() : parseRelativeTime(when, now),
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
    embeddable: null,
    isLive,
    isUpcoming,
  };
}
