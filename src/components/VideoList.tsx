import type { VideoItem } from '../../shared/types.ts';

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function relativeDate(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = (t - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

export function VideoList({ videos, selectedId, onSelect, loading }: {
  videos: VideoItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <ul className="vgrid" aria-busy="true" aria-label="Carregando vídeos">
        {Array.from({ length: 6 }, (_, i) => <li key={i} className="vcard vcard--skeleton glass" />)}
      </ul>
    );
  }
  return (
    <ul className="vgrid">
      {videos.map((v, i) => (
        <li key={v.id} style={{ ['--n' as string]: i }}>
          <button
            type="button"
            className={`vcard glass ${selectedId === v.id ? 'is-selected' : ''}`}
            onClick={() => onSelect(v.id)}
            aria-current={selectedId === v.id ? 'true' : undefined}
          >
            <span className="vcard__thumb">
              <img src={v.thumbnail} alt="" loading="lazy" decoding="async" width={480} height={360} />
              {v.embeddable === false && <span className="vcard__tag">Somente no YouTube</span>}
            </span>
            <span className="vcard__body">
              <span className="vcard__title">{v.title}</span>
              {v.publishedAt && <span className="vcard__meta">{relativeDate(v.publishedAt)}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
